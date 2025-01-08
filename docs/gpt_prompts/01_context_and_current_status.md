# Project Description
VOGUE: Visualization of Ontogeny in Graph Unfolding Evolution


## Project Vision
The purpose of the VOGUE project is to create an interactive web application for animated visualization of graph unfolding cellular automata (ontogeny) driven by a "program" calculated by a genetic algorithm, along with graph manipulation commands. Users should be able to interact with the graph, add and remove vertices and edges, and visualize the changes in real-time. The graph layout will be updated using a force-directed algorithm that can be extended to 3D.

## Main Idea
The main idea behind VOGUE is to provide an interactive platform for visualizing the ontogeny of graph unfolding cellular automata based on a "program" calculated by a genetic algorithm. Users will be able to manipulate the graph and observe the unfolding process in real-time, providing a unique and engaging way to explore and analyze cellular automata.

## Requirements
- Animated visualization of graph unfolding cellular automata based on a genetic algorithm.
- Interactive graph visualization with real-time updates.
- Support for adding, removing, and updating vertices and edges.
- Implementation of a force-directed layout algorithm, extendable to 3D.
- A virtual "knife" mouse tool for cutting edges interactively.
- Smooth and responsive user experience.

## Components and Selected Frameworks
### Frontend
Visualize with some interactivity. Users can also select "genes" from a combo box or upload them as a JSON file.
Framework and Libraries: TypeScript with D3.js. Motivation: for rapid development.

### Backend (of Web Application)
To log user experience and upload genes from a genes database.

### Graph Evolution Lab
Offline application or scripts to develop graph evolution algorithms and conduct experiments with possible reuse of web-based visualization. Some resulting genes can be published to the Frontend (at least by hardcoded gene codes).
Frameworks: Python with high parallelization on multicore CPU (Threadripper) and/or GPU.

# Current Status
I already have old (2010-2014) working code (GUCA project) but it's not web-oriented and implemented in C#.

## Milestones
M1: Frontend MVP (more or less attractive): can interactively visualize just a few hardcoded genes (can be selected). The Graph Unfolding Machine (which implements graph unfolding cellular automata) should be implemented in TypeScript.

M2: Graph Evolution Lab - implement the first version of the evolution algorithm and reproduce some old experiments using CPU parallelization.

M3: Make Frontend more attractive and ready to publish.

M4: Improve Graph Evolution Lab to conduct experiments faster and more conveniently, reproducibly (using ClearML for experiment tracking and visualization).

M5: Prepare a public project's web page (e.g., GitHub Pages)
- Article
- Source code published
- Examples of visualization

## TODO List
### Frontend
#### Initialization
- [x] Display interactive graph (hardcoded very simple iterative node creation)
- [x] Familiarize with web development (TypeScript)

#### MVP
Display interactive growing graph (arbitrary "genes"). The viewer of the interactive growing graph can select "genes" from the predefined library (combo box) or upload them via JSON.
- [x] Refresh the rules of GUCA
- [x] Propose a JSON format
- [x] Convert old (2010) "genes" from XML to JSON
- [x] Prepare a very simple "gene," e.g., "[ ]"
- [ ] GraphUnfoldingMachine - which executes a "gene" modifying the graph. The modified graph should be visualized simultaneously as it grows.
The previous task is almost complete, but there are some issues:
1. Currently, the GUM operates by directly looping over the list of nodes. When new nodes are created, they are added to the list, altering the graph's conditions before the loop ends. We should adopt the logic from the old C# code and the concept of cellular automata, which involves two steps:
First, perceive (detect the state and neighbors for each cell).
Then, act.
Therefore, condition matching should consider the state of the graph before the loop.
2. Let's make the page more aesthetically pleasing:
2.1. Add a user interface panel on the right side of the screen. Move the combo box with the genes library to the top of this panel. Also, add a memo box to display the selected genes as text (moving this from the debug panel).
2.2. Convert the debug panel into an expandable memo box to display and list the nodes. Place this below the combo box and the selected genes memo box.
2.3. Add a status bar at the bottom of the page to display the numbers of nodes, edges, and GUM iterations.
2.4. Add a frame around the canvas to define its boundaries. Ensure the canvas fills all the available space except for the status bar and the user interface panel.