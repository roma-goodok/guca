// utils.ts
import { NodeState, OperationKindEnum, GUMNode, RuleItem } from './gum';

// Default palette for node states (used when no per-state override is defined)
export const DEFAULT_PALETTE16: string[] = [
  'lightGray',     // 0
  'pink',          // 1
  'red',           // 2
  'orangeRed',     // 3
  'orange',        // 4
  'violet',        // 5
  'yellow',        // 6
  'lightGreen',    // 7
  'green',         // 8
  'lightSeaGreen', // 9
  'seaGreen',      // 10
  'lightBlue',     // 11
  'blue',          // 12
  'violet',        // 13
  'lightCyan',     // 14
  'violet',        // 15
];

// Backwards-compatible alias
export const PALETTE16 = DEFAULT_PALETTE16;

type StateColorMap = { [state: number]: string };

// In-memory per-state overrides: NodeState numeric → CSS color (e.g. "#ff00aa")
let STATE_COLOR_OVERRIDES: StateColorMap = {};

/** Return a shallow copy of all per-state color overrides. */
export function getAllStateColorOverrides(): StateColorMap {
  return { ...STATE_COLOR_OVERRIDES };
}

/** Replace all overrides at once (used by UI / localStorage restore). */
export function replaceStateColorOverrides(map: StateColorMap): void {
  STATE_COLOR_OVERRIDES = { ...map };
}

/** Set or clear an override for a given NodeState. */
export function setStateColorOverride(
  state: NodeState,
  color: string | null | undefined
): void {
  const key = Number(state);
  if (!color) {
    delete STATE_COLOR_OVERRIDES[key];
  } else {
    STATE_COLOR_OVERRIDES[key] = String(color);
  }
}

/** Read an override for a given NodeState, if any. */
export function getStateColorOverride(state: NodeState): string | undefined {
  return STATE_COLOR_OVERRIDES[Number(state)];
}


// Define the Node interface to represent a graph node with properties for position, velocity, force, and state.
export interface Node {
    id: number;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
    state: NodeState;
}

// Define the Link interface to represent a connection between two nodes in the graph.
export interface Link {
    source: number | Node;
    target: number | Node;
}

/**
 * Maps a string representation of an operation kind to its corresponding enum value.
 * @param kind - The string representation of the operation kind.
 * @returns The corresponding OperationKindEnum value.
 * @throws An error if the operation kind is unknown.
 */
export function mapOperationKind(kind: string): OperationKindEnum {
    switch (kind) {
      case "TurnToState": return OperationKindEnum.TurnToState;
      case "TryToConnectWithNearest": return OperationKindEnum.TryToConnectWithNearest;
      case "GiveBirthConnected": return OperationKindEnum.GiveBirthConnected;
      case "DisconnectFrom":
      case "DisconectFrom":      // legacy
        return OperationKindEnum.DisconectFrom;
      case "Die": return OperationKindEnum.Die;
      case "TryToConnectWith": return OperationKindEnum.TryToConnectWith;
      case "GiveBirth": return OperationKindEnum.GiveBirth;
      default: throw new Error(`Unknown operation kind: ${kind}`);
    }
  }
  

export function getVertexRenderColor(state: NodeState): string {
  const override = getStateColorOverride(state);
  if (override) return override;

  const paletteSize = DEFAULT_PALETTE16.length;
  const idx = ((Number(state) % paletteSize) + paletteSize) % paletteSize; // robust modulo
  return DEFAULT_PALETTE16[idx] ?? 'gray';
}

/**
 * Gets the text color used to render a vertex based on its state.
 * @param state - The state of the node.
 * @returns The text color corresponding to the node state.
 */
export function getVertexRenderTextColor(state: NodeState): string {
  const paletteSize = DEFAULT_PALETTE16.length;
  const idx = ((Number(state) % paletteSize) + paletteSize) % paletteSize;
  const darkColors = [2, 3, 5, 7, 0]; // indices in DEFAULT_PALETTE16 that are visually darker
  return darkColors.includes(idx) ? 'white' : 'black';
}


/**
 * Maps a string representation of a node state to its corresponding enum value.
 * @param state - The string representation of the node state.
 * @returns The corresponding NodeState enum value.
 */

export function mapNodeState(state: string): NodeState {
    if (state === 'any') return NodeState.Ignored;
    if (state === 'Unknown') return NodeState.Unknown;
    return NodeState[state as keyof typeof NodeState];
}
  

export function getNodeDisplayText(state: NodeState, id: number, debug: boolean): string {
    let letter = '';
    if (state >= NodeState.A && state <= NodeState.Z) {
        letter = String.fromCharCode(64 + state);
    }    
    return debug ? `${letter}/${id}` : letter;
}

/**
 * Maps an OperationKindEnum value to its corresponding string representation.
 * @param kind - The OperationKindEnum value.
 * @returns The string representation of the operation kind.
 */
export function mapOperationKindToString(kind: OperationKindEnum): string {
    switch (kind) {
        case OperationKindEnum.TurnToState:
            return 'TurnToState';
        case OperationKindEnum.TryToConnectWithNearest:
            return 'TryToConnectWithNearest';
        case OperationKindEnum.GiveBirthConnected:
            return 'GiveBirthConnected';
        case OperationKindEnum.DisconectFrom:
            return 'DisconectFrom';
        case OperationKindEnum.Die:
            return 'Die';
        case OperationKindEnum.TryToConnectWith:
            return 'TryToConnectWith';
        case OperationKindEnum.GiveBirth:
            return 'GiveBirth';
        default:
            return 'Unknown';
    }
}

export function edgeColorByStates(a: NodeState, b: NodeState): string {
    // Lower enum = higher priority (A preferred)
    const winner = Math.min(a, b);
    return getVertexRenderColor(winner as NodeState);
  }
  

