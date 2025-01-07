import * as d3 from 'd3';
import {
  GUMGraph,
  GUMNode,
  GraphUnfoldingMachine,
  NodeState,
  ChangeTableItem,
  OperationCondition,
  Operation,
  OperationKindEnum
} from './gum';
import {
  mapOperationKind,
  getVertexRenderColor,
  getVertexRenderTextColor,
  mapNodeState,
  nodeStateToLetter,
  mapOperationKindToString,
  mapGUMNodeToNode,
  convertToShortForm,
  Node,
  Link
} from './utils';

// Set the dimensions for the SVG container
const width = 960;
const height = 960;

// Create an SVG container
const svg = d3.select("#canvas-container svg")
  .attr("width", width)
  .attr("height", height);

// Add a rectangle overlay to capture zoom events
const zoomOverlay = svg.append("rect")
  .attr("width", width)
  .attr("height", height)
  .attr("fill", "none")
  .attr("pointer-events", "all");

const graphGroup = svg.append("g");

// Add zoom behavior to the overlay
const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
  .scaleExtent([0.01, 10])
  .on("zoom", (event) => {
    graphGroup.attr("transform", event.transform);
  });

(zoomOverlay as any).call(zoomBehavior as any);

// Initialize the force simulation
const simulation = d3.forceSimulation<Node, Link>()
  .force("link", d3.forceLink<Node, Link>()
    .id((d: Node) => d.id.toString())
    .distance(50))
  .force("charge", d3.forceManyBody().strength(-300))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .velocityDecay(0.2);

// Initialize nodes and links arrays
let nodes: Node[] = [{ id: 1, x: width / 2, y: height / 2, state: NodeState.A }];
let links: Link[] = [];

// Initialize GUM graph and machine
const gumGraph = new GUMGraph();
const gumMachine = new GraphUnfoldingMachine(gumGraph);

// Add an initial node to the GUM graph
const initialNode = new GUMNode(1, NodeState.A);
gumGraph.addNode(initialNode);

// Load the genes library from a JSON file
async function loadGenesLibrary() {
  try {
    const response = await fetch('data/demo_2010_dict_genes.json');
    const data = await response.json();
    const geneSelect = document.getElementById('gene-select') as HTMLSelectElement;

    for (const geneName in data.genes) {
      const option = document.createElement('option');
      option.value = geneName;
      option.text = geneName;
      geneSelect.add(option);
    }

    loadGene(data.genes[geneSelect.value]);
    geneSelect.addEventListener('change', (event) => {
      const selectedGene = (event.target as HTMLSelectElement).value;
      loadGene(data.genes[selectedGene]);
    });
    updateDebugInfo();
  } catch (error) {
    console.error("Error loading genes library:", error);
  }
}

