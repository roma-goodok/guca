import * as d3 from 'd3';
import { GUMGraph, GUMNode, GraphUnfoldingMachine, NodeState, ChangeTableItem, OperationCondition, Operation, OperationKindEnum } from './gum';

interface Node {
  id: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: number | Node;
  target: number | Node;
}

const width = 960;
const height = 600;

const svg = d3.select("body").append("svg")
  .attr("width", width)
  .attr("height", height);

const simulation = d3.forceSimulation<Node, Link>()
  .force("link", d3.forceLink<Node, Link>()
    .id((d: Node) => d.id.toString()))
  .force("charge", d3.forceManyBody().strength(-400))
  .force("center", d3.forceCenter(width / 2, height / 2));

let nodes: Node[] = [
  { id: 1, x: width / 2, y: height / 2 }
];

let links: Link[] = [];

const gumGraph = new GUMGraph();
const gumMachine = new GraphUnfoldingMachine(gumGraph);

const initialNode = new GUMNode(1, NodeState.A);
gumGraph.addNode(initialNode);

function mapNodeState(state: string): NodeState {
  return NodeState[state as keyof typeof NodeState];
}

async function loadGenesLibrary() {
  try {
    const response = await fetch('data/demo_2010_dict_genes.json');
    const data = await response.json();
    const hirsuteCircleGenom = data.genes["debug"];

    hirsuteCircleGenom.forEach((item: any) => {
      const condition = new OperationCondition(
        mapNodeState(item.condition.currentState),
        mapNodeState(item.condition.priorState),
        item.condition.allConnectionsCount_GE,
        item.condition.allConnectionsCount_LE,
        item.condition.parentsCount_GE,
        item.condition.parentsCount_LE
      );

      const operation = new Operation(
        mapOperationKind(item.operation.kind),
        mapNodeState(item.operation.operandNodeState)
      );
      gumMachine.addChangeTableItem(new ChangeTableItem(condition, operation));
    });
    console.log("Loaded HirsuteCircleGenom:", hirsuteCircleGenom);
    updateDebugInfo();
  } catch (error) {
    console.error("Error loading genes library:", error);
  }
}

function mapOperationKind(kind: string): OperationKindEnum {
  switch (kind) {
    case "TurnToState": return OperationKindEnum.TurnToState;
    case "TryToConnectWithNearest": return OperationKindEnum.TryToConnectWithNearest;
    case "GiveBirthConnected": return OperationKindEnum.GiveBirthConnected;
    case "DisconectFrom": return OperationKindEnum.DisconectFrom;
    case "Die": return OperationKindEnum.Die;
    case "TryToConnectWith": return OperationKindEnum.TryToConnectWith;
    case "GiveBirth": return OperationKindEnum.GiveBirth;
    default: throw new Error(`Unknown operation kind: ${kind}`);
  }
}

function mapGUMNodeToNode(gumNode: GUMNode): Node {
  return {
    id: gumNode.id,
    x: gumNode.x,
    y: gumNode.y,
    vx: gumNode.vx,
    vy: gumNode.vy,
    fx: gumNode.fx,
    fy: gumNode.fy
  };
}

function update() {
  console.log("Updating graph with nodes:", nodes);
  console.log("Updating graph with links:", links);

  const link = svg.selectAll<SVGLineElement, Link>(".link")
    .data(links, d => `${d.source}-${d.target}`);

  link.enter().append("line")
    .attr("class", "link")
    .attr("stroke", "black")
    .attr("stroke-width", 2)
    .merge(link);

  link.exit().remove();

  const node = svg.selectAll<SVGGElement, Node>(".node")
    .data(nodes, d => d.id.toString());

  const nodeEnter = node.enter().append("g")
    .attr("class", "node")
    .call(d3.drag<SVGGElement, Node>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  nodeEnter.append("circle")
    .attr("r", 5)
    .attr("fill", "red");

  nodeEnter.append("text")
    .attr("dy", 3)
    .attr("dx", -3)
    .text(d => d.id.toString());

  const mergedNodes = nodeEnter.merge(node);

  node.exit().remove();

  simulation
    .nodes(nodes)
    .on("tick", () => {
      link
        .attr("x1", d => (d.source as Node).x!)
        .attr("y1", d => (d.source as Node).y!)
        .attr("x2", d => (d.target as Node).x!)
        .attr("y2", d => (d.target as Node).y!);

      mergedNodes.select("circle")
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);

      mergedNodes.select("text")
        .attr("x", d => d.x!)
        .attr("y", d => d.y!);
    });

  simulation.force<d3.ForceLink<Node, Link>>("link")!.links(links);

  simulation.alpha(1).restart();

  updateDebugInfo();
}

function updateDebugInfo() {
  const nodeCountElement = document.getElementById('node-count');
  const nodeDetailsElement = document.getElementById('node-details');
  const changeTableElement = document.getElementById('change-table');

  if (nodeCountElement) {
    nodeCountElement.textContent = `Nodes: ${nodes.length}`;
  }
  if (nodeDetailsElement) {
    const nodeDetails = gumGraph.getNodes().map(node => `
      <p>
        ID: ${node.id}<br>
        State: ${NodeState[node.state]}<br>
        Prior State: ${NodeState[node.priorState]}<br>
        Parents Count: ${node.parentsCount}<br>
        Connections Count: ${node.connectionsCount}
      </p>
    `).join('');
    nodeDetailsElement.innerHTML = nodeDetails;
  }
  if (changeTableElement) {
    const changeTableItems = gumMachine.getChangeTableItems();
    changeTableElement.textContent = `Change Table: ${JSON.stringify(changeTableItems, null, 2)}`;
  }
}

GraphUnfoldingMachine.prototype.getChangeTableItems = function() {
  return this.changeTable.items;
};

function unfoldGraph() {  
  console.log("Unfolding graph");  
  
  // Run the Graph Unfolding Machine  
  gumMachine.run();  
  
  // Get the updated nodes and edges from GUMGraph  
  const gumNodes = gumGraph.getNodes();  
  const gumEdges = gumGraph.getEdges();  
  
  console.log("Updated GUM nodes:", gumNodes);  
  console.log("Updated GUM edges:", gumEdges);  
  
  // Update nodes array  
  nodes = gumNodes.map(gumNode => {  
    let existingNode = nodes.find(node => node.id === gumNode.id);  
    if (!existingNode) {  
      const centerNode = nodes[0]; // Center node  
      const angle = Math.random() * 2 * Math.PI; // Random angle  
      const distance = Math.random() * 200; // Random distance within 200 pixels  
      existingNode = mapGUMNodeToNode(gumNode);  
      existingNode.x = centerNode.x! + distance * Math.cos(angle);  
      existingNode.y = centerNode.y! + distance * Math.sin(angle);  
    }  
    return existingNode;  
  });  
  
  console.log("Updated nodes array:", nodes);  
  
  // Update links array to reference node objects  
  links = gumEdges.map(gumEdge => {  
    const sourceNode = nodes.find(node => node.id === gumEdge.source.id) as Node;  
    const targetNode = nodes.find(node => node.id === gumEdge.target.id) as Node;  
    console.log(`Creating link from node ${sourceNode.id} to node ${targetNode.id}`);  
    return { source: sourceNode, target: targetNode };  
  });  
  
  console.log("Updated links array:", links);  
  
  update();  
}  

update();

loadGenesLibrary().then(() => {
  setInterval(unfoldGraph, 2000);
});

function dragstarted(event: any, d: Node) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event: any, d: Node) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragended(event: any, d: Node) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}