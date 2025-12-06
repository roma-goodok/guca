# docs/reference/gum_machine_spec.py  (reference only; mirrors src/guca/core)

from enum import Enum
from collections import deque

class TranscriptionWay(str, Enum):
    resettable = "resettable"
    continuable = "continuable"

class CountCompare(str, Enum):
    range = "range"
    exact = "exact"

class OperationKind(str, Enum):
    TurnToState = "TurnToState"
    TryToConnectWith = "TryToConnectWith"
    TryToConnectWithNearest = "TryToConnectWithNearest"
    GiveBirth = "GiveBirth"
    GiveBirthConnected = "GiveBirthConnected"
    DisconnectFrom = "DisconnectFrom"
    Die = "Die"

class Condition:
    # - values < 0 mean "ignore" for *_ge/*_le (range mode)
    # - prior: "any" means ignore
    def __init__(self, current, prior="any", conn_ge=-1, conn_le=-1, parents_ge=-1, parents_le=-1):
        self.current = str(current)
        self.prior = "any" if prior is None else str(prior)
        self.conn_ge, self.conn_le = int(conn_ge), int(conn_le)
        self.parents_ge, self.parents_le = int(parents_ge), int(parents_le)

class Operation:
    def __init__(self, kind: OperationKind, operand=None):
        self.kind = OperationKind(kind)
        self.operand = None if operand is None else str(operand)

class Rule:
    def __init__(self, condition: Condition, operation: Operation):
        self.condition = condition
        self.operation = operation
        self.is_enabled = True
        self.is_active = False
        self.was_active = False
        self.last_activation_index = -1  # for UI/analytics only

def _match_int(val: int, ge: int, le: int, mode: CountCompare) -> bool:
    if ge < 0 and le < 0:
        return True
    if mode == CountCompare.exact and ge >= 0:
        # "exact" means: if ge is given, val must equal ge
        return val == ge
    if ge >= 0 and val < ge:
        return False
    if le >= 0 and val > le:
        return False
    return True

def rule_matches(saved_state, prior_state, degree, parents_count, rule: Rule, cmp_mode: CountCompare) -> bool:
    if not rule.is_enabled:
        return False
    c = rule.condition
    if c.current != saved_state: return False
    if c.prior not in ("any", None) and c.prior != prior_state: return False
    if not _match_int(degree, c.conn_ge, c.conn_le, cmp_mode): return False
    if not _match_int(parents_count, c.parents_ge, c.parents_le, cmp_mode): return False
    return True

class GUMGraph:
    """Integer node ids; each node has .state, .prior_state, .neighbors set, .parents_count, and step-snapshot fields."""
    def __init__(self): self._nodes = {}; self._next = 0
    def add_vertex(self, state, parents_count=0, mark_new=True):
        nid = self._next; self._next += 1
        self._nodes[nid] = {
            "id": nid, "state": state, "prior_state": "Unknown",
            "neighbors": set(), "parents_count": parents_count,
            "marked_new": mark_new, "marked_deleted": False,
            # step snapshot
            "saved_state": None, "saved_parents": 0, "saved_degree": 0,
            "rule_index": 0
        }
        return nid
    def add_edge(self, a,b):
        if a in self._nodes and b in self._nodes and a!=b:
            self._nodes[a]["neighbors"].add(b)
            self._nodes[b]["neighbors"].add(a)
    def remove_edge(self, a,b):
        if a in self._nodes: self._nodes[a]["neighbors"].discard(b)
        if b in self._nodes: self._nodes[b]["neighbors"].discard(a)
    def remove_vertex(self, nid):
        if nid in self._nodes:
            for nb in list(self._nodes[nid]["neighbors"]):
                self._nodes[nb]["neighbors"].discard(nid)
            del self._nodes[nid]
    def nodes(self): return list(self._nodes.values())
    def edges(self):
        seen=set()
        for n in self._nodes.values():
            for nb in n["neighbors"]:
                a,b=(n["id"],nb) if n["id"]<nb else (nb,n["id"])
                if (a,b) not in seen: seen.add((a,b)); yield (a,b)
    def snapshot_nodes(self):
        for n in self._nodes.values():
            n["marked_new"]=False
            n["saved_state"]=n["state"]
            n["saved_parents"]=n["parents_count"]
            n["saved_degree"]=len(n["neighbors"])
    def delete_marked(self):
        for nid in list(self._nodes.keys()):
            if self._nodes[nid]["marked_deleted"]:
                self.remove_vertex(nid)

    # Deterministic nearest with options (matches repo):
    def try_connect_with_nearest(self, u_id, *, required_state=None, max_depth=2, tie_breaker="stable", connect_all=False, rng=None):
        if u_id not in self._nodes or self._nodes[u_id]["marked_deleted"]: return
        nbrs_u = set(self._nodes[u_id]["neighbors"])
        def candidate_state(v):
            st = self._nodes[v].get("saved_state")
            return st if st is not None else self._nodes[v]["state"]
        def eligible(v):
            if v==u_id or v in nbrs_u: return False
            if self._nodes[v]["marked_new"]: return False
            if required_state is None: return True
            st = candidate_state(v)
            return st is not None and str(st)==str(required_state)
        # BFS until first depth with candidates
        visited={u_id}; q=deque([(u_id,0)]); found_depth=None; found=[]
        while q:
            nid,d=q.popleft()
            if found_depth is not None and d>found_depth: break
            if 0<d<=max_depth and eligible(nid):
                found_depth=d; found.append(nid); continue
            if d<max_depth:
                for nb in sorted(self._nodes[nid]["neighbors"]):
                    if nb not in visited: visited.add(nb); q.append((nb,d+1))
        if not found: return
        def _safe_add(a,b):
            if a!=b and a in self._nodes and b in self._nodes and b not in self._nodes[a]["neighbors"]:
                self._nodes[a]["neighbors"].add(b); self._nodes[b]["neighbors"].add(a)
        if connect_all:
            for v in found: _safe_add(u_id,v); return
        if tie_breaker=="random" and rng is not None:
            v = rng.choice(found)
        else:
            v = min(found)  # stable/by_id/by_creation => minimal id
        _safe_add(u_id,v)