/**
 * Maps a GUMNode object to a Node object used for visualization.
 * @param gumNode - The GUMNode object.
 * @returns The corresponding Node object.
 */
export function mapGUMNodeToNode(gumNode: GUMNode): Node {
    return {
        id: gumNode.id,
        x: gumNode.position?.x,
        y: gumNode.position?.y,
        vx: gumNode.velocity?.vx,
        vy: gumNode.velocity?.vy,
        fx: gumNode.force?.fx,
        fy: gumNode.force?.fy,
        state: gumNode.state,
    };
}

/**
 * Converts a list of RuleItem objects to a short-form string representation.
 * @param RuleItems - The list of RuleItem objects.
 * @returns A string representation of the change table items in short form.
 */
export function convertToShortForm(RuleItems: RuleItem[]): string {
    return RuleItems.map((item, index) => {
        const condition = item.condition;
        const operation = item.operation;

        const currentState = condition.currentState === NodeState.Unknown ? "+" : NodeState[condition.currentState];
        const priorState = condition.priorState === NodeState.Ignored ? '-' : (condition.priorState === NodeState.Unknown ? '+' : NodeState[condition.priorState]);
        const connectionsCountGE = condition.allConnectionsCount_GE !== -1 ? `c>=${condition.allConnectionsCount_GE}` : '';
        const connectionsCountLE = condition.allConnectionsCount_LE !== -1 ? `c<=${condition.allConnectionsCount_LE}` : '';
        const parentsCountGE = condition.parentsCount_GE !== -1 ? `p>=${condition.parentsCount_GE}` : '';
        const parentsCountLE = condition.parentsCount_LE !== -1 ? `p<=${condition.parentsCount_LE}` : '';

        // Separate the connections and parents conditions with a space
        const conditionStr = `${currentState}(${priorState}) ${connectionsCountGE} ${connectionsCountLE} ${parentsCountGE} ${parentsCountLE}`.trim().replace(/\s+/g, ' ');

        let operationStr = '';
        switch (operation.kind) {
            case OperationKindEnum.TurnToState:
                operationStr = NodeState[operation.operandNodeState];
                break;
            case OperationKindEnum.GiveBirthConnected:
                operationStr = `++${NodeState[operation.operandNodeState]}`;
                break;
            case OperationKindEnum.TryToConnectWithNearest:
                operationStr = `+N${NodeState[operation.operandNodeState]}`;
                break;
            case OperationKindEnum.DisconectFrom:
                operationStr = `-${NodeState[operation.operandNodeState]}`;
                break;
            case OperationKindEnum.Die:
                operationStr = `--`;
                break;
            case OperationKindEnum.TryToConnectWith:
                operationStr = `+${NodeState[operation.operandNodeState]}`;
                break;
            case OperationKindEnum.GiveBirth:
                operationStr = `+${NodeState[operation.operandNodeState]}`;
                break;
            default:
                operationStr = 'Unknown';
                break;
        }

        const isActiveInNodesStr = `` //`Is Active in: ${item.isActiveInNodes.join(', ')}`;

        // Format the rule item string with bold text if the item is active
        const ruleItemStr = `${index + 1}. ${conditionStr} : ${operationStr} ${isActiveInNodesStr}`;
        return item.isActive ? `<b>${ruleItemStr}</b>` : ruleItemStr;
    }).join('\n');
}

// --- Human-readable rule description (for tooltips) ---
export function nodeStateLetter(s: NodeState): string {
    if (s === NodeState.Unknown) return "Unknown";
    if (s === NodeState.Ignored) return "any";
    if (s >= NodeState.A && s <= NodeState.Z) return String.fromCharCode(64 + s);
    return String(s);
  }
  
  export function describeRuleHuman(item: RuleItem): string {
    const c = item.condition, o = item.operation;
    const cur = nodeStateLetter(c.currentState);
    const prior = nodeStateLetter(c.priorState);
    const parts: string[] = [];
  
    // degree/parents ranges
    const deg =
      (c.allConnectionsCount_GE >= 0 ? `c≥${c.allConnectionsCount_GE}` : "") +
      (c.allConnectionsCount_LE >= 0 ? `${parts.length ? "," : ""}c≤${c.allConnectionsCount_LE}` : "");
    const par =
      (c.parentsCount_GE >= 0 ? `p≥${c.parentsCount_GE}` : "") +
      (c.parentsCount_LE >= 0 ? `${(c.parentsCount_GE>=0) ? "," : ""}p≤${c.parentsCount_LE}` : "");
  
    if (deg) parts.push(deg);
    if (par) parts.push(par);
  
    const cond =
      `if current=${cur}` +
      (c.priorState !== NodeState.Ignored ? ` & prior=${prior}` : "") +
      (parts.length ? ` & ${parts.join(" & ")}` : "");
  
    const opState = nodeStateLetter(o.operandNodeState);
    let act = "";
    switch (o.kind) {
      case OperationKindEnum.TurnToState: act = `turn to ${opState}`; break;
      case OperationKindEnum.GiveBirthConnected: act = `give birth to ${opState} (connected)`; break;
      case OperationKindEnum.GiveBirth: act = `give birth to ${opState}`; break;
      case OperationKindEnum.TryToConnectWithNearest: act = `connect to nearest ${opState}`; break;
      case OperationKindEnum.TryToConnectWith: act = `connect to all ${opState}`; break;
      case OperationKindEnum.DisconectFrom: act = `disconnect from ${opState}`; break;
      case OperationKindEnum.Die: act = `die`; break;
      default: act = `do operation`;
    }
    return `${act} ${cond}`;
  }
  