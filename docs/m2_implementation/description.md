# Key semantics to carry over to TypeScript/M1

**Snapshot semantics:** Rule matching uses snapshotted `saved_state`, `saved_degree`, `saved_parents` from the start of the step; writebacks (state change, births, edges) happen immediately but **do not** affect matching decisions for other nodes during the same step.

**Transcription:**
- **resettable:** scan rules from 0 every time.
- **continuable:** resume from the rule **after** the last matched one (per node), wrapping at end.

**Count comparisons:**
- **range:** `conn_ge`/`conn_le` and `parents_ge`/`parents_le` are lower/upper bounds; negative means “ignore”.
- **exact:** if `*_ge` is set, value must **equal** it. (`*_le` is still honored as an upper bound.)

**TryToConnectWith:** connect to **all** nodes whose `saved_state` equals operand (ignores new/deleted).

**TryToConnectWithNearest:**
- BFS from `u` up to `max_depth`; take the **first depth** with any eligible nodes.
- Eligibility: not `u`, not adjacent, not `marked_new`, and `saved_state == operand` (fallback to current state if `saved_state` absent).
- `connect_all: true` connects to **all** at that depth; else choose one by `tie_breaker`:
  - `"stable" | "by_id" | "by_creation"` ⇒ **min id**
  - `"random"` ⇒ RNG choice

**Birth operations** use `parents_count + 1` for the child; **GiveBirthConnected** also connects parent→child.

**Deletion** marks then physical deletion **after** the step.

**Stopping:** `max_steps` or **two** consecutive empty iterations.


---

# Legacy XML genome and its mapping (what M1 used)

Your converters already encode the mapping; here’s the concise spec developers need.

## Legacy XML (XAML‑ish) keys → New schema

### Rule condition (`OperationCondition`):
- `currentState` → `condition.current`
- `priorState` → `condition.prior` (legacy `"Min"`/`"Ignored"` ⇒ `"any"`)
- `allConnectionsCount_GE` → `condition.conn_ge`
- `allConnectionsCount_LE` → `condition.conn_le`
- `parentsCount_GE` → `condition.parents_ge`
- `parentsCount_LE` → `condition.parents_le`

### Operation:
- `kind` → `op.kind` (legacy typo `"DisconectFrom"` ⇒ `DisconnectFrom`)
- `operandNodeState` / `operand` / `state` → `op.operand`

### Machine block (constructed during conversion; not in XML):
- `start_state`:
  - default `"A"`, unless user explicitly asks to infer from the most frequent `condition.current`; inference is optional.
- `max_steps`: default `120`
- `max_vertices`: from legacy `Capacity` if present, else `2000`
- `transcription`: `"resettable"`
- `nearest_search`: `{ max_depth: 2, tie_breaker: stable, connect_all: false }`
- Optional `rng_seed`



Example XML fragment (conceptual)
```xml
<ChangeTable Capacity="2000">
  <ChangeTableItem>
    <OperationCondition currentState="A" priorState="Min" allConnectionsCount_GE="0" allConnectionsCount_LE="2" />
    <Operation kind="GiveBirthConnected" operandNodeState="B" />
  </ChangeTableItem>
  <ChangeTableItem>
    <OperationCondition currentState="B" />
    <Operation kind="TurnToState" state="C" />
  </ChangeTableItem>
</ChangeTable>

```
Mapped YAML
```yaml
machine:
  start_state: A
  transcription: resettable
  count_compare: range
  max_vertices: 2000
  max_steps: 120
  nearest_search: { max_depth: 2, tie_breaker: stable, connect_all: false }

init_graph:
  nodes: [{ state: A }]

rules:
  - condition: { current: A, prior: any, conn_ge: 0, conn_le: 2, parents_ge: -1, parents_le: -1 }
    op:        { kind: GiveBirthConnected, operand: B }
  - condition: { current: B, prior: any, conn_ge: -1, conn_le: -1, parents_ge: -1, parents_le: -1 }
    op:        { kind: TurnToState, operand: C }
```