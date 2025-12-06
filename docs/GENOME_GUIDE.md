# GUCA Genome YAML Guide — “Create Your Own Organism”

This project visualizes a **Graph Unfolding Machine (GUM)**: a small rule table (“genome”) that repeatedly modifies a graph.
You can create your own organisms by writing a **YAML genome** and uploading it in the demo UI (or exporting an existing one and editing it).

## Quickstart (the fastest way)

1. Open the demo.
2. Pick an existing genome from **Genome (YAML)**.
3. Click **⤓ Export**, save the YAML, edit it, then **Upload** it back.

Examples live in `data/genoms/` (the app’s built‑in catalog loads from there).

---

## Mental model (first principles)

### 1) What the machine simulates
- The world is an **undirected graph**: nodes + edges.
- Each node has a **state** (`A..Z`, plus special states like `any`, `Unknown`).
- Each iteration (“step”):
  1. The machine **snapshots** each node (state, degree, parents count).
  2. For each node (in increasing `id` order), it finds the **first matching rule** and applies its operation **immediately**.

### 2) Snapshot semantics (important!)
Rule matching uses the **snapshotted** values:
- `saved_state` (node state at start of the step)
- `saved_degree` (degree at start of the step)
- `saved_parents` (parents count at start of the step)

Operations may change the graph immediately, but those changes generally **do not influence which rules match for other nodes during the same step**.

Also:
- Newly born nodes are marked `markedNew` and are **ignored** by some operations (e.g., connect/disconnect targets), until the next step.

### 3) Stopping
In the demo UI you can set **Max iterations**:
- `-1` means “unlimited” (keeps stepping until you pause).
- Any non-negative value stops the autoplay when reached.

---

## YAML file structure

A genome YAML has three main blocks:

```yaml
machine:
  # machine settings (optional)
init_graph:
  # initial seed graph (optional)
rules:
  # list of rules (required)
```

Optional metadata (used by the loader):
```yaml
meta:
  activity_scheme: "4x9x18xx"
```

### Top-level keys
- `machine`: engine config and extra runtime knobs
- `init_graph`: initial nodes (edges are not currently exposed in the YAML format)
- `rules`: ordered list of `{ condition, op }`
- `meta.activity_scheme` (optional): keeps only selected rules (useful for “introns”)

---

## Node states

Use:
- Letters: `A`, `B`, … `Z`
- Special:
  - `any` — wildcard (matches any prior state; can also be used as a wildcard current state)
  - `Unknown` — special value used as the default prior state for brand‑new nodes

The loader also accepts **numeric enum values** (advanced), but strings are recommended.

---

## Machine settings (`machine:`)

```yaml
machine:
  start_state: A                 # seed node state (used if init_graph is omitted)
  transcription: resettable       # resettable | continuable
  count_compare: range            # range | exact
  max_vertices: 2000              # 0 = unlimited
  max_steps: 120                  # -1 = unlimited (UI autoplay)
  rng_seed: 123                   # used only when tie_breaker: random

  nearest_search:
    max_depth: 2                  # BFS depth limit
    tie_breaker: stable           # stable | by_id | by_creation | random
    connect_all: false            # connect to all candidates at first eligible depth

  maintain_single_component: true # keep only the “primary” component after each step

  orphan_cleanup:
    enabled: false
    thresholds: { size1: 5, size2: 7, others: 10 }
    fadeStarts: { size1: 3, size2: 5, others: 8 }

  reseed_isolated_A: true         # convert isolated A nodes into new roots (see details below)
```

### `transcription`
Controls how rule scanning works per node:
- `resettable`: each node scans rules from the start every step.
- `continuable`: each node remembers the index after its last match and resumes from there (wraps around).

### `count_compare`
Controls how `*_ge` is interpreted:
- `range`:
  - `conn_ge/conn_le` and `parents_ge/parents_le` are lower/upper bounds
  - negative values mean “ignore”
- `exact`:
  - if `conn_ge` (or `parents_ge`) is provided, it becomes an **exact equality**
  - `*_le` is still treated as an upper bound

### `nearest_search`
Used by the `TryToConnectWithNearest` operation:
- BFS from the source node up to `max_depth`
- take the **first depth** where eligible candidates exist
- if `connect_all: true`, connect to **all** candidates at that depth
- otherwise pick one candidate:
  - `stable/by_id/by_creation`: lowest node id
  - `random`: RNG choice (`rng_seed`)

