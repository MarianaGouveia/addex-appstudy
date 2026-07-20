// app/hooks/graphSettings.ts
export interface GraphSettings {
  neNodeShape: string;
  lcaNodeShape: string;
  neBorderStyle: string;
  lcaBorderStyle: string;
  edgeThickness: number;
  arrowShape: string;
  neLineStyle: string;
  lcaLineStyle: string;
  neEdgeColor: string;
  lcaEdgeColor: string;
  layoutName: string;
}

let currentSettings: GraphSettings = {
  neNodeShape: "roundrectangle",
  lcaNodeShape: "roundrectangle",
  neBorderStyle: "solid",
  lcaBorderStyle: "dashed",
  edgeThickness: 2,
  arrowShape: "triangle",
  neLineStyle: "solid",
  lcaLineStyle: "dashed",
  neEdgeColor: "#000000",
  lcaEdgeColor: "#8a8a8a",
  layoutName: "breadthfirst",
};

export const getGraphSettings = (): GraphSettings => currentSettings;

export const setGraphSettings = (settings: Partial<GraphSettings>) => {
  currentSettings = { ...currentSettings, ...settings };
};
