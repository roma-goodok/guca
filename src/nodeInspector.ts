// src/nodeInspector.ts
import { GUMNode, NodeState } from './gum';

function stateName(s: number): string {
  // @ts-ignore - enum reverse mapping
  return (NodeState as any)[s] ?? String(s);
}

export function formatNodeInspectorText(n: GUMNode): string {
  const liveState = stateName(n.state);
  const prior     = stateName(n.priorState);
  const saved     = stateName(n.getSavedCurrentState?.() ?? n.state);

  const liveDeg  = n.connectionsCount;
  const savedDeg = (n as any).savedDegree ?? liveDeg;

  const livePar  = n.parentsCount;
  const savedPar = (n as any).savedParents ?? livePar;

  return [
    `ID: ${n.id}`,
    `State: ${liveState}`,
    `Prior: ${prior}`,
    `Saved (for matching): ${saved}`,
    `Degree (live/saved): ${liveDeg} / ${savedDeg}`,
    `Parents (live/saved): ${livePar} / ${savedPar}`,
  ].join('\n');
}
