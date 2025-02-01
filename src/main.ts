// main.ts
import * as d3 from 'd3';
import { GUMGraph, GUMNode, GraphUnfoldingMachine, NodeState, RuleItem, OperationCondition, Operation, OperationKindEnum } from './gum';
import { mapOperationKind, getVertexRenderColor, getVertexRenderTextColor, mapNodeState, getNodeDisplayText, mapOperationKindToString, mapGUMNodeToNode, convertToShortForm, Node, Link } from './utils';

// src/main.ts

// Add a global configuration object
const config = {
    debug: true, // Set this to true for debugging and false for production
  };

// Set the dimensions for the SVG container
const width = 960;
const height = 800;

const  widthRect = 300;

// Create an SVG container
const svg = d3.select("#canvas-container svg")
    .attr("width", "100%")
    .attr("height", height);

// Add a rectangle overlay to capture zoom events
const zoomOverlay = svg.append("rect")
    .attr("width", widthRect)
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

//(zoomOverlay as any).call(zoomBehavior as any);
(svg as any).call(zoomBehavior as any);

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

// Logical flag to control the simulation state
let isSimulationRunning = false;

// Immediately disable the "Resume" button
const pauseResumeButton = document.getElementById('pause-resume-button') as HTMLButtonElement;
pauseResumeButton.textContent = 'Start'; // Change initial text to 'Start'
pauseResumeButton.style.backgroundColor = 'lightgreen'; // Set button color to light green

/**
 * Load the genes library from a JSON file and populate the gene select dropdown.
 */
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


// Function to reset the zoom level
// Function to reset the zoom level
function resetZoom() {
    svg.call(
      (zoomBehavior as any).transform,
      d3.zoomIdentity as any // Explicitly cast to `any` to avoid type mismatch
    );
  }

/**
 * Load a specific gene into the Graph Unfolding Machine.
 * @param gene - The gene data to load.
 */
// src/main.ts

// Function to load a specific gene into the Graph Unfolding Machine
function loadGene(gene: any) {
    gumMachine.clearRuleTable();
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
      gumMachine.addRuleItem(new RuleItem(condition, operation));
    });
    resetGraph();

    
    // const nodeA = gumGraph.getNodes().find(node => node.id === 1);

    // if (nodeA) {

    //     const newNode2 = new GUMNode(nodes.length + 1, NodeState["C"]);
    //     gumGraph.addNode(newNode2);
    //     nodes.push({ id: newNode2.id, state: newNode2.state });

    //     const newNode3 = new GUMNode(nodes.length + 1, NodeState["B"]);
    //     gumGraph.addNode(newNode3);
    //     nodes.push({ id: newNode3.id, state: newNode3.state });

    //     const newNode4 = new GUMNode(nodes.length + 1, NodeState["B"]);
    //     gumGraph.addNode(newNode4);
    //     nodes.push({ id: newNode4.id, state: newNode4.state });

    //     gumGraph.addEdge(nodeA, newNode2);
    //     gumGraph.addEdge(newNode2, newNode4);
    //     gumGraph.addEdge(newNode3, newNode4);
    //     update();
    // }


    gumMachine.resetIterations();
    // Reset the pause/resume button text to 'Start'
    pauseResumeButton.textContent = 'Start';
    pauseResumeButton.style.backgroundColor = 'lightgreen';
    // Reset the zoom level
    resetZoom();
  }
/**
 * Update the graph visualization with the current nodes and links.
 */

// main.ts


/**
 * Adjust edge coordinates for node radius to ensure edges don't overlap with node circles.
 * @param source - The source node.
 * @param target - The target node.
 * @returns The adjusted coordinates for the edge.
 */

// src/main.ts

