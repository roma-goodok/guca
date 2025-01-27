// gum.ts
// This module defines the core classes and logic for the Graph Unfolding Machine (GUM).
// It includes definitions for node states, operations, conditions, change table items, and the change table itself.
// The GUMNode and GUMGraph classes represent the nodes and graph structure, respectively.
// The GraphUnfoldingMachine class manages the graph unfolding process based on the change table and specified operations.
//
// Author of the code: AI Assistant
// Author of the ideas: Roman G.

import { Graph } from 'graphlib';

// Enumeration for different states a node can be in
export enum NodeState {
    Max = 255,
    Min = 0,
    Ignored = 0,
    Unknown = 254,
    A = 1, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z,
    s27 = 27, s28, s29, s30, s31, s32, s33, s34, s35, s36, s37, s38, s39, s40, s41, s42, s43, s44, s45, s46, s47, s48, s49,
    s50 = 50, s51, s52, s53, s54, s55, s56, s57, s58, s59, s60, s61, s62, s63, s64, s65, s66, s67, s68, s69, s70, s71, s72,
    s73 = 73, s74, s75, s76, s77, s78, s79, s80, s81, s82, s83, s84, s85, s86, s87, s88, s89, s90, s91, s92, s93, s94, s95,
    s96 = 96, s97, s98, s99, s100, s101, s102, s103, s104, s105, s106, s107, s108, s109, s110, s111, s112, s113, s114, s115,
    s116 = 116, s117, s118, s119, s120, s121, s122, s123, s124, s125, s126, s127, s128, s129, s130, s131, s132, s133, s134,
    s135 = 135, s136, s137, s138, s139, s140, s141, s142, s143, s144, s145, s146, s147, s148, s149, s150, s151, s152, s153,
    s154 = 154, s155, s156, s157, s158, s159, s160, s161, s162, s163, s164, s165, s166, s167, s168, s169, s170, s171, s172,
    s173 = 173, s174, s175, s176, s177, s178, s179, s180, s181, s182, s183, s184, s185, s186, s187, s188, s189, s190, s191,
    s192 = 192, s193, s194, s195, s196, s197, s198, s199, s200, s201, s202, s203, s204, s205, s206, s207, s208, s209, s210,
    s211 = 211, s212, s213, s214, s215, s216, s217, s218, s219, s220, s221, s222, s223, s224, s225, s226, s227, s228, s229,
    s230 = 230, s231, s232, s233, s234, s235, s236, s237, s238, s239, s240, s241, s242, s243, s244, s245, s246, s247, s248,
    s249 = 249, s250, s251, s252, s253
}

// Class representing an operation in the GUM
export class Operation {
    constructor(
        public kind: OperationKindEnum,
        public operandNodeState: NodeState = NodeState.Ignored
    ) { }
}

// Class representing a condition for an operation
export class OperationCondition {
    constructor(
        public currentState: NodeState,
        public priorState: NodeState = NodeState.Ignored,
        public allConnectionsCount_GE: number = -1,
        public allConnectionsCount_LE: number = -1,
        public parentsCount_GE: number = -1,
        public parentsCount_LE: number = -1
    ) { }
}


// Class representing a table of rules ("genom")
export class RuleTable {
  public items: RuleItem[] = [];

  add(item: RuleItem) {
    this.items.push(item);
  }

  find(node: GUMNode): RuleItem | null {
    for (const item of this.items) {
      const condition = item.condition;
      const currentStateMatches = condition.currentState === node.state || condition.currentState === NodeState.Ignored;
      const priorStateMatches = condition.priorState === node.priorState || condition.priorState === NodeState.Ignored;
      const connectionsCountMatches = (condition.allConnectionsCount_GE <= node.connectionsCount || condition.allConnectionsCount_GE === -1) &&
                                      (condition.allConnectionsCount_LE >= node.connectionsCount || condition.allConnectionsCount_LE === -1);
      const parentsCountMatches = (condition.parentsCount_GE <= node.parentsCount || condition.parentsCount_GE === -1) &&
                                  (condition.parentsCount_LE >= node.parentsCount || condition.parentsCount_LE === -1);

      if (currentStateMatches && priorStateMatches && connectionsCountMatches && parentsCountMatches) {
        return item;
      }
    }
    return null;
  }
}

// Class representing an item in the Rule Table ("gene")
export class RuleItem {
  constructor(
    public condition: OperationCondition,
    public operation: Operation,
    public isActive: boolean = false,
    public isEnabled: boolean = true,
    public lastActivationInterationIndex: number = -1,
    public isActiveInNodes: number[] = []
  ) {}
}

export class GUMNode {
  public connectionsCount = 0;
  public parentsCount = 0;
  public markedAsDeleted = false;
  public priorState = NodeState.Unknown;
  public position: { x: number; y: number } | null = null;
  public velocity: { vx: number; vy: number } | null = null;
  public force: { fx: number | null; fy: number | null } | null = null;

  protected savedCurrentState = NodeState.Unknown

  constructor(public id: number, public state: NodeState = NodeState.Unknown) { }

  updatePriorState() {
      this.priorState = this.savedCurrentState;
  }

  saveCurrentState() {
    this.savedCurrentState = this.state;
}
}

// Class representing the GUM graph
export class GUMGraph {
    private graph: Graph;

    constructor() {
        this.graph = new Graph({ directed: false });
    }

    addNode(node: GUMNode) {
        this.graph.setNode(node.id.toString(), node);
    }

    addEdge(source: GUMNode, target: GUMNode) {
        this.graph.setEdge(source.id.toString(), target.id.toString());
        source.connectionsCount++;
        target.connectionsCount++;
    }