### `maintain_single_component`
When enabled, the machine keeps only one connected component:
- It chooses the component that contains the “oldest” node (lowest `parentsCount`), tie‑breaking by node id.

This is very useful to prevent the graph from splitting into multiple drifting islands after cuts.

### `orphan_cleanup` (Auto-dissolve detached subgraphs)
If enabled (and `maintain_single_component` is false), detached components gradually “fade” and are deleted.
The fade is purely visual; deletion happens when the component’s nodes exceed the configured age threshold.

### `reseed_isolated_A`
If enabled, and only when:
- `maintain_single_component` is **false**, and
- `orphan_cleanup.enabled` is **false**

…then isolated **single-node** components in state `A` are “reseeded”:
- `parentsCount` is set to `0`
- `priorState` becomes `Unknown`

This makes isolated `A` nodes behave like new roots.

---

## Rules (`rules:`)

Rules are an **ordered list**; the first match wins.

```yaml
rules:
  - condition: { current: A, prior: any, conn_ge: 0, conn_le: 2, parents_ge: -1, parents_le: -1 }
    op:        { kind: GiveBirthConnected, operand: A }
```

### Condition fields

```yaml
condition:
  current: A        # required (recommended)
  prior: any        # optional, default: any
  conn_ge: -1       # optional, default -1 (ignore)
  conn_le: -1
  parents_ge: -1
  parents_le: -1
```

You may also encounter legacy names in older genomes:
- `allConnectionsCount_GE` / `allConnectionsCount_LE`
- `parentsCount_GE` / `parentsCount_LE`

The loader supports both spellings.

### Operations (`op.kind`)
All operations share a common shape:

```yaml
op:
  kind: TurnToState
  operand: B
```

Supported `kind` values:

#### 1) `TurnToState`
Sets the node’s state to `operand`.
```yaml
op: { kind: TurnToState, operand: C }
```

#### 2) `GiveBirth`
Creates a new node with state `operand`.
The newborn gets `parentsCount = parent.parentsCount + 1`.
```yaml
op: { kind: GiveBirth, operand: A }
```

#### 3) `GiveBirthConnected`
Same as `GiveBirth`, but also connects parent → child.
```yaml
op: { kind: GiveBirthConnected, operand: A }
```

#### 4) `TryToConnectWith`
Connect to **all** nodes whose snapshotted state equals `operand`.
Newborn nodes from the current step are ignored as targets.
```yaml
op: { kind: TryToConnectWith, operand: B }
```

#### 5) `TryToConnectWithNearest`
Connect to nodes matching `operand` at the nearest BFS depth (see `nearest_search`).
```yaml
op: { kind: TryToConnectWithNearest, operand: A }
```

#### 6) `DisconnectFrom`
Disconnect from neighbors whose snapshotted state equals `operand`.
Newborn nodes from the current step are ignored as targets.
```yaml
op: { kind: DisconnectFrom, operand: A }
```
Note: legacy genomes may spell it `DisconectFrom` (missing “n”). Both are accepted.

#### 7) `Die`
Marks the node for deletion; it is removed at the end of the step.
```yaml
op: { kind: Die }
```

---

## Minimal working example

A tiny “chain grower”:

```yaml
machine:
  start_state: A
  max_vertices: 200
  max_steps: 200
  transcription: resettable
  count_compare: range
  nearest_search: { max_depth: 2, tie_breaker: stable, connect_all: false }
  maintain_single_component: true

init_graph:
  nodes:
    - { state: A }

rules:
  # If A has degree <= 1, add another A connected to it.
  - condition: { current: A, prior: any, conn_le: 1 }
    op: { kind: GiveBirthConnected, operand: A }
```

Upload this YAML, press **Start**, and watch the “organism” grow.

---

## Tips & troubleshooting

- If nothing happens, try loosening conditions (`prior: any`, remove `conn_*` bounds).
- If your graph explodes too fast, set `max_vertices` and/or lower `max_steps`.
- If your organism splits into islands after cutting edges:
  - enable **Maintain a single component**, or
  - enable **Auto-dissolve detached subgraphs**.
- Use **⤓ Export** to save the exact genome + current settings after tweaking.

