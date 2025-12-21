#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple, Set

# Moore neighborhood in (x,y)
DELTAS_8: List[Tuple[int, int]] = [
    (dx, dy)
    for dx in (-1, 0, 1)
    for dy in (-1, 0, 1)
    if not (dx == 0 and dy == 0)
]


@dataclass(frozen=True)
class Params:
    # Diagonal strip (cylinder), torus, and straight-cylinder grid will use these:
    L: int = 10
    W: int = 20
    out_dir: Path = Path(".")

    # Glider placement for diagonal strip in (x, v) coords:
    # u = x (wrapped), v = y - x (must stay within [0..W-1])
    glider_x0: int = 10
    glider_v0: int = 10

    # Glider placement for torus in (row, col) coords:
    torus_glider_r0: int = 10
    torus_glider_c0: int = 10

    # NEW: Glider placement for straight grid cylinder in (row, col) coords:
    # columns wrap, rows are open
    cyl_glider_r0: int = 10
    cyl_glider_c0: int = 10

    # Rectangle quad mesh generator (4-neighbor)
    quad_L: int = 10
    quad_W: int = 20

    # Optional hole (0-based indices): top-left (hole_r0, hole_c0), size (hole_h, hole_w)
    hole_r0: int = 4
    hole_c0: int = 9
    hole_h: int = 2
    hole_w: int = 2


def nid(r: int, c: int, ncols: int) -> int:
    """1-based node id (row-major)."""
    return r * ncols + c + 1


def compute_degrees(edges: List[Tuple[int, int]], n_nodes: int) -> List[int]:
    deg = [0] * (n_nodes + 1)
    for a, b in edges:
        deg[a] += 1
        deg[b] += 1
    return deg


def write_yaml(path: Path, nodes: List[str], edges: List[Tuple[int, int]], header_lines: List[str], per_line: int) -> None:
    lines: List[str] = []
    lines.extend(header_lines)
    lines.append("")
    lines.append("nodes: [")

    for i in range(0, len(nodes), per_line):
        chunk = nodes[i : i + per_line]
        suffix = "," if (i + per_line) < len(nodes) else ""
        lines.append("  " + ", ".join(chunk) + suffix)

    lines.append("]")
    lines.append("")
    lines.append("edges:")
    for a, b in edges:
        lines.append(f"  - [{a}, {b}]")
    lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


# -------------------------
# 1) Diagonal strip (cylinder)
# -------------------------

def generate_nodes_with_glider_diagonal_strip(p: Params) -> List[str]:
    """
    Diagonal-band coords:
      u = x (wrapped mod L)
      v = y - x (open in [0..W-1])
    """
    L, W = p.L, p.W
    nodes = ["A"] * (L * W)

    # Classic glider in (x,y):
    # . B .
    # . . B
    # B B B
    glider_rel = [(0, 1), (1, 2), (2, 0), (2, 1), (2, 2)]

    x0 = p.glider_x0
    v0 = p.glider_v0
    y0 = x0 + v0

    for dx, dy in glider_rel:
        x = x0 + dx
        y = y0 + dy
        u = x % L
        v = y - x  # v = v0 + (dy - dx)

        if not (0 <= v < W):
            raise ValueError(
                f"Glider out of diagonal strip: (x,y)=({x},{y}) -> v={v} not in [0..{W-1}]. "
                f"Try a different glider_v0."
            )

        nodes[nid(u, v, W) - 1] = "B"

    return nodes


def build_edges_diagonal_strip_cylinder(p: Params) -> List[Tuple[int, int]]:
    """
    Moore neighborhood on diagonal strip:
      u' = (u + dx) mod L
      v' = v + (dy - dx)   (open boundary)
    """
    L, W = p.L, p.W
    edges: Set[Tuple[int, int]] = set()

    for u in range(L):
        for v in range(W):
            a = nid(u, v, W)
            for dx, dy in DELTAS_8:
                u2 = (u + dx) % L
                v2 = v + (dy - dx)
                if 0 <= v2 < W:
                    b = nid(u2, v2, W)
                    if a != b:
                        e = (a, b) if a < b else (b, a)
                        edges.add(e)

    return sorted(edges)