class GraphUnfoldingMachine:
    """
    Engine loop:
      - Start from existing graph or single seed (start_state).
      - Each step: snapshot → per node: find first matching rule → apply op.
      - Stop on max_steps or two consecutive empty steps; then delete marked nodes.
      - TranscriptionWay.resettable: scan rules from 0 each time.
        TranscriptionWay.continuable: resume from next rule after last match (per-node).
    """
    def __init__(self, graph: GUMGraph, *, start_state="A", transcription=TranscriptionWay.resettable,
                 count_compare=CountCompare.range, max_vertices=0, max_steps=100,
                 nearest_max_depth=2, nearest_tie_breaker="stable", nearest_connect_all=False, rng_seed=None):
        import random
        self.graph=graph; self.transcription=TranscriptionWay(transcription)
        self.count_compare=CountCompare(count_compare)
        self.max_vertices=int(max_vertices); self.max_steps=int(max_steps)
        self.nearest_max_depth=int(nearest_max_depth); self.nearest_tie_breaker=str(nearest_tie_breaker)
        self.nearest_connect_all=bool(nearest_connect_all); self.rng = random.Random(rng_seed)
        self.change_table = []  # list[Rule]
        if not self.graph.nodes():
            self.graph.add_vertex(start_state, parents_count=0, mark_new=True)
        self.passed_steps=0; self._empty_iters=0

    def run(self):
        self.passed_steps=0; self._empty_iters=0
        while self.max_steps<0 or self.passed_steps<self.max_steps:
            if not self._next_step(): self._empty_iters+=1
            else: self._empty_iters=0
            self.passed_steps+=1
            if self._empty_iters>=2: break
        self.graph.delete_marked()

    def _find_rule_for(self, node):
        rules=self.change_table; start=0 if self.transcription==TranscriptionWay.resettable else node["rule_index"]
        n=len(rules)
        def _scan(lo,hi):
            for i in range(lo,hi):
                r=rules[i]
                if rule_matches(node["saved_state"], node["prior_state"], node["saved_degree"], node["saved_parents"], r, self.count_compare):
                    return r,i
            return None,-1
        r,i=_scan(start,n)
        if r is None and self.transcription==TranscriptionWay.continuable and start>0:
            r,i=_scan(0,start)
        return r,i

    def _next_step(self):
        self.graph.snapshot_nodes(); did=False
        for nid in [n["id"] for n in self.graph.nodes()]:
            if nid not in [m["id"] for m in self.graph.nodes()]: continue
            n = [m for m in self.graph.nodes() if m["id"]==nid][0]
            if n["marked_deleted"]: continue
            r,idx = self._find_rule_for(n)
            if r:
                self._apply(n, r); did=True
                r.is_active=True; r.was_active=True
                r.last_activation_index = (r.last_activation_index+1) if r.last_activation_index>=0 else 0
                if self.transcription==TranscriptionWay.continuable:
                    n["rule_index"] = (idx+1) % max(1,len(self.change_table))
            n["prior_state"]=n["saved_state"]
        return did

    def _apply(self, node, rule: Rule):
        k=rule.operation.kind; op=rule.operation.operand
        if k==OperationKind.TurnToState and op:
            node["state"]=op; return
        if k==OperationKind.GiveBirth and op:
            if self.max_vertices==0 or len(self.graph.nodes())<self.max_vertices:
                self.graph.add_vertex(op, parents_count=node["parents_count"]+1, mark_new=True); return
        if k==OperationKind.GiveBirthConnected and op:
            if self.max_vertices==0 or len(self.graph.nodes())<self.max_vertices:
                nid=self.graph.add_vertex(op, parents_count=node["parents_count"]+1, mark_new=True)
                self.graph.add_edge(node["id"], nid); return
        if k==OperationKind.TryToConnectWith and op:
            for other in self.graph.nodes():
                if other["id"]==node["id"] or other["marked_new"] or other["marked_deleted"]: continue
                if other["saved_state"]!=op: continue
                if other["id"] not in node["neighbors"]:
                    self.graph.add_edge(node["id"], other["id"])
            return
        if k==OperationKind.TryToConnectWithNearest:
            self.graph.try_connect_with_nearest(
                node["id"],
                required_state=op,
                max_depth=self.nearest_max_depth,
                tie_breaker=self.nearest_tie_breaker,
                connect_all=self.nearest_connect_all,
                rng=self.rng
            ); return
        if k==OperationKind.DisconnectFrom and op:
            for nb in list(node["neighbors"]):
                other = [m for m in self.graph.nodes() if m["id"]==nb][0]
                if (not other["marked_new"]) and other["saved_state"]==op and (not node["marked_deleted"]):
                    self.graph.remove_edge(node["id"], nb); 
            return
        if k==OperationKind.Die:
            node["marked_deleted"]=True; return
