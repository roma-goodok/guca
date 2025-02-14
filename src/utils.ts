// utils.ts
import { NodeState, OperationKindEnum, GUMNode, RuleItem } from './gum';

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
        case "TurnToState":
            return OperationKindEnum.TurnToState;
        case "TryToConnectWithNearest":
            return OperationKindEnum.TryToConnectWithNearest;
        case "GiveBirthConnected":
            return OperationKindEnum.GiveBirthConnected;
        case "DisconectFrom":
            return OperationKindEnum.DisconectFrom;
        case "Die":
            return OperationKindEnum.Die;
        case "TryToConnectWith":
            return OperationKindEnum.TryToConnectWith;
        case "GiveBirth":
            return OperationKindEnum.GiveBirth;
        default:
            throw new Error(`Unknown operation kind: ${kind}`);
    }
}

/**
 * Gets the color used to render a vertex based on its state.
 * @param state - The state of the node.
 * @returns The color corresponding to the node state.
 */
export function getVertexRenderColor(state: NodeState): string {
    switch (state % 16) {
        case 1:
            return 'pink';
        case 2:
            return 'red';
        case 3:
            return 'orangeRed';
        case 4:
            return 'orange';
        case 5:
            return 'lightYellow';
        case 6:
            return 'yellow';
        case 7:
            return 'lightGreen';
        case 8:
            return 'green';
        case 9:
            return 'lightSeaGreen';
        case 10:
            return 'seaGreen';
        case 11:
            return 'lightBlue';
        case 12:
            return 'blue';
        case 13:
            return 'violet';
        case 14:
            return 'lightCyan';
        case 15:
            return 'white';
        case 0:
            return 'lightGray';
        default:
            return 'gray';
    }
}

/**
 * Gets the text color used to render a vertex based on its state.
 * @param state - The state of the node.
 * @returns The text color corresponding to the node state.
 */
export function getVertexRenderTextColor(state: NodeState): string {
    const darkColors = [2, 3, 5, 7, 0];
    return darkColors.includes(state % 16) ? 'white' : 'black';
  }

/**
 * Maps a string representation of a node state to its corresponding enum value.
 * @param state - The string representation of the node state.
 * @returns The corresponding NodeState enum value.
 */
export function mapNodeState(state: string): NodeState {
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