def assert_diagonal_strip_ok(edges: List[Tuple[int, int]], p: Params) -> None:
    """
    Sanity:
      - max degree <= 8
      - nodes not near width boundary (v=2..W-3) have degree 8
    """
    L, W = p.L, p.W
    n = L * W
    deg = compute_degrees(edges, n)

    mx = max(deg[1:])
    assert mx <= 8, f"diagonal_strip: max degree {mx} > 8 (bug)"

    if W >= 5:
        for u in range(L):
            for v in range(2, W - 2):
                node = nid(u, v, W)
                assert deg[node] == 8, f"diagonal_strip: node id={node} (u={u},v={v}) degree={deg[node]} != 8"


# -------------
# 2) Torus (grid)
# -------------

def generate_nodes_with_glider_torus(p: Params) -> List[str]:
    R, C = p.L, p.W
    nodes = ["A"] * (R * C)

    glider_rel = [(0, 1), (1, 2), (2, 0), (2, 1), (2, 2)]
    r0, c0 = p.torus_glider_r0, p.torus_glider_c0

    for dr, dc in glider_rel:
        r = (r0 + dr) % R
        c = (c0 + dc) % C
        nodes[nid(r, c, C) - 1] = "B"

    return nodes


def build_edges_torus(p: Params) -> List[Tuple[int, int]]:
    """
    Standard rectangular torus with Moore (8-neighbor) connectivity:
    wrap in both row and col => every node degree 8 (for R,C >= 3).
    """
    R, C = p.L, p.W
    edges: Set[Tuple[int, int]] = set()

    for r in range(R):
        for c in range(C):
            a = nid(r, c, C)
            for dr, dc in DELTAS_8:
                r2 = (r + dr) % R
                c2 = (c + dc) % C
                b = nid(r2, c2, C)
                if a != b:
                    e = (a, b) if a < b else (b, a)
                    edges.add(e)

    return sorted(edges)


def assert_torus_all_deg_8(edges: List[Tuple[int, int]], p: Params) -> None:
    R, C = p.L, p.W
    n = R * C
    deg = compute_degrees(edges, n)

    mn = min(deg[1:])
    mx = max(deg[1:])
    assert mn == 8 and mx == 8, f"torus: expected all degrees 8, got min={mn}, max={mx}"


# ----------------------------------------
# 3) NEW: Straight grid cylinder (wrap cols, open rows)
# ----------------------------------------

def generate_nodes_with_glider_cylinder_grid(p: Params) -> List[str]:
    """
    Cylinder on a standard (row,col) grid:
      - rows are open (no wrap)
      - cols are wrapped (c mod C)
    """
    R, C = p.L, p.W
    if R < 3 or C < 3:
        raise ValueError("Cylinder grid needs L>=3 and W>=3 for a normal Moore neighborhood.")

    nodes = ["A"] * (R * C)

    glider_rel = [(0, 1), (1, 2), (2, 0), (2, 1), (2, 2)]

    # Keep glider fully inside open-row boundaries
    r0 = min(max(0, p.cyl_glider_r0), R - 3)
    c0 = p.cyl_glider_c0 % C  # cols wrap

    for dr, dc in glider_rel:
        r = r0 + dr
        c = (c0 + dc) % C
        nodes[nid(r, c, C) - 1] = "B"

    return nodes


def build_edges_cylinder_grid(p: Params) -> List[Tuple[int, int]]:
    """
    Moore neighborhood on cylinder grid:
      r2 = r + dr must stay in [0..R-1] (open)
      c2 = (c + dc) mod C (wrapped)
    """
    R, C = p.L, p.W
    edges: Set[Tuple[int, int]] = set()

    for r in range(R):
        for c in range(C):
            a = nid(r, c, C)
            for dr, dc in DELTAS_8:
                r2 = r + dr
                if 0 <= r2 < R:
                    c2 = (c + dc) % C
                    b = nid(r2, c2, C)
                    if a != b:
                        e = (a, b) if a < b else (b, a)
                        edges.add(e)

    return sorted(edges)


