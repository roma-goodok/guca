# VOGUE: Visualization of Ontogeny in Graph Unfolding Evolution  
  
## Project Vision  
  
The purpose of the VOGUE project is to create an interactive web application for animated visualization of graph unfolding cellular automata (ontogeny) by a "program" calculated by a genetic algorithm, along with graph manipulation commands. Users should be able to interact with the graph, add and remove vertices and edges, and visualize the changes in real-time. The graph layout will be updated using a force-directed algorithm that can be extended to 3D.  
  
## Main Idea  
  
The main idea behind VOGUE is to provide an interactive platform for visualizing the ontogeny of graph unfolding cellular automata based on a "program" calculated by a genetic algorithm. Users will be able to manipulate the graph and observe the unfolding process in real-time, providing a unique and engaging way to explore and analyze cellular automata.  
  
## Requirements  
  
1. Animated visualization of graph unfolding cellular automata based on a genetic algorithm.  
2. Interactive graph visualization with real-time updates.  
3. Support for adding, removing, and updating vertices and edges.  
4. Implementation of a force-directed layout algorithm, extendable to 3D.  
5. A virtual "knife" mouse tool for cutting edges interactively.  
6. Smooth and responsive user experience.  
  
## Selected Frameworks  
  
- **Frontend**: JavaScript/TypeScript with Three.js  
  - Motivation: Three.js is a powerful 3D visualization library that leverages WebGL for creating advanced graphics. It is suitable for implementing a custom force-directed algorithm and provides the necessary tools for creating interactive 3D graph visualizations.  
  
- **Backend**: Go with a web framework (e.g., Gin, Revel, or Echo)  
  - Motivation: Go is a performant and efficient programming language with excellent concurrency handling. It is suitable for building a fast and responsive server-side application to support the frontend's interactive requirements.  
  
By using JavaScript/TypeScript with Three.js for the frontend and Go for the backend, VOGUE aims to create a visually stunning, high-performance, and interactive graph visualization application that meets the project's vision and requirements.  


## Links

###  "Living Graphs" — Growing Graph Unfolding Cellular Automata (GUCA) with Examples in Silverlight (2010)
Article (RUS): [https://habr.com/en/articles/107387](https://habr.com/en/articles/107387)


###  Computational Life: How Well-formed, Self-replicating Programs Emerge from Simple Interaction  
Blaise Agüera Arcas† Jyrki Alakuijala James Evans Ben Laurie Alexander Mordvintsev Eyvind Niklasson† Ettore Randazzo† Luca Versari  

Paper: [https://arxiv.org/pdf/2406.19108v2](https://arxiv.org/pdf/2406.19108v2)  
Code: [https://github.com/paradigms-of-intelligence/cubff](https://github.com/paradigms-of-intelligence/cubff)  

## Automating the Search for Artificial Life with Foundation Models  

Paper: [https://arxiv.org/pdf/2412.17799v1](https://arxiv.org/pdf/2412.17799v1)  
Code: [https://github.com/sakanaai/asal](https://github.com/sakanaai/asal)  
