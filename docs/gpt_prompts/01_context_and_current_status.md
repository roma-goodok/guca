Hi! You are an AI assistant to help me find information and develop an educational project. Let me provide the main idea of the project, the decisions already made, and the current status first.

(!) As this is the first message, just take the instructions below into account. There is no need to implement anything right now, as further instructions will be provided later.

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


## Details about Source Code
### Frontend
Current project structure:
```sh
# sh command to see a project tree without lib artifacts:
pwd
tree -I 'dist|node_modules'
```
```txt
/Users/rgudchenko/p/guca-visualization
.
├── data
│   └── demo_2010_dict_genes.json
├── docs
│   ├── TODO.md
│   └── gpt_prompts
│       ├── 01_context_and_current_status.md
│       └── 02_milestone_M1_Frontend_MVP.md
├── index.html
├── package-lock.json
├── package.json
├── run.sh
├── scripts
│   └── 01_convert_xml_genes_to_json.py
├── src
│   ├── gum.ts
│   └── main.ts
├── tsconfig.json
└── webpack.config.js

6 directories, 13 files
```

index.html content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Graph Visualization</title>
  <style>
    #debug-info {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(255, 255, 255, 0.8);
      padding: 10px;
      border: 1px solid #ccc;
      max-width: 300px;
      font-size: 12px;
    }
    #node-details {
      max-height: 200px;
      overflow-y: auto;
    }
  </style>
</head>
<body>
  <div id="debug-info">
    <h4>Debug Information</h4>
    <p id="node-count">Nodes: 0</p>
    <div id="node-details"></div>
    <p id="change-table">Change Table: Not loaded</p>
    <label for="gene-select">Select Gene:</label>
    <select id="gene-select"></select>
  </div>
  <script src="dist/main.js" type="module"></script>
</body>
</html>
```
 
package.json content:
```json
{  
  "name": "guca-visualization",  
  "version": "1.0.0",  
  "main": "index.js",  
  "scripts": {  
    "test": "echo \"Error: no test specified\" && exit 1",  
    "build": "webpack",  
    "start": "http-server -c-1"  
  },  
  "keywords": [],  
  "author": "",  
  "license": "ISC",  
  "description": "",  
  "dependencies": {  
    "d3": "^7.9.0"  
  },  
  "devDependencies": {  
    "@types/d3": "^7.4.3",  
    "ts-loader": "^9.5.1",  
    "typescript": "^5.6.3",  
    "webpack": "^5.96.1",  
    "webpack-cli": "^5.1.4",  
    "http-server": "^14.1.1"  
  }  
}  
```

tsconfig.json content:
```json
{  
  "compilerOptions": {  
    "target": "es2016",                                  /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */  
    "module": "ESNext",                                  /* Specify what module code is generated. */  
    "rootDir": "./src",                                  /* Specify the root folder within your source files. */  
    "outDir": "./dist",                                  /* Specify an output folder for all emitted files. */  
    "esModuleInterop": true,                             /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */  
    "forceConsistentCasingInFileNames": true,            /* Ensure that casing is correct in imports. */  
    "strict": true,                                      /* Enable all strict type-checking options. */  
    "skipLibCheck": true                                 /* Skip type checking all .d.ts files. */  
  }  
}  
```
source of src/main.ts will be provided later
