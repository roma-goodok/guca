// src/3d-force-graph.d.ts

declare module '3d-force-graph' {
  export interface ForceGraph3DInstance {
    graphData(data?: any): ForceGraph3DInstance;
    width(width: number): ForceGraph3DInstance;
    height(height: number): ForceGraph3DInstance;
    backgroundColor(color: string): ForceGraph3DInstance;
    showNavInfo(show: boolean): ForceGraph3DInstance;
    nodeId(
      idAccessor: string | ((node: any) => string | number)
    ): ForceGraph3DInstance;
    nodeRelSize(relSize: number): ForceGraph3DInstance;
    nodeLabel(labelAccessor: (node: any) => string): ForceGraph3DInstance;
    nodeColor(colorAccessor: (node: any) => string): ForceGraph3DInstance;
    linkColor(colorAccessor: (link: any) => string): ForceGraph3DInstance;

    linkOpacity(opacity: number): ForceGraph3DInstance;
    linkWidth(width: number | ((link: any) => number)): ForceGraph3DInstance;
    linkResolution(resolution: number): ForceGraph3DInstance;


    cooldownTicks(ticks: number): ForceGraph3DInstance;
    zoomToFit(
      ms?: number,
      padding?: number,
      nodeFilter?: (node: any) => boolean
    ): ForceGraph3DInstance;
    onNodeHover(callback: (node: any | null) => void): ForceGraph3DInstance;
    pauseAnimation(): ForceGraph3DInstance;
    resumeAnimation(): ForceGraph3DInstance;

    [key: string]: any;
  }

  const ForceGraph3D: {
    new (element: HTMLElement, configOptions?: any): ForceGraph3DInstance;
  };

  export default ForceGraph3D;
}
