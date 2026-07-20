import { normalizeNodeType } from "../../../styles/typeKey";
import { getGraphSettings } from "./graphSettings";

interface NodeTypeColors {
  [type: string]: string;
}

// Wrap label into multiple lines based on max chars per line
function wrapLabel(label: any, maxCharsPerLine = 15) {
  if (typeof label !== "string") label = String(label);

  const words: string[] = label.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word: string) => {   // <-- explicitly typed
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines.join("\n");
}


const graphStyles = (
  nodeTypeColors: NodeTypeColors,
  elements: any[],
  viewportScale = 1
): any[] => {
  const settings = getGraphSettings();
  const maxFontSize = 20 * viewportScale;
  const padding = 12 * viewportScale;
  // Comfortable default node size — short labels (e.g. "Drd2") stay at this
  // size; longer labels scale up only as needed (capped at widthCap below).
  const minWidth = 180 * viewportScale;
  const minHeight = 60 * viewportScale;

  let maxLines = 1;

  // Only line-count drives the global font scale (so all labels remain
  // visually consistent in size). Width/height are computed per-node below
  // so a single long label (e.g. a protein name in a drug-target graph)
  // doesn't inflate every other node in the graph.
  elements.forEach((el) => {
    if (el.data?.label) {
      const wrapped = wrapLabel(el.data.label);
      maxLines = Math.max(maxLines, wrapped.split("\n").length);
    }
  });

  const fontSize = Math.min(maxFontSize, (200 * viewportScale) / maxLines);
  const charWidth = fontSize * 0.6;
  // Cap width so any single very long label still wraps gracefully instead
  // of stretching the node off-screen.
  const widthCap = 300 * viewportScale;
  const textMaxWidth = widthCap - 12 * viewportScale;

  const sizeForLabel = (label: any): { w: number; h: number } => {
    const wrapped = wrapLabel(label);
    const lines = wrapped.split("\n");
    const longest = lines.reduce(
      (m: number, l: string) => Math.max(m, l.length),
      0
    );
    return {
      w: Math.max(minWidth, Math.min(widthCap, longest * charWidth + padding * 2)),
      h: Math.max(minHeight, fontSize * lines.length + padding * 2),
    };
  };

  return [
    {
      selector: "node",
      style: {
        shape: (ele: any) =>
          normalizeNodeType(ele.data("type")) === "lca"
            ? settings.lcaNodeShape
            : settings.neNodeShape,
        width: (ele: any) => sizeForLabel(ele.data("label")).w,
        height: (ele: any) => sizeForLabel(ele.data("label")).h,
        "background-color": (ele: any) => {
          const t = normalizeNodeType(ele.data("type"));
          return nodeTypeColors[t] || (t === "lca" ? "#d3d3d3" : "#ffffff");
        },
        "border-color": "black",
        "border-width": 3,
        "border-style": (ele: any) =>
          normalizeNodeType(ele.data("type")) === "lca"
            ? settings.lcaBorderStyle
            : settings.neBorderStyle,
        label: (ele: any) => wrapLabel(ele.data("label")),
        color: "black",
        "text-valign": "center",
        "text-halign": "center",
        "font-size": fontSize,
        "text-wrap": "wrap",
        "text-max-width": textMaxWidth,
      },
    },
    {
      selector: "edge",
      style: {
        width: settings.edgeThickness,
        "line-color": (ele: any) =>
          normalizeNodeType(ele.data("type")) === "lca"
            ? settings.lcaEdgeColor
            : settings.neEdgeColor,
        "target-arrow-color": (ele: any) =>
          normalizeNodeType(ele.data("type")) === "lca"
            ? settings.lcaEdgeColor
            : settings.neEdgeColor,
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        "control-point-step-size": 40,
        label: (ele: any) =>
          normalizeNodeType(ele.data("type")) === "lca" ? "is a" : ele.data("label"),
        "font-size": fontSize,
        color: (ele: any) =>
          normalizeNodeType(ele.data("type")) === "lca"
            ? settings.lcaEdgeColor
            : settings.neEdgeColor,
        "text-rotation": "autorotate",
        "text-margin-y": -6,
        "text-margin-x": 2,
      },
    },
    {
      selector: ".path-dim",
      style: {
        opacity: 0.2,
        "text-opacity": 0.2,
      },
    },
    {
      selector: "node.path-highlight",
      style: {
        opacity: 1,
        "text-opacity": 1,
        "border-width": 4,
      },
    },
    {
      selector: "node.manual-edge-source",
      style: {
        "border-color": "#2563eb",
        "border-width": 6,
        "overlay-color": "#60a5fa",
        "overlay-opacity": 0.18,
        "overlay-padding": 8,
      },
    },
    {
      selector: "edge.path-highlight",
      style: {
        opacity: 1,
        "text-opacity": 1,
        width: 4,
      },
    },
  ];
};

export default graphStyles;