function adjustForRadius(source: Node, target: Node) {
  const radius = 12.5;
  const dx = target.x! - source.x!;
  const dy = target.y! - source.y!;
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

function populateComboBoxes() {
    const nodeIds = gumGraph.getNodes().map(node => node.id);

    populateComboBox('source-node', nodeIds);
    populateComboBox('target-node', nodeIds);
    populateComboBox('remove-node-id', nodeIds);
    populateComboBox('change-node-id', nodeIds);
    populateComboBox('disconnect-source-node', nodeIds);
    populateComboBox('disconnect-target-node', nodeIds);
    populateComboBox('connect-nearest-node', nodeIds);
  }


function update() {
  const gumNodes = gumGraph.getNodes();
  const gumEdges = gumGraph.getEdges();

  console.log('GUM Nodes:', gumNodes);
  console.log('GUM Edges:', gumEdges);

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

  links = gumEdges.map(gumEdge => {
      const sourceNode = nodes.find(node => node.id === gumEdge.source.id) as Node;
      const targetNode = nodes.find(node => node.id === gumEdge.target.id) as Node;
      return { source: sourceNode, target: targetNode };
  });

  console.log('D3 Nodes:', nodes);
  console.log('D3 Links:', links);

  const link = graphGroup.selectAll<SVGLineElement, Link>(".link")
      .data(links, d => `${(d.source as Node).id}-${(d.target as Node).id}`);

  const linkEnter = link.enter().append("line")
      .attr("class", "link")
      .attr("stroke-width", 2)
      .attr("stroke", 'lightBlue');

  linkEnter.merge(link)
      .attr("x1", d => adjustForRadius(d.source as Node, d.target as Node).x1)
      .attr("y1", d => adjustForRadius(d.source as Node, d.target as Node).y1)
      .attr("x2", d => adjustForRadius(d.source as Node, d.target as Node).x2)
      .attr("y2", d => adjustForRadius(d.source as Node, d.target as Node).y2)
      .attr("stroke", 'white');

  link.exit().remove();

  const node = graphGroup.selectAll<SVGGElement, Node>(".node")
      .data(nodes, d => d.id.toString());

  const nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .call(d3.drag<SVGGElement, Node>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));

  nodeEnter.append("circle")
      .attr("r", d => config.debug ? 20 : 12.5) // Double radius in debug mode
      .attr("fill", d => getVertexRenderColor(d.state));

  nodeEnter.append("text")
      .attr("dy", 3)
      .attr("dx", config.debug ? -10 : -6)
      .attr("fill", d => getVertexRenderTextColor(d.state))
      .text(d => getNodeDisplayText(d.state, d.id, config.debug));

  const mergedNodes = nodeEnter.merge(node);
  node.exit().remove();

  simulation.nodes(nodes).on("tick", () => {
      mergedNodes.select("circle")
          .attr("r", d => config.debug ? 20 : 12.5)
          .attr("cx", d => d.x!)
          .attr("cy", d => d.y!)
          .attr("fill", d => getVertexRenderColor(d.state));
      mergedNodes.select("text")
          .attr("x", d => d.x!)
          .attr("y", d => d.y!)
          .attr("fill", d => getVertexRenderTextColor(d.state))
          .text(d => getNodeDisplayText(d.state, d.id, config.debug));
      link
          .attr("x1", d => adjustForRadius(d.source as Node, d.target as Node).x1)
          .attr("y1", d => adjustForRadius(d.source as Node, d.target as Node).y1)
          .attr("x2", d => adjustForRadius(d.source as Node, d.target as Node).x2)
          .attr("y2", d => adjustForRadius(d.source as Node, d.target as Node).y2)
          .attr("stroke", d => {
              const maxState = Math.max((d.source as Node).state, (d.target as Node).state);
              return getVertexRenderColor(maxState);
          });
  });

  simulation.force<d3.ForceLink<Node, Link>>("link")!.links(links);
  simulation.alpha(0.5).restart();
  updateDebugInfo();

  // Populate combo boxes with the current nodes
  populateComboBoxes();

  // Manually trigger the tick event to force the positions to update
  simulation.tick();
}

/**
 * Update the debug information displayed on the page.
 */