    removeEdge(source: GUMNode, target: GUMNode) {
      this.graph.removeEdge(source.id.toString(), target.id.toString());
      source.connectionsCount--;
      target.connectionsCount--;
    }

    getNodes(): GUMNode[] {
        return this.graph.nodes().map(nodeId => this.graph.node(nodeId) as GUMNode);
    }

    getEdges(): { source: GUMNode; target: GUMNode }[] {
        return this.graph.edges().map(edge => ({
            source: this.graph.node(edge.v) as GUMNode,
            target: this.graph.node(edge.w) as GUMNode
        }));
    }

    removeMarkedNodes() {
        this.getNodes().forEach(node => {
            if (node.markedAsDeleted) {
                this.graph.removeNode(node.id.toString());
            }
        });
    }

    areNodesConnected(node1: GUMNode, node2: GUMNode): boolean {
        return this.graph.hasEdge(node1.id.toString(), node2.id.toString());
    }
}

// Enumeration for different kinds of operations in the GUM
export enum OperationKindEnum {
    TurnToState = 0x0,
    TryToConnectWithNearest = 0x1,
    GiveBirthConnected = 0x2,
    DisconectFrom = 0x3,
    Die = 0x4,
    TryToConnectWith = 0x5,
    GiveBirth = 0x6,
}

export class GraphUnfoldingMachine {
  public ruleTable: RuleTable;
  private iterations = 0;

  constructor(private graph: GUMGraph) {
    this.ruleTable = new RuleTable();
  }

  addRuleItem(item: RuleItem) {
    this.ruleTable.add(item);
  }

  getRuleItems() {
    return this.ruleTable.items;
  }

  clearRuleTable() {
    this.ruleTable.items = [];
  }

  run() {
    this.ruleTable.items.forEach(item => {
      item.isActive = false;
      item.isActiveInNodes = [];
    });

    const nodes = this.graph.getNodes().slice();
    for (const node of nodes) {
      node.saveCurrentState()
      const item = this.ruleTable.find(node);
      if (item && item.isEnabled) {
        this.performOperation(node, item.operation);
        item.isActive = true;
        item.lastActivationInterationIndex++;
        item.isActiveInNodes.push(node.id);
      }
      node.updatePriorState()
    }
    this.iterations++;
    this.graph.removeMarkedNodes();
  }

  private performOperation(node: GUMNode, operation: Operation) {
    switch (operation.kind) {
      case OperationKindEnum.TurnToState:
        
        node.state = operation.operandNodeState;
        break;
      case OperationKindEnum.GiveBirthConnected:
        this.giveBirthConnected(node, operation.operandNodeState);
        break;
      case OperationKindEnum.DisconectFrom:
        this.disconnectFrom(node, operation.operandNodeState);
        break;
      case OperationKindEnum.TryToConnectWithNearest:
        this.tryToConnectWithNearest(node, operation.operandNodeState);
        break;
      case OperationKindEnum.Die:
        this.die(node);
        break;
      case OperationKindEnum.TryToConnectWith:
        this.tryToConnectWith(node, operation.operandNodeState);
        break;
      case OperationKindEnum.GiveBirth:
        this.giveBirth(node, operation.operandNodeState);
        break;
      default:
        break;
    }
  }

  private giveBirthConnected(node: GUMNode, state: NodeState) {
      const newNode = new GUMNode(this.graph.getNodes().length + 1, state);
      newNode.parentsCount = node.parentsCount + 1;
      this.graph.addNode(newNode);
      this.graph.addEdge(node, newNode);
  }

  private disconnectFrom(node: GUMNode, state: NodeState) {  
    const edgesToRemove = this.graph.getEdges().filter(edge =>   
        (edge.source === node && edge.target.state === state) ||  
        (edge.target === node && edge.source.state === state)  
    );  
    edgesToRemove.forEach(edge => {  
        this.graph.removeEdge(edge.source, edge.target);  
    });  
  }
  
  private findNearest(node: GUMNode, state: NodeState): GUMNode | null {  
      const visited = new Set<GUMNode>();  
      const queue: {node: GUMNode, distance: number}[] = [{node, distance: 0}];  
        
      while (queue.length > 0) {  
          const {node: currentNode, distance} = queue.shift()!;  
          if (currentNode.state === state && currentNode !== node) {  
              return currentNode;  
          }  
          visited.add(currentNode);  
          this.graph.getEdges().forEach(edge => {  
              const neighbor = edge.source === currentNode ? edge.target : edge.source;  
              if (!visited.has(neighbor)) {  
                  queue.push({node: neighbor, distance: distance + 1});  
              }  
          });  
      }  
      return null;  
  }  
  
  private tryToConnectWithNearest(node: GUMNode, state: NodeState) {  
      const nearestNode = this.findNearest(node, state);  
      if (nearestNode && !this.graph.areNodesConnected(node, nearestNode)) {  
          this.graph.addEdge(node, nearestNode);  
      }  
  }  

  private die(node: GUMNode) {
      node.markedAsDeleted = true;
  }

  private tryToConnectWith(node: GUMNode, state: NodeState) {
      const targetNode = this.graph.getNodes().find(n => n.state === state && n.id !== node.id);
      if (targetNode && !this.graph.areNodesConnected(node, targetNode)) {
          this.graph.addEdge(node, targetNode);
      }
  }

  private giveBirth(node: GUMNode, state: NodeState) {
      const newNode = new GUMNode(this.graph.getNodes().length + 1, state);
      newNode.parentsCount = node.parentsCount + 1;
      this.graph.addNode(newNode);
  }

  getIterations() {
      return this.iterations;
  }

  resetIterations() {
      this.iterations = 0;
  }
}