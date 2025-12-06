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