function updateDebugInfo() {
    const ruleTableElement = document.getElementById('rule-table');
    const statusInfoElement = document.getElementById('status-info');

    if (!config.debug) {
        // Clear debug information if debugging is disabled
        const nodeCountElement = document.getElementById('node-count');
        const nodeDetailsElement = document.getElementById('node-details');
        const edgeDetailsElement = document.getElementById('edge-details');

        if (nodeCountElement) nodeCountElement.textContent = '';
        if (nodeDetailsElement) nodeDetailsElement.innerHTML = '';
        if (edgeDetailsElement) edgeDetailsElement.innerHTML = '';
    }

    // Always update the status info
    if (statusInfoElement) {
        statusInfoElement.textContent = `Nodes: ${nodes.length} | Edges: ${links.length} | Iterations: ${gumMachine.getIterations()}`;
    }

    // Always update the rule table information
    if (ruleTableElement) {
        const changeRuleItems = gumMachine.getRuleItems();
        const shortForm = convertToShortForm(changeRuleItems);
        ruleTableElement.innerHTML = `
        <h4>Rule Table (Short Form)</h4>
        <pre>${shortForm}</pre>`;
    }

    // If debugging is enabled, update the rest of the debug information
    if (config.debug) {
        const nodeCountElement = document.getElementById('node-count');
        const nodeDetailsElement = document.getElementById('node-details');
        const edgeDetailsElement = document.getElementById('edge-details');

        if (nodeCountElement) {
            nodeCountElement.textContent = `Nodes: ${nodes.length}`;
        }

        if (nodeDetailsElement) {
            const nodeDetails = gumGraph.getNodes().map(node =>
                `ID: ${node.id} | State: ${NodeState[node.state]} | Prior: ${NodeState[node.priorState]} | p: ${node.parentsCount} | c: ${node.connectionsCount}`
            ).join('\n');
            nodeDetailsElement.innerHTML = `<pre>${nodeDetails}</pre>`;
        }

        if (edgeDetailsElement) {
            const edgeDetails = gumGraph.getEdges().map(edge =>
                `Edge (${NodeState[edge.source.state]}/${edge.source.id}, ${NodeState[edge.target.state]}/${edge.target.id})`
                //`Edge from Node ${edge.source.id} (State: ${NodeState[edge.source.state]}) to Node ${edge.target.id} (State: ${NodeState[edge.target.state]})`
            ).join('\n');
            edgeDetailsElement.innerHTML = `<pre>${edgeDetails}</pre>`;
        }
    }
  }


/**
 * Unfold the graph using the Graph Unfolding Machine.
 */
function unfoldGraph() {
    if (!isSimulationRunning) {
        return;
    }

    simulation.tick();
    gumMachine.run();
    simulation.tick();
    update()
    simulation.tick();
    update();
}

/**
 * Reset the graph to its initial state with a single node.
 */
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

// Initialize the simulation interval slider correctly
const simulationIntervalSlider = document.getElementById('simulation-interval') as HTMLInputElement;
simulationIntervalSlider.value = '100';
document.getElementById('simulation-interval-value')!.textContent = '100';

simulationIntervalSlider.addEventListener('input', function () {
  const interval = (this as HTMLInputElement).value;
  simulationInterval = parseInt(interval, 10);
  document.getElementById('simulation-interval-value')!.textContent = interval;
});

/**
 * Update the display options for the graph visualization.
 * @param option - The selected display option.
 */
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

// Control button for the simulation
pauseResumeButton.addEventListener('click', () => {
    isSimulationRunning = !isSimulationRunning;
    if (isSimulationRunning) {
        simulationInterval = setInterval(unfoldGraph, parseInt((document.getElementById('simulation-interval') as HTMLInputElement).value, 10));
        pauseResumeButton.textContent = 'Pause';
        setControlsEnabled(false);
    } else {
        clearInterval(simulationInterval);
        pauseResumeButton.textContent = 'Resume';
        setControlsEnabled(true);
    }
});

document.getElementById('next-step-button')!.addEventListener('click', () => {
  if (!isSimulationRunning) {
    isSimulationRunning = true
    unfoldGraph();
    isSimulationRunning = false
  }
});


document.getElementById('connect-button')!.addEventListener('click', () => {
  const sourceId = (document.getElementById('source-node') as HTMLSelectElement).value;
  const targetId = (document.getElementById('target-node') as HTMLSelectElement).value;
  if (sourceId && targetId) {
    const sourceNode = gumGraph.getNodes().find(node => node.id === parseInt(sourceId, 10));
    const targetNode = gumGraph.getNodes().find(node => node.id === parseInt(targetId, 10));
    if (sourceNode && targetNode) {
      gumGraph.addEdge(sourceNode, targetNode);
      update();

    }
  }
});

document.getElementById('add-node-button')!.addEventListener('click', () => {
  const state = (document.getElementById('node-state') as HTMLSelectElement).value as keyof typeof NodeState;
  const newNode = new GUMNode(nodes.length + 1, NodeState[state]);
  gumGraph.addNode(newNode);
  nodes.push({ id: newNode.id, state: newNode.state });
  update();
});

document.getElementById('remove-node-button')!.addEventListener('click', () => {
  const nodeId = (document.getElementById('remove-node-id') as HTMLSelectElement).value;
  if (nodeId) {
    const nodeToRemove = gumGraph.getNodes().find(node => node.id === parseInt(nodeId, 10));
    if (nodeToRemove) {
      nodeToRemove.markedAsDeleted = true;
      gumGraph.removeMarkedNodes();
      nodes = nodes.filter(node => node.id !== nodeToRemove.id);
      update();
    }
  }
});

document.getElementById('change-node-state-button')!.addEventListener('click', () => {
    const nodeId = (document.getElementById('change-node-id') as HTMLSelectElement).value;
    const state = (document.getElementById('change-node-state') as HTMLSelectElement).value as keyof typeof NodeState;
    const node = gumGraph.getNodes().find(node => node.id === parseInt(nodeId, 10));
    if (node) {
      node.priorState = node.state;
      node.state = NodeState[state];
      update();
    }
});

document.getElementById('disconnect-button')!.addEventListener('click', () => {
const sourceId = (document.getElementById('disconnect-source-node') as HTMLSelectElement).value;
const targetId = (document.getElementById('disconnect-target-node') as HTMLSelectElement).value;
if (sourceId && targetId) {
    const sourceNode = gumGraph.getNodes().find(node => node.id === parseInt(sourceId, 10));
    const targetNode = gumGraph.getNodes().find(node => node.id === parseInt(targetId, 10));
    if (sourceNode && targetNode) {
    gumGraph.removeEdge(sourceNode, targetNode);
    update();
    }
}
});

document.getElementById('connect-nearest-button')!.addEventListener('click', () => {
const nodeId = (document.getElementById('connect-nearest-node') as HTMLSelectElement).value;
const state = (document.getElementById('connect-nearest-state') as HTMLSelectElement).value as keyof typeof NodeState;
const node = gumGraph.getNodes().find(node => node.id === parseInt(nodeId, 10));
if (node) {
    gumMachine.tryToConnectWithNearest(node, NodeState[state])    
    update();    
}
});

function populateStateComboBox(comboBoxId: string) {
  const comboBox = document.getElementById(comboBoxId) as HTMLSelectElement;
  comboBox.innerHTML = ''; // Clear existing options

  // Populate options with letters from A to Z
  for (let i = NodeState.A; i <= NodeState.Z; i++) {
    const option = document.createElement('option');
    option.value = NodeState[i];
    option.text = String.fromCharCode(64 + i); // Convert to corresponding letter
    comboBox.add(option);
  }
}

function populateComboBox(comboBoxId: string, items: number[]) {
  const comboBox = document.getElementById(comboBoxId) as HTMLSelectElement;
  comboBox.innerHTML = ''; // Clear existing options

  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item.toString();
    option.text = item.toString();
    comboBox.add(option);
  });
}

/**
 * Enable or disable controls based on the provided flag.
 * @param enabled - Whether to enable or disable the controls.
 */
function setControlsEnabled(enabled: boolean) {
    const controls = document.querySelectorAll('#display-options, #simulation-interval');
    controls.forEach(control => {
        (control as HTMLInputElement).disabled = !enabled;
    });
}

// Load the genes library and start the unfolding process
loadGenesLibrary().then(() => {
    //simulationInterval = setInterval(unfoldGraph, 2000);
    setControlsEnabled(false);
});

// Populate the state combo box with letters A to Z
populateStateComboBox('node-state');
populateStateComboBox('change-node-state');
populateStateComboBox('connect-nearest-state');


/**
 * Drag event handler for when the drag starts.
 * @param event - The drag event.
 * @param d - The node being dragged.
 */
function dragstarted(event: any, d: Node) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

/**
 * Drag event handler for when the node is being dragged.
 * @param event - The drag event.
 * @param d - The node being dragged.
 */
function dragged(event: any, d: Node) {
    d.fx = event.x;
    d.fy = event.y;
}

/**
 * Drag event handler for when the drag ends.
 * @param event - The drag event.
 * @param d - The node being dragged.
 */
function dragended(event: any, d: Node) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}