def assert_cylinder_grid_ok(edges: List[Tuple[int, int]], p: Params) -> None:
    """
    Cylinder grid degrees:
      - max degree <= 8 always
      - expected degree depends on row (top/bottom have fewer neighbors because rows are open)

    Robust check: compute expected by counting DELTAS_8 that stay inside row bounds.
    """
    R, C = p.L, p.W
    n = R * C
    deg = compute_degrees(edges, n)

    mx = max(deg[1:])
    assert mx <= 8, f"cylinder_grid: max degree {mx} > 8 (bug)"

    for r in range(R):
        # expected degree depends only on whether r+dr stays in bounds (cols always wrap)
        expected = 0
        for dr, dc in DELTAS_8:
            r2 = r + dr
            if 0 <= r2 < R:
                expected += 1

        for c in range(C):
            node = nid(r, c, C)
            assert deg[node] == expected, (
                f"cylinder_grid: node id={node} (r={r},c={c}) degree={deg[node]} != expected={expected}"
            )


# ------------------------------------------
# 4) Rectangle quad mesh (4-neighbor) with optional hole
# ------------------------------------------

def in_hole(r: int, c: int, hole_r0: int, hole_c0: int, hole_h: int, hole_w: int) -> bool:
    if hole_h <= 0 or hole_w <= 0:
        return False
    return (hole_r0 <= r < hole_r0 + hole_h) and (hole_c0 <= c < hole_c0 + hole_w)


def generate_nodes_quad_mesh_with_hole(p: Params) -> Tuple[List[str], List[List[bool]]]:
    """
    Returns:
      nodes: length quad_L*quad_W, with 'A' for normal cells and '-' for hole cells (no node)
      hole_mask[r][c]: True iff that cell is a hole
    """
    L, W = p.quad_L, p.quad_W
    mask = [[False] * W for _ in range(L)]
    nodes = ["A"] * (L * W)

    for r in range(L):
        for c in range(W):
            if in_hole(r, c, p.hole_r0, p.hole_c0, p.hole_h, p.hole_w):
                mask[r][c] = True
                nodes[nid(r, c, W) - 1] = "-"  # hole marker: no node

    return nodes, mask


def build_edges_quad_mesh_with_hole(p: Params, hole_mask: List[List[bool]]) -> List[Tuple[int, int]]:
    """
    4-neighbor (quad mesh): connect right and down, skipping hole cells.
    Node ids remain row-major over the full L*W grid; hole ids exist but have degree 0.
    """
    L, W = p.quad_L, p.quad_W
    edges: Set[Tuple[int, int]] = set()

    def ok(r: int, c: int) -> bool:
        return 0 <= r < L and 0 <= c < W and (not hole_mask[r][c])

    for r in range(L):
        for c in range(W):
            if not ok(r, c):
                continue
            a = nid(r, c, W)

            # right
            if ok(r, c + 1):
                b = nid(r, c + 1, W)
                edges.add((a, b) if a < b else (b, a))
            # down
            if ok(r + 1, c):
                b = nid(r + 1, c, W)
                edges.add((a, b) if a < b else (b, a))

    return sorted(edges)


def assert_quad_mesh_degrees(edges: List[Tuple[int, int]], p: Params, hole_mask: List[List[bool]]) -> None:
    """
    Assert exact expected degree for every cell id:
      - hole cells => degree 0
      - normal cells => degree = number of orthogonal neighbors that are normal cells
    Also max degree must be <= 4.
    """
    L, W = p.quad_L, p.quad_W
    n = L * W
    deg = compute_degrees(edges, n)

    mx = max(deg[1:])
    assert mx <= 4, f"quad_mesh: max degree {mx} > 4 (bug)"

    def ok(r: int, c: int) -> bool:
        return 0 <= r < L and 0 <= c < W and (not hole_mask[r][c])

    for r in range(L):
        for c in range(W):
            node = nid(r, c, W)
            if not ok(r, c):
                assert deg[node] == 0, f"quad_mesh: hole cell id={node} has degree {deg[node]} != 0"
                continue

            exp = 0
            exp += 1 if ok(r - 1, c) else 0
            exp += 1 if ok(r + 1, c) else 0
            exp += 1 if ok(r, c - 1) else 0
            exp += 1 if ok(r, c + 1) else 0

            assert deg[node] == exp, f"quad_mesh: cell id={node} (r={r},c={c}) degree={deg[node]} != expected={exp}"


def main() -> None:
    p = Params(
        L=10, W=20,
        out_dir=Path("."),
        glider_x0=5, glider_v0=10,
        torus_glider_r0=5, torus_glider_c0=10,
        cyl_glider_r0=5, cyl_glider_c0=10,
        quad_L=10, quad_W=20,
        hole_r0=4, hole_c0=9, hole_h=0, hole_w=0,
    )
    p.out_dir.mkdir(parents=True, exist_ok=True)

    # 1) Diagonal strip cylinder
    nodes_strip = generate_nodes_with_glider_diagonal_strip(p)
    edges_strip = build_edges_diagonal_strip_cylinder(p)
    assert_diagonal_strip_ok(edges_strip, p)
    out_strip = p.out_dir / f"life_diagonal_strip_cylinder_L{p.L}_W{p.W}.yaml"
    write_yaml(
        out_strip,
        nodes_strip,
        edges_strip,
        header_lines=[
            "# Diagonal strip (cylinder) substrate for Conway Life (Moore 8-neighborhood).",
            f"# L={p.L} wrapped in u, W={p.W} open in v. Node id = u*W + v + 1.",
        ],
        per_line=p.W,
    )

    # 2) Torus grid
    nodes_torus = generate_nodes_with_glider_torus(p)
    edges_torus = build_edges_torus(p)
    assert_torus_all_deg_8(edges_torus, p)
    out_torus = p.out_dir / f"life_torus_R{p.L}_C{p.W}.yaml"
    write_yaml(
        out_torus,
        nodes_torus,
        edges_torus,
        header_lines=[
            "# Torus (rectangular grid) substrate for Conway Life (Moore 8-neighborhood).",
            f"# R={p.L}, C={p.W}, wrapped in both directions. Every node degree=8 (asserted).",
            "# Node id = row*C + col + 1.",
        ],
        per_line=p.W,
    )

    # 3) NEW: Straight grid cylinder (wrap columns, open rows)
    nodes_cyl = generate_nodes_with_glider_cylinder_grid(p)
    edges_cyl = build_edges_cylinder_grid(p)
    assert_cylinder_grid_ok(edges_cyl, p)
    out_cyl = p.out_dir / f"life_cylinder_R{p.L}_C{p.W}.yaml"
    write_yaml(
        out_cyl,
        nodes_cyl,
        edges_cyl,
        header_lines=[
            "# Cylinder (rectangular grid) substrate for Conway Life (Moore 8-neighborhood).",
            f"# R={p.L} open (no wrap), C={p.W} wrapped (c mod C).",
            "# Node id = row*C + col + 1.",
        ],
        per_line=p.W,
    )

    # 4) Rectangle quad mesh with optional hole
    nodes_quad, hole_mask = generate_nodes_quad_mesh_with_hole(p)
    edges_quad = build_edges_quad_mesh_with_hole(p, hole_mask)
    assert_quad_mesh_degrees(edges_quad, p, hole_mask)

    hole_tag = "no_hole" if (p.hole_h <= 0 or p.hole_w <= 0) else f"hole_r{p.hole_r0}_c{p.hole_c0}_h{p.hole_h}_w{p.hole_w}"
    out_quad = p.out_dir / f"rect_quad_mesh_L{p.quad_L}_W{p.quad_W}_{hole_tag}.yaml"
    write_yaml(
        out_quad,
        nodes_quad,
        edges_quad,
        header_lines=[
            "# Rectangle quad mesh (4-neighbor grid), open boundaries.",
            f"# L={p.quad_L}, W={p.quad_W}. Node id = row*W + col + 1.",
            "# Hole cells are marked with '-' and are NOT connected by edges (degree 0).",
            f"# Hole (0-based): r0={p.hole_r0}, c0={p.hole_c0}, h={p.hole_h}, w={p.hole_w}. "
            f"Set h=0 or w=0 for no hole.",
        ],
        per_line=p.quad_W,
    )

    print("Wrote:")
    print(f"  {out_strip}")
    print(f"  {out_torus}")
    print(f"  {out_cyl}")
    print(f"  {out_quad}")


if __name__ == "__main__":
    main()
