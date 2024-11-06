import * as d3 from 'd3';  
  
/**  
 * main.ts  
 *   
 * This file sets up a force-directed graph visualization using D3.js.  
 * The graph starts with two initial nodes and one link between them.  
 * Every 2 seconds, a new node is added to the graph, positioned randomly  
 * within 200 pixels of the center node, and linked only to the center node.  
 * The visualization updates dynamically to reflect the changes.  
 */  
  
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
  { id: 1, x: width / 2, y: height / 2 }, // Center node  
  { id: 2, x: width / 2 + 50, y: height / 2 + 50 } // Initial linked node  
];  
  
// Initial links  
let links: Link[] = [  
  { source: nodes[0], target: nodes[1] }  
];  
  
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
  
  const centerNode = nodes[0]; // Center node  
  const angle = Math.random() * 2 * Math.PI; // Random angle  
  const distance = Math.random() * 200; // Random distance within 200 pixels  
  const newNode: Node = {  
    id: nodes.length + 1,  
    x: centerNode.x! + distance * Math.cos(angle), // New node x position  
    y: centerNode.y! + distance * Math.sin(angle) // New node y position  
  };  
  
  nodes.push(newNode); // Add new node to nodes array  
  links.push({ source: centerNode, target: newNode }); // Link new node to center node  
  update(); // Update the graph visualization  
}  
  
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
  
// Initial update of the graph  
update();  
  
// Add a new node and link every 2 seconds  
setInterval(unfoldGraph, 2000);  