import * as d3 from 'd3';  
  
interface Node {  
  id: number;  
  x?: number;  
  y?: number;  
  vx?: number;  
  vy?: number;  
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
  { id: 1 },  
  { id: 2 }  
];  
  
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
    .attr("stroke", "black") // Add stroke color for visibility  
    .attr("stroke-width", 2) // Add stroke width for visibility  
    .merge(link);  
  
  // Remove old links  
  link.exit().remove();  
  
  // Bind data for nodes  
  const node = svg.selectAll<SVGCircleElement, Node>(".node")  
    .data(nodes, (d: Node) => d.id.toString());  
  
  // Enter new nodes  
  node.enter().append("circle")  
    .attr("class", "node")  
    .attr("r", 5)  
    .attr("fill", "red") // Add fill color for visibility  
    .merge(node);  
  
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
  
      node  
        .attr("cx", d => d.x!)  
        .attr("cy", d => d.y!);  
    });  
  
  simulation.force<d3.ForceLink<Node, Link>>("link")!  
    .links(links);  
}  
  
// Example function to simulate the unfolding process  
function unfoldGraph() {  
  console.log("Unfolding graph");  
  
  const newNode: Node = { id: nodes.length + 1 };  
  nodes.push(newNode);  
  links.push({ source: nodes[nodes.length - 2], target: newNode });  
  update();  
}  
  
// Initial update  
update();  
  
// Simulate unfolding every 2 seconds  
setInterval(unfoldGraph, 2000);  