import * as d3 from 'd3';
import { GUMGraph, GUMNode, GraphUnfoldingMachine, NodeState, ChangeTableItem, OperationCondition, Operation, OperationKindEnum } from './gum';

// Interface definitions for Node and Link
interface Node {
  id: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null; // Add fx property for fixed x position
  fy?: number | null; // Add fy property for fixed y position
}

interface Link {
  source: number | Node;
  target: number | Node;
}

// Set up SVG canvas dimensions
const width = 960;
const height = 600;

// Create SVG element and append it to the body
const svg = d3.select("body").append("svg")
  .attr("width", width)
  .attr("height", height);

// Initialize force simulation
const simulation = d3.forceSimulation<Node, Link>()
  .force("link", d3.forceLink<Node, Link>()
    .id((d: Node) => d.id.toString())) // Set up link force
  .force("charge", d3.forceManyBody().strength(-400)) // Set up repulsive force
  .force("center", d3.forceCenter(width / 2, height / 2)); // Center the force

// Initial nodes with positions
let nodes: Node[] = [
  { id: 1, x: width / 2, y: height / 2 } // Initial single node in state A
];

// Initial links
let links: Link[] = [];

// Initialize GUMGraph and GraphUnfoldingMachine
const gumGraph = new GUMGraph();
const gumMachine = new GraphUnfoldingMachine(gumGraph);

// Add initial single node to GUMGraph
const initialNode = new GUMNode(1, NodeState.A);
gumGraph.addNode(initialNode);

// Function to load JSON genes library and select "HirsuteCircleGenom"
async function loadGenesLibrary() {
  try {
    const response = await fetch('data/demo_2010_dict_genes.json');
    const data = await response.json();
    const hirsuteCircleGenom = data.genes["HirsuteCircleGenom"];

    hirsuteCircleGenom.forEach((item: any) => {
      const condition = new OperationCondition(
        item.condition.currentState,
        item.condition.priorState,
        item.condition.allConnectionsCount_GE,
        item.condition.allConnectionsCount_LE,
        item.condition.parentsCount_GE,
        item.condition.parentsCount_LE
      );

      const operation = new Operation(
        mapOperationKind(item.operation.kind),
        item.operation.operandNodeState
      );

      gumMachine.addChangeTableItem(new ChangeTableItem(condition, operation));
    });

    console.log("Loaded HirsuteCircleGenom:", hirsuteCircleGenom);
  } catch (error) {
    console.error("Error loading genes library:", error);
  }
}

// Function to map the string representation of operation kind to the corresponding OperationKindEnum
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

// Function to update the graph visualization
function update() {
  console.log("Updating graph with nodes:", nodes);
  console.log("Updating graph with links:", links);

  // Bind data for links
  const link = svg.selectAll<SVGLineElement, Link>(".link")
    .data(links, (d: Link) => `${(d.source as Node).id}-${(d.target as Node).id}`);

  // Enter new links
  link.enter().append("line")
    .attr("class", "link")
    .attr("stroke", "black")
    .attr("stroke-width", 2)
    .merge(link);

  // Remove old links
  link.exit().remove();

  // Bind data for nodes
  const node = svg.selectAll<SVGGElement, Node>(".node")
    .data(nodes, (d: Node) => d.id.toString());

  // Enter new nodes
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

  // Merge new nodes with existing nodes
  const mergedNodes = nodeEnter.merge(node);

  // Remove old nodes
  node.exit().remove();

  // Update simulation nodes and links
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

  simulation.force<d3.ForceLink<Node, Link>>("link")!
    .links(links);

  // Restart the simulation to take into account new nodes and links
  simulation.alpha(1).restart(); // Change: Restart the simulation
}

// Function to add a new node and link to the graph
function unfoldGraph() {
  console.log("Unfolding graph");

  // Run the Graph Unfolding Machine
  gumMachine.run();

  // Get the updated nodes and edges from GUMGraph
  const gumNodes = gumGraph.getNodes();
  const gumEdges = gumGraph.getEdges();

  // Update nodes array
  nodes = gumNodes.map(gumNode => {
    // Position new nodes randomly around the center node
    const centerNode = nodes[0]; // Center node
    const angle = Math.random() * 2 * Math.PI; // Random angle
    const distance = Math.random() * 200; // Random distance within 200 pixels
    return {
      id: gumNode.id,
      x: centerNode.x! + distance * Math.cos(angle), // New node x position
      y: centerNode.y! + distance * Math.sin(angle) // New node y position
    };
  });

  // Update links array
  links = gumEdges.map(gumEdge => ({
    source: gumEdge.source.id,
    target: gumEdge.target.id
  }));

  update();
}

// Initial update of the graph
update();

// Load the JSON genes library and start the unfolding process
loadGenesLibrary().then(() => {
  // Add a new node and link every 2 seconds
  setInterval(unfoldGraph, 2000);
});

// Drag event handlers
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