// Function to load a specific gene
function loadGene(gene: any) {
  gumMachine.clearChangeTable();
  gene.forEach((item: any) => {
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
  resetGraph();
}

function update() {
  console.log("Updating graph with nodes:", nodes);
  console.log("Updating graph with links:", links);

  // Bind data for links
  const link = graphGroup.selectAll<SVGLineElement, Link>(".link")
    .data(links, d => `${(d.source as Node).id}-${(d.target as Node).id}`);

  // Enter new links
  link.enter().append("line")
    .attr("class", "link")
    .attr("stroke-width", 2)
    .merge(link);

  // Update existing links
  link
    .attr("x1", d => adjustForRadius(d.source as Node, d.target as Node).x1)
    .attr("y1", d => adjustForRadius(d.source as Node, d.target as Node).y1)
    .attr("x2", d => adjustForRadius(d.source as Node, d.target as Node).x2)
    .attr("y2", d => adjustForRadius(d.source as Node, d.target as Node).y2)
    .attr("stroke", d => {
      const maxState = Math.max((d.source as Node).state, (d.target as Node).state);
      return getVertexRenderColor(maxState);
    });

  // Remove old links
  link.exit().remove();

  // Bind data for nodes
  const node = graphGroup.selectAll<SVGGElement, Node>(".node")
    .data(nodes, d => d.id.toString());

  // Enter new nodes
  const nodeEnter = node.enter().append("g")
    .attr("class", "node")
    .call(d3.drag<SVGGElement, Node>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  nodeEnter.append("circle")
    .attr("r", 12.5)
    .attr("fill", d => getVertexRenderColor(d.state));

  nodeEnter.append("text")
    .attr("dy", 3)
    .attr("dx", -3)
    .attr("fill", d => getVertexRenderTextColor(d.state))
    .text(d => nodeStateToLetter(d.state));

  // Merge new nodes with existing nodes
  const mergedNodes = nodeEnter.merge(node);

  // Remove old nodes
  node.exit().remove();

  // Update simulation nodes and links
  simulation.nodes(nodes).on("tick", () => {
    link
      .attr("x1", d => adjustForRadius(d.source as Node, d.target as Node).x1)
      .attr("y1", d => adjustForRadius(d.source as Node, d.target as Node).y1)
      .attr("x2", d => adjustForRadius(d.source as Node, d.target as Node).x2)
      .attr("y2", d => adjustForRadius(d.source as Node, d.target as Node).y2)
      .attr("stroke", d => {
        const maxState = Math.max((d.source as Node).state, (d.target as Node).state);
        return getVertexRenderColor(maxState);
      });

    mergedNodes.select("circle")
      .attr("cx", d => d.x!)
      .attr("cy", d => d.y!)
      .attr("fill", d => getVertexRenderColor(d.state));

    mergedNodes.select("text")
      .attr("x", d => d.x!)
      .attr("y", d => d.y!)
      .attr("fill", d => getVertexRenderTextColor(d.state))
      .text(d => nodeStateToLetter(d.state));
  });
  simulation.force<d3.ForceLink<Node, Link>>("link")!.links(links);
  simulation.alpha(0.5).restart();
  updateDebugInfo();
}

// Helper function to adjust edge coordinates for node radius
function adjustForRadius(source: Node, target: Node) {
  const radius = 12.5;
  const dx = target.x! - source.x!;
  const dy = target.y! - source.x!;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const padding = radius;

  const ratio = (distance - padding) / distance;
  return {
    x1: source.x! + dx * (padding / distance),
    y1: source.y! + dy * (padding / distance),
    x2: target.x! - dx * (padding / distance),
    y2: target.y! - dy * (padding / distance),
  };
}

// Update the debug information displayed on the page
function updateDebugInfo() {
  const nodeCountElement = document.getElementById('node-count');
  const nodeDetailsElement = document.getElementById('node-details');
  const changeTableElement = document.getElementById('change-table');
  const statusInfoElement = document.getElementById('status-info');

  if (nodeCountElement) {
    nodeCountElement.textContent = `Nodes: ${nodes.length}`;
  }
  if (nodeDetailsElement) {
    const nodeDetails = gumGraph.getNodes().slice(0, 5).map(node => `
      <p>
        ID: ${node.id} | State: ${NodeState[node.state]} | Prior: ${NodeState[node.priorState]} | p: ${node.parentsCount} | c: ${node.connectionsCount}
      </p>
    `).join('');
    nodeDetailsElement.innerHTML = nodeDetails;
  }
  if (changeTableElement) {
    const changeTableItems = gumMachine.getChangeTableItems();
    const shortForm = convertToShortForm(changeTableItems);

    const changeTableItemsForJson = changeTableItems.map(item => ({
      condition: {
        currentState: NodeState[item.condition.currentState],
        priorState: item.condition.priorState === NodeState.Ignored ? '-' : NodeState[item.condition.priorState],
        allConnectionsCount_GE: item.condition.allConnectionsCount_GE,
        allConnectionsCount_LE: item.condition.allConnectionsCount_LE,
        parentsCount_GE: item.condition.parentsCount_GE,
        parentsCount_LE: item.condition.parentsCount_LE
      },
      operation: {
        kind: mapOperationKindToString(item.operation.kind),
        operandNodeState: NodeState[item.operation.operandNodeState]
      },
      isActive: item.isActive,
      isEnabled: item.isEnabled,
      lastActivationInterationIndex: item.lastActivationInterationIndex
    }));
    const rawJson = JSON.stringify(changeTableItemsForJson, null, 2);
    changeTableElement.innerHTML = `
      <h4>Change Table (Short Form)</h4>
      <pre>${shortForm}</pre>
      <details>
        <summary>Raw JSON (collapsed)</summary>
        <pre>${rawJson}</pre>
      </details>
    `;
  }
  if (statusInfoElement) {
    statusInfoElement.textContent = `Nodes: ${nodes.length} | Edges: ${links.length} | Iterations: ${gumMachine.getIterations()}`;
  }
}

// Unfold the graph using the Graph Unfolding Machine
function unfoldGraph() {
  console.log("Unfolding graph");

  gumMachine.run();
  const gumNodes = gumGraph.getNodes();
  const gumEdges = gumGraph.getEdges();

  console.log("Updated GUM nodes:", gumNodes);
  console.log("Updated GUM edges:", gumEdges);

  nodes = gumNodes.map(gumNode => {
    let existingNode = nodes.find(node => node.id === gumNode.id);
    if (!existingNode) {
      const centerNode = nodes[0];
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * 200;
      existingNode = mapGUMNodeToNode(gumNode);
      existingNode.x = centerNode.x! + distance * Math.cos(angle);
      existingNode.y = centerNode.y! + distance * Math.sin(angle);
    } else {
      existingNode.state = gumNode.state;
    }
    return existingNode;
  });

  console.log("Updated nodes array:", nodes);
  links = gumEdges.map(gumEdge => {
    const sourceNode = nodes.find(node => node.id === gumEdge.source.id) as Node;
    const targetNode = nodes.find(node => node.id === gumEdge.target.id) as Node;
    console.log(`Creating link from node ${sourceNode.id} to node ${targetNode.id}`);
    return { source: sourceNode, target: targetNode };
  });

  console.log("Updated links array:", links);
  update();
}

// Function to reset the graph to its initial state with a single node
function resetGraph() {
  nodes = [{ id: 1, x: width / 2, y: height / 2, state: NodeState.A }];
  links = [];
  gumGraph.getNodes().forEach(node => node.markedAsDeleted = true);
  gumGraph.removeMarkedNodes();
  gumGraph.addNode(new GUMNode(1, NodeState.A));
  update();
}

// Add event listeners for the combo box and slider
document.getElementById('display-options')!.addEventListener('change', function () {
  const displayOption = (this as HTMLSelectElement).value;
  updateDisplay(displayOption);
});

document.getElementById('simulation-interval')!.addEventListener('input', function () {
  const interval = (this as HTMLInputElement).value;
  simulationInterval = parseInt(interval, 10);
  document.getElementById('simulation-interval-value')!.textContent = interval;
  resetGraph();
});

function updateDisplay(option: string) {
  const displayEdges = option === 'edges' || option === 'both';
  const displayNodes = option === 'nodes' || option === 'both';

  d3.selectAll('.link').style('display', displayEdges ? 'block' : 'none');
  d3.selectAll('.node').style('display', displayNodes ? 'block' : 'none');
}

// Initialize default display options
updateDisplay('edges');

// Variable to store the interval for unfolding the graph
let simulationInterval: any;

// Start the simulation with the default interval
simulationInterval = setInterval(unfoldGraph, 500);

// Drag event handlers for D3 nodes
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

// Function to enable/disable controls
function setControlsEnabled(enabled: boolean) {
  const controls = document.querySelectorAll('#display-options, #simulation-interval');
  controls.forEach(control => {
    (control as HTMLInputElement).disabled = !enabled;
  });
}

// Control buttons for the simulation
const pauseButton = document.getElementById('pause-button')!;
pauseButton.addEventListener('click', () => {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = undefined;
  }
  setControlsEnabled(true);
});

const resumeButton = document.getElementById('resume-button')!;
resumeButton.addEventListener('click', () => {
  if (!simulationInterval) {
    simulationInterval = setInterval(unfoldGraph, parseInt((document.getElementById('simulation-interval') as HTMLInputElement).value, 10));
  }
  setControlsEnabled(false);
});

// Initial update of the graph
update();

// Load the genes library and start the unfolding process
loadGenesLibrary().then(() => {
  simulationInterval = setInterval(unfoldGraph, 500);
  setControlsEnabled(false);
});