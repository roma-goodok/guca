// utils.ts

import { NodeState, OperationKindEnum, GUMNode, ChangeTableItem } from './gum';

// Define the Node interface in utils.ts
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

// Interface for Link
export interface Link {
    source: number | Node;
    target: number | Node;
  }

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

export function getVertexRenderTextColor(state: NodeState): string {
  switch (state % 16) {
    case 2:
    case 3:
    case 5:
    case 7:
    case 0:
      return 'white';
    default:
      return 'black';
  }
}

export function mapNodeState(state: string): NodeState {
  return NodeState[state as keyof typeof NodeState];
}

export function nodeStateToLetter(state: NodeState): string {
  if (state >= NodeState.A && state <= NodeState.Z) {
    return String.fromCharCode(64 + state);
  }
  return '';
}

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

export function mapGUMNodeToNode(gumNode: GUMNode): Node {
  return {
    id: gumNode.id,
    x: gumNode.x,
    y: gumNode.y,
    vx: gumNode.vx,
    vy: gumNode.vy,
    fx: gumNode.fx,
    fy: gumNode.fy,
    state: gumNode.state,
  };
}

export function convertToShortForm(changeTableItems: ChangeTableItem[]): string {
  return changeTableItems.map((item, index) => {
    const condition = item.condition;
    const operation = item.operation;

    const currentState = condition.currentState === NodeState.Unknown ? "+" : NodeState[condition.currentState];
    const priorState = condition.priorState === NodeState.Ignored ? '-' : (condition.priorState === NodeState.Unknown ? '+' : NodeState[condition.priorState]);
    const connectionsCountGE = condition.allConnectionsCount_GE !== -1 ? `c>=${condition.allConnectionsCount_GE}` : '';
    const connectionsCountLE = condition.allConnectionsCount_LE !== -1 ? `c<=${condition.allConnectionsCount_LE}` : '';
    const parentsCountGE = condition.parentsCount_GE !== -1 ? `p>=${condition.parentsCount_GE}` : '';
    const parentsCountLE = condition.parentsCount_LE !== -1 ? `p<=${condition.parentsCount_LE}` : '';

    const conditionStr = `${currentState}(${priorState})${connectionsCountGE}${connectionsCountLE}${parentsCountGE}${parentsCountLE}`;
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

    return `${index + 1}. ${conditionStr} : ${operationStr}`;
  }).join('\n');
}