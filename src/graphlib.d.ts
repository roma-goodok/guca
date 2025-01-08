// src/graphlib.d.ts  
  
declare module 'graphlib' {  
    export class Graph {  
        constructor(options?: { directed?: boolean; multigraph?: boolean; compound?: boolean });  
  
        setNode(node: string, value?: any): void;  
        node(node: string): any;  
        nodes(): string[];  
        removeNode(node: string): void;  
  
        setEdge(source: string, target: string, value?: any): void;  
        edge(source: string, target: string): any;  
        edges(): Array<{ v: string; w: string }>;  
        removeEdge(source: string, target: string): void;  
  
        hasNode(node: string): boolean;  
        hasEdge(source: string, target: string): boolean;  
  
        successors(node: string): string[];  
        predecessors(node: string): string[];  
        neighbors(node: string): string[];  
    }  
}  