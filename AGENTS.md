# AGENTS.md

## Project Snapshot
- Project: **GUCA (Graph Unfolding Cellular Automata)** interactive visualization.
- Stack: TypeScript + Webpack + Jest, browser runtime, 3D graph rendering (`3d-force-graph`, `d3`, `graphlib`).
- Purpose: simulate and visualize graph-based cellular automata genomes with real-time interaction.
- Key inputs: YAML genomes in `data/genoms/`.
- Main output: bundled frontend artifact in `dist/bundle.js`.

## Operating Mode
Tone: pragmatic, concise, action-oriented.  
Apply critical thinking and systems thinking.  
Remain open-minded about opportunities and persistent in follow-ups.  
Avoid overly enthusiastic wording.

## Repo Map (High Value Areas)
- `src/main.ts`: app entry point and UI wiring.
- `src/gum.ts`: core graph unfolding machine logic.
- `src/graph3d.ts`, `src/graphData.ts`: visualization/data adaptation layer.
- `src/genomeLoader.ts`: YAML genome parsing/loading defaults.
- `src/ruleEditor.ts`, `src/nodeInspector.ts`: interaction/editing tools.
- `src/__tests__/`: behavior and regression tests (Jest).
- `data/genoms/`: reusable genome presets and experiments.
- `docs/GENOME_GUIDE.md`: genome format and usage notes.

## Runbook
- Install deps: `npm ci` (fallback: `npm install`)
- Typecheck: `npm run typecheck`
- Test: `npm test`
- Full check: `npm run check`
- Build: `npm run build`
- Serve locally: `npm run start` (default `http://127.0.0.1:8080`)

## Agent Workflow
1. Read relevant files first; avoid speculative edits.
2. Keep changes minimal and localized to the request.
3. Preserve existing behavior unless change is explicitly requested.
4. Add/update tests for logic changes in `src/gum.ts`, loaders, or data transforms.
5. Run targeted checks first, then broader checks before handoff.
6. Report what changed, why, and how it was validated.

## Engineering Standards
- Prefer clear, deterministic logic over clever shortcuts.
- Keep TypeScript strictness and existing conventions.
- Avoid hidden side effects in simulation steps.
- Maintain backward compatibility for existing genome YAMLs unless requested otherwise.
- Do not introduce unnecessary dependencies.

## Git and Commit Behavior
- Do **not** commit by default.
- Commit only after explicit user acceptance/approval (for example: "accept", "approved", "commit").
- Before committing, provide a short change summary and validation results.
- Use focused, atomic commits (one logical change per commit).
- Do not rewrite history (`rebase -i`, `commit --amend`, force push) unless explicitly requested.

## Definition of Done (Per Task)
- Requested behavior implemented.
- Relevant tests pass (or failures clearly explained).
- Build/test commands run that match the scope of change.
- Risks, assumptions, and follow-ups are documented in handoff.
