#### Initialization
- [x] Display interactive graph (hardcoded very simple iterative node creation)
- [x] Familiarize with web development (TypeScript)

#### MVP
Display interactive growing graph (arbitrary "genes"). The viewer of the interactive growing graph can select "genes" from the predefined library (combo box) or upload them via JSON.
- [x] Refresh the rules of GUCA
- [x] Propose a JSON format
- [x] Convert old (2010) "genes" from XML to JSON
- [x] Prepare a very simple "gene," e.g., "[ ]"
- [x] GraphUnfoldingMachine - which executes a "gene" modifying the graph. The modified graph should be visualized simultaneously as it grows.


High-Level Plan to Implement M1
 

1. Analyze and Convert Rules
Task: Convert existing rules from C# to JSON format.
Action: Write a script or manually convert a subset of the existing rules to JSON format to be used in the initial MVP.
2. Frontend Setup
Task: Set up the basic frontend structure using TypeScript and D3.js.
Action:
Create the project scaffold (if not already done).
Implement a basic HTML structure with a canvas for D3.js visualizations.
Add interactive elements like a combo box for selecting genes and a file upload input for loading JSON files.
3. Graph Unfolding Machine in TypeScript
Task: Implement the core functionality of the Graph Unfolding Machine in TypeScript.
Action:
Implement classes and methods to parse the JSON format and apply the transition rules to the graph.
Ensure compatibility with the provided JSON format.
4. Graph Visualization
Task: Use D3.js to visualize the graph.
Action:
Implement the force-directed layout algorithm in D3.js.
Add functionality to update the graph layout in real-time based on user interactions and unfolding rules.
Implement interactive features to add, remove, and update vertices and edges.
Implement the virtual "knife" tool for cutting edges.
5. Testing and Debugging
Task: Test the frontend MVP with a few hardcoded genes.
Action:
Load the JSON format of genes into the frontend.
Test the interactive graph visualization and unfolding.
Debug any issues related to graph manipulation and visualization.
6. Documentation and Feedback
Task: Document the implementation process.
Action:
Write documentation for the JSON format, how to use the frontend, and any other relevant information.
Gather feedback from initial users and make improvements based on their input.
Detailed Steps for Implementation
 

1. Setup Project
Ensure the project structure is in place with index.html, main.ts, and necessary configurations (package.json, webpack.config.js, etc.).
Install necessary dependencies (TypeScript, D3.js, etc.).
2. Create Basic HTML Structure
Update index.html to include elements for graph visualization and interaction (e.g., canvas, combo box, file upload).
3. Implement JSON Parsing
Write TypeScript functions to parse the JSON format and convert it into a suitable structure for the Graph Unfolding Machine.
4. Implement Graph Unfolding Machine
Translate the core logic of the C# Graph Unfolding Machine into TypeScript.
Implement classes like NodeState, OperationCondition, Operation, ChangeTableItem, GUMNode, ChangeTable, GUMGraph, and GraphUnfoldingMachine.
5. Integrate D3.js for Visualization
Use D3.js to create a force-directed graph layout.
Add functionality to dynamically update the graph based on the unfolding rules.
Implement interactive features such as adding/removing nodes and edges.
6. Testing and Debugging
Load hardcoded JSON genes into the frontend and test the unfolding process.
Debug any issues and ensure the graph updates correctly in real-time.
7. Documentation and User Feedback
Document the JSON format, how to use the frontend, and any other relevant information.
Gather feedback from initial users and make necessary improvements.