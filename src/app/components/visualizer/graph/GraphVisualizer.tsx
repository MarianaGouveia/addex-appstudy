"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import cytoscape, { Core, LayoutOptions } from "cytoscape";
import { Pair, Path } from "@/app/hooks/types";
import GraphMenu from "./GraphMenu";
import NodeLegend from "../legend/NodeLegend";
import graphStyles from "@/app/hooks/graphStyles";
import { useColors } from "../../../../../styles/useColors";
import { normalizeNodeType } from "../../../../../styles/typeKey";
import { Rnd } from "react-rnd";
import ColorPicker from "../legend/ColorPicker";
import { exportGraphWithLegend, exportGraphAsSVG } from "@/app/hooks/exportPNG";
import ExportPreviewModal from "../../imgExport/ExportPreviewModal";
import { getGraphSettings } from "@/app/hooks/graphSettings";
import { runClusterLayoutByType } from "@/app/hooks/clusterLayout";
import { featureFlags } from "@/app/config/featureFlags";
import ManualGraphBuilder from "./manualBuilder/ManualGraphBuilder";
import { useManualGraphBuilder } from "./manualBuilder/useManualGraphBuilder";

let cytoscapeSvgRegistered = false;
async function ensureCytoscapeSvgRegistered() {
  if (cytoscapeSvgRegistered) return;
  // @ts-expect-error cytoscape-svg has no bundled types
  const mod = await import("cytoscape-svg");
  cytoscape.use(mod.default ?? mod);
  cytoscapeSvgRegistered = true;
}

const LEGEND_W = 220;
const LEGEND_H = 120;
const MARGIN = 12;

function getViewportScale() {
  if (typeof window === "undefined") return 1;
  return Math.min(1.6, Math.max(1, window.innerWidth / 1440));
}

function positionLcasInColumn(cy: Core, viewportScale: number) {
  const regularNodes = cy
    .nodes()
    .filter((node) => normalizeNodeType(String(node.data("type") ?? "")) !== "lca");
  const lcaNodes = cy
    .nodes()
    .filter((node) => normalizeNodeType(String(node.data("type") ?? "")) === "lca");

  if (regularNodes.empty() || lcaNodes.empty()) return;

  const regularBounds = regularNodes.boundingBox();
  const graphCenterY = (regularBounds.y1 + regularBounds.y2) / 2;
  const placements: Array<{
    lca: cytoscape.NodeSingular;
    anchorY: number;
    side: "top" | "bottom";
  }> = [];
  let columnXTotal = 0;

  lcaNodes.forEach((lca) => {
    columnXTotal += lca.position("x");
    const connectedNodes = lca
      .connectedEdges()
      .connectedNodes()
      .filter(
        (node) => normalizeNodeType(String(node.data("type") ?? "")) !== "lca"
      );

    if (connectedNodes.empty()) return;

    let connectedYTotal = 0;
    connectedNodes.forEach((node) => {
      connectedYTotal += node.position("y");
    });

    const connectedCenterY = connectedYTotal / connectedNodes.length;
    const side = connectedCenterY <= graphCenterY ? "top" : "bottom";
    placements.push({ lca, anchorY: connectedCenterY, side });
  });

  if (placements.length === 0) return;

  placements.sort((left, right) => {
    if (left.side !== right.side) return left.side === "top" ? -1 : 1;
    if (left.anchorY !== right.anchorY) return left.anchorY - right.anchorY;
    return left.lca.id().localeCompare(right.lca.id());
  });

  const columnX = columnXTotal / lcaNodes.length;
  const tallestLca = Math.max(...placements.map(({ lca }) => lca.outerHeight()));
  const rowSpacing = tallestLca + 35 * viewportScale;
  const verticalClearance = 35 * viewportScale;
  const topPlacements = placements.filter(({ side }) => side === "top");
  const bottomPlacements = placements.filter(({ side }) => side === "bottom");

  // Stack the upper group upward from a boundary above all regular nodes.
  // This preserves the column while leaving the graph body unobstructed.
  const topBoundaryY = regularBounds.y1 - verticalClearance - tallestLca / 2;
  const topFirstRowY = topBoundaryY - (topPlacements.length - 1) * rowSpacing;
  topPlacements.forEach(({ lca }, index) => {
    lca.position({
      x: columnX,
      y: topFirstRowY + index * rowSpacing,
    });
  });

  // Stack the lower group downward from a boundary below all regular nodes.
  const bottomFirstRowY = regularBounds.y2 + verticalClearance + tallestLca / 2;
  bottomPlacements.forEach(({ lca }, index) => {
    lca.position({
      x: columnX,
      y: bottomFirstRowY + index * rowSpacing,
    });
  });
}

interface GraphVisualizerProps {
  pair: Pair;
  manualBuildMode?: boolean;
  visiblePaths: Set<string>;
  visibleLCAs: Set<string>;
  isVisible?: boolean;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  hoveredPathId: string | null;
  hoveredLcaName: string | null;
  hoveredNodeId?: string | null;
  onNodeHover?: (nodeId: string | null) => void;
}

export default function GraphVisualizer({
  pair,
  manualBuildMode = false,
  visiblePaths,
  visibleLCAs,
  isVisible = true,
  leftCollapsed,
  rightCollapsed,
  hoveredPathId,
  hoveredLcaName,
  hoveredNodeId = null,
  onNodeHover,
}: GraphVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const graphVisualizerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const {
    nodeTypeColors,
    getColorForType,
    updateColor,
    resetColors,
    ensureColors,
    paletteOverride,
    setPaletteOverride,
  } = useColors();

  const {
    catalog: manualCatalog,
    nodeIds: manualNodeIds,
    edges: manualEdges,
    nodePositions: manualNodePositions,
    activeTab: manualBuilderTab,
    setActiveTab: setManualBuilderTab,
    layoutName: manualLayoutName,
    setLayoutName: setManualLayoutName,
    addNode: addManualNode,
    removeNode: removeManualNode,
    selectedRelation: manualSelectedRelation,
    pendingSourceId: manualPendingSourceId,
    selectRelation: selectManualRelation,
    selectEndpoint: selectManualEndpoint,
    cancelConnection: cancelManualConnection,
    removeEdge: removeManualEdge,
    updateNodePosition: updateManualNodePosition,
    clear: clearManualGraph,
  } = useManualGraphBuilder(pair, manualBuildMode);

  const [loading, setLoading] = useState(true);
  const [viewportScale, setViewportScale] = useState(getViewportScale);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [previewCanvasNoLegend, setPreviewCanvasNoLegend] =
    useState<HTMLCanvasElement | null>(null);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [previewSvgNoLegend, setPreviewSvgNoLegend] = useState<string | null>(null);
  const [legendPos, setLegendPos] = useState<{ x: number; y: number } | null>(null);
  // Auto-size the legend so every node-type label fits on a single line.
  // Once the user drags a resize handle, both dimensions become concrete
  // pixel values until the layout arrow is used again.
  const [legendSize, setLegendSize] = useState<{
    width: number | "auto";
    height: number | "auto";
  }>({ width: "auto", height: "auto" });
  const [isLegendColumnLayout, setIsLegendColumnLayout] = useState(true);

  // Recalculate the natural content width whenever the layout arrow is used,
  // keeping labels on one line in both row and column modes.
  const handleToggleLegendLayout = useCallback(() => {
    setIsLegendColumnLayout((prev) => {
      const next = !prev;
      setLegendSize({ width: "auto", height: "auto" });
      return next;
    });
  }, []);
  const [activeColorPicker, setActiveColorPicker] =
    useState<{ type: string; position: { x: number; y: number } } | null>(null);
  const menuCenterRef = useRef<(() => void) | null>(null);
  const hasInitialCenteringRun = useRef(false);
  const previousManualNodeIdsRef = useRef<Set<string>>(new Set());
  const centerAfterManualNodeAddRef = useRef(false);
  const previousManualLayoutNameRef = useRef(manualLayoutName);
  const centerAfterManualLayoutChangeRef = useRef(false);
  const onNodeHoverRef = useRef(onNodeHover);
  const selectManualEndpointRef = useRef(selectManualEndpoint);
  useEffect(() => {
    onNodeHoverRef.current = onNodeHover;
  }, [onNodeHover]);
  useEffect(() => {
    selectManualEndpointRef.current = selectManualEndpoint;
  }, [selectManualEndpoint]);
  useEffect(() => {
    if (!manualBuildMode) {
      previousManualNodeIdsRef.current = new Set();
      centerAfterManualNodeAddRef.current = false;
      return;
    }

    const nodeWasAdded = Array.from(manualNodeIds).some(
      (nodeId) => !previousManualNodeIdsRef.current.has(nodeId)
    );
    previousManualNodeIdsRef.current = new Set(manualNodeIds);

    if (manualNodeIds.size === 0) {
      centerAfterManualNodeAddRef.current = false;
    } else if (nodeWasAdded) {
      centerAfterManualNodeAddRef.current = true;
    }
  }, [manualBuildMode, manualNodeIds]);
  useEffect(() => {
    if (!manualBuildMode) {
      previousManualLayoutNameRef.current = manualLayoutName;
      centerAfterManualLayoutChangeRef.current = false;
      return;
    }

    if (previousManualLayoutNameRef.current !== manualLayoutName) {
      previousManualLayoutNameRef.current = manualLayoutName;
      centerAfterManualLayoutChangeRef.current = true;
    }
  }, [manualBuildMode, manualLayoutName]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const updateScale = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => setViewportScale(getViewportScale()), 120);
    };

    window.addEventListener("resize", updateScale);
    return () => {
      window.removeEventListener("resize", updateScale);
      clearTimeout(timeout);
    };
  }, []);

  const handleBuilderDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const nodeId = event.dataTransfer.getData("application/x-addex-node");
    const relationId = event.dataTransfer.getData("application/x-addex-relation");

    if (nodeId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const renderedPosition = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const zoom = cyRef.current?.zoom() ?? 1;
      const pan = cyRef.current?.pan() ?? { x: 0, y: 0 };
      addManualNode(nodeId, {
        x: (renderedPosition.x - pan.x) / zoom,
        y: (renderedPosition.y - pan.y) / zoom,
      });
      return;
    }

    if (relationId) {
      const relation = manualCatalog.relations.find(
        (candidate) => candidate.id === relationId
      );
      if (relation) selectManualRelation(relation);
    }
  };

  // --- Prepare graph elements ---
  const elements = useMemo(() => {
  const elems: cytoscape.ElementDefinition[] = [];
  const addedNodes = new Set<string>();
  const addedEdges = new Set<string>();

  const addNode = (
    id: string,
    label: string,
    type: string,
    connectedNE?: string[],
    position?: { x: number; y: number }
  ) => {
    if (!addedNodes.has(id)) {
      elems.push({ data: { id, label, type, connectedNE }, position });
      addedNodes.add(id);
    }
  };

  const addEdge = (
    source: string,
    target: string,
    label: string,
    type?: string,
    style?: any
  ) => {
    const key = `${source}-${target}-${label}`;
    if (!addedEdges.has(key)) {
      elems.push({
        data: { id: key, source, target, label, type: type || "NE" },
        style,
      });
      addedEdges.add(key);
    }
  };

  if (manualBuildMode) {
    manualCatalog.nodes.forEach((node) => {
      if (manualNodeIds.has(node.id)) {
        addNode(
          node.id,
          node.id,
          node.type,
          undefined,
          manualNodePositions[node.id]
        );
      }
    });
    manualEdges.forEach((edge) => {
      addEdge(edge.source, edge.target, edge.label, edge.type, {
        "target-arrow-shape": "triangle",
        "line-style": edge.type === "LCA" ? "dashed" : "solid",
      });
    });
    return elems;
  }

  pair.paths.forEach((path: Path) => {
    if (!visiblePaths.has(path.id)) return;

    // --- Normal nodes and edges ---
    path.nodes.forEach((n) => addNode(n.id, n.id, n.type));

    path.edges.forEach((e) =>
      addEdge(e.source, e.target, e.label, e.type, {
        "target-arrow-shape": "triangle",
        "line-style": "solid",
      })
    );

    // --- LCA handling ---
    if (path.lowest_common_ancestors) {
      Object.entries(path.lowest_common_ancestors).forEach(
        ([key, lcaList]) => {
          const sourceNodes = key.split(",");

          const lcas = Array.isArray(lcaList)
            ? lcaList
            : [lcaList].filter(Boolean);

          lcas.forEach((lcaName: string) => {
            // respect toggle
            if (!visibleLCAs.has(lcaName)) return;

            // Add LCA node
            addNode(lcaName, lcaName, "LCA", sourceNodes);

            // Connect sources to LCA
            sourceNodes.forEach((source) => {
              addEdge(source, lcaName, "is_a", "LCA", {
                "line-style": "dashed",
                "target-arrow-shape": "triangle",
              });
            });
          });
        }
      );
    }
  });

  return elems;
}, [
  pair,
  visiblePaths,
  visibleLCAs,
  manualBuildMode,
  manualCatalog,
  manualNodeIds,
  manualEdges,
  manualNodePositions,
]);

  // --- Initialize Cytoscape ---
  const initGraph = useCallback(() => {
    if (!containerRef.current) return;
    setLoading(true);
    const previousManualViewport =
      manualBuildMode && cyRef.current
        ? {
            zoom: cyRef.current.zoom(),
            pan: { ...cyRef.current.pan() },
          }
        : null;
    // Re-run centering on every graph rebuild (new pair, reload, etc.).
    hasInitialCenteringRun.current = false;

    if (cyRef.current) cyRef.current.destroy();

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: graphStyles(nodeTypeColors, elements, viewportScale),
      // Prevent Cytoscape's implicit initial layout from fitting manual graphs
      // before the participant-selected layout runs below.
      layout: manualBuildMode ? { name: "preset", fit: false } : undefined,
    });

    cyRef.current = cy;

    cy.on("layoutstop", () => {
      if (!manualBuildMode) positionLcasInColumn(cy, viewportScale);
      if (
        manualBuildMode &&
        (centerAfterManualNodeAddRef.current ||
          centerAfterManualLayoutChangeRef.current)
      ) {
        cy.fit();
        cy.center();
        centerAfterManualNodeAddRef.current = false;
        centerAfterManualLayoutChangeRef.current = false;
        hasInitialCenteringRun.current = true;
      } else if (manualBuildMode && previousManualViewport) {
        cy.zoom(previousManualViewport.zoom);
        cy.pan(previousManualViewport.pan);
        hasInitialCenteringRun.current = true;
      } else if (!manualBuildMode && !hasInitialCenteringRun.current) {
        cy.fit();
        cy.center();
        hasInitialCenteringRun.current = true;
      }
      setLoading(false);
    });

    cy.on("mouseover", "node", (event) => {
      const id = event.target.id() as string;
      onNodeHoverRef.current?.(id);
    });

    cy.on("mouseout", "node", () => {
      onNodeHoverRef.current?.(null);
    });

    cy.on("tap", "node", (event) => {
      if (!manualBuildMode) return;
      selectManualEndpointRef.current(event.target.id() as string);
    });

    if (manualBuildMode) {
      cy.nodes().grabify();
      cy.on("dragfree", "node", (event) => {
        const nodeId = event.target.id() as string;
        const position = event.target.position();
        updateManualNodePosition(nodeId, { x: position.x, y: position.y });
      });

      if (manualLayoutName === "cluster") {
        runClusterLayoutByType(cy, false);
        return;
      }

      const manualLayout: LayoutOptions =
        manualLayoutName === "hierarchicalClassic"
            ? {
                name: "breadthfirst",
                directed: true,
                spacingFactor: 1,
                avoidOverlap: true,
                animate: true,
                direction: "downward",
                fit: false,
              }
            : manualLayoutName === "breadthfirst"
              ? {
                  name: "breadthfirst",
                  directed: true,
                  spacingFactor: 1,
                  avoidOverlap: true,
                  animate: true,
                  direction: "rightward",
                  fit: false,
                }
              : manualLayoutName === "circle"
                ? { name: "circle", animate: true, fit: false, padding: 24 }
                : manualLayoutName === "concentric"
                  ? {
                      name: "concentric",
                      animate: true,
                      fit: false,
                      padding: 24,
                    }
                  : {
                      name: "grid",
                      avoidOverlap: true,
                      avoidOverlapPadding: 40,
                      spacingFactor: 1.5,
                      condense: false,
                      animate: true,
                      fit: false,
                      padding: 24,
                    };

      cy.layout(manualLayout).run();
      return;
    }

    const savedLayout = getGraphSettings().layoutName ?? "breadthfirst";
    if (savedLayout === "cluster" || savedLayout === "cose") {
      runClusterLayoutByType(cy);
      return;
    }

    const layout: LayoutOptions =
      savedLayout === "hierarchical"
        ? {
            name: "breadthfirst",
            directed: false,
            roots: cy
              .nodes()
              .filter((node) => String(node.data("type")) === "LCA")
              .map((node) => node.id()),
            spacingFactor: 1,
            avoidOverlap: true,
            animate: true,
            direction: "downward",
          }
        : savedLayout === "hierarchicalClassic"
        ? {
            name: "breadthfirst",
            directed: true,
            spacingFactor: 1,
            avoidOverlap: true,
            animate: true,
            direction: "downward",
          }
        : savedLayout === "breadthfirst"
        ? {
            name: "breadthfirst",
            directed: true,
            spacingFactor: 1,
            avoidOverlap: true,
            animate: true,
            direction: "rightward",
          }
        : savedLayout === "circle"
            ? {
                name: "circle",
                animate: true,
                fit: true,
                padding: 24,
              }
            : savedLayout === "concentric"
              ? {
                  name: "concentric",
                  animate: true,
                  fit: true,
                  padding: 24,
                }
              : {
                  name: "grid",
                  avoidOverlap: true,
                  avoidOverlapPadding: 40,
                  spacingFactor: 1.5,
                  condense: false,
                  animate: true,
                  fit: true,
                  padding: 24,
                };

    cy.layout(layout).run();
  }, [
    elements,
    viewportScale,
    manualBuildMode,
    manualLayoutName,
    updateManualNodePosition,
  ]);

  useEffect(() => {
    ensureColors(elements.map(el => el.data.type));
    initGraph();
  }, [elements, initGraph, ensureColors]);

  // Apply node/edge color updates without rebuilding Cytoscape so user-moved
  // node positions are preserved.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.style(graphStyles(nodeTypeColors, elements, viewportScale));
  }, [nodeTypeColors, elements, viewportScale]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !manualBuildMode) return;
    cy.nodes().removeClass("manual-edge-source");
    if (!manualPendingSourceId) return;
    cy.getElementById(manualPendingSourceId).addClass("manual-edge-source");
  }, [manualBuildMode, manualPendingSourceId, elements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.elements().removeClass("path-dim path-highlight");

      if (hoveredPathId) {
        const hoveredPath = pair.paths.find((path) => path.id === hoveredPathId);
        if (!hoveredPath) return;

        const nodeIds = new Set(hoveredPath.nodes.map((node) => node.id));
        const edgeIds = new Set(
          hoveredPath.edges.map((edge) => `${edge.source}-${edge.target}-${edge.label}`)
        );

        cy.elements().addClass("path-dim");

        nodeIds.forEach((id) => {
          const node = cy.getElementById(id);
          if (node.nonempty()) {
            node.removeClass("path-dim").addClass("path-highlight");
          }
        });

        edgeIds.forEach((id) => {
          const edge = cy.getElementById(id);
          if (edge.nonempty()) {
            edge.removeClass("path-dim").addClass("path-highlight");
          }
        });

        return;
      }

      if (hoveredNodeId) {
        const hoveredNode = cy.getElementById(hoveredNodeId);
        const hoveredNodeType = hoveredNode.nonempty()
          ? String(hoveredNode.data("type") || "")
          : "";

        if (hoveredNodeType === "LCA") {
          cy.elements().addClass("path-dim");
          hoveredNode.removeClass("path-dim").addClass("path-highlight");

          hoveredNode.connectedEdges().forEach((edge) => {
            if (String(edge.data("type") || "") !== "LCA") return;
            edge.removeClass("path-dim").addClass("path-highlight");
            const otherEnd =
              edge.source().id() === hoveredNodeId ? edge.target() : edge.source();
            otherEnd.removeClass("path-dim").addClass("path-highlight");
          });

          return;
        }

        const matchingPaths = pair.paths.filter(
          (path) =>
            visiblePaths.has(path.id) &&
            path.nodes.some((node) => node.id === hoveredNodeId)
        );

        if (matchingPaths.length === 0) return;

        const nodeIds = new Set<string>();
        const edgeIds = new Set<string>();

        matchingPaths.forEach((path) => {
          path.nodes.forEach((node) => nodeIds.add(node.id));
          path.edges.forEach((edge) =>
            edgeIds.add(`${edge.source}-${edge.target}-${edge.label}`)
          );
        });

        cy.elements().addClass("path-dim");

        nodeIds.forEach((id) => {
          const node = cy.getElementById(id);
          if (node.nonempty()) {
            node.removeClass("path-dim").addClass("path-highlight");
          }
        });

        edgeIds.forEach((id) => {
          const edge = cy.getElementById(id);
          if (edge.nonempty()) {
            edge.removeClass("path-dim").addClass("path-highlight");
          }
        });

        return;
      }

      if (!hoveredLcaName) return;

      const sourceIds = new Set<string>();
      pair.paths.forEach((path) => {
        Object.entries(path.lowest_common_ancestors ?? {}).forEach(
          ([key, lcaList]) => {
            const lcaArray = Array.isArray(lcaList) ? lcaList : [lcaList];
            if (!lcaArray.includes(hoveredLcaName)) return;

            key.split(",").forEach((source) => sourceIds.add(source));
          }
        );
      });

      cy.elements().addClass("path-dim");

      const lcaNode = cy.getElementById(hoveredLcaName);
      if (lcaNode.nonempty()) {
        lcaNode.removeClass("path-dim").addClass("path-highlight");
      }

      sourceIds.forEach((id) => {
        const node = cy.getElementById(id);
        if (node.nonempty()) {
          node.removeClass("path-dim").addClass("path-highlight");
        }

        const edge = cy.getElementById(`${id}-${hoveredLcaName}-is_a`);
        if (edge.nonempty()) {
          edge.removeClass("path-dim").addClass("path-highlight");
        }
      });
    });
  }, [hoveredPathId, hoveredLcaName, hoveredNodeId, visiblePaths, pair.paths, elements]);

  // --- Resize Cytoscape on panel collapse ---
  useEffect(() => {
    if (!cyRef.current) return;
    const timeout = setTimeout(() => {
      cyRef.current!.resize();
      if (!manualBuildMode) cyRef.current!.fit();
    }, 220);
    return () => clearTimeout(timeout);
  }, [leftCollapsed, rightCollapsed, manualBuildMode]);

  // When the graph panel is re-opened after being collapsed/hidden, force a
  // resize + fit + center once the width transition settles.
  useEffect(() => {
    if (!isVisible || !cyRef.current) return;
    const timeout = setTimeout(() => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.resize();
      if (!manualBuildMode) {
        cy.fit();
        cy.center();
      }
    }, 280);
    return () => clearTimeout(timeout);
  }, [isVisible, manualBuildMode]);

  // --- Initialize legend position after canvas mounts ---
  useEffect(() => {
    if (!legendPos && containerRef.current) {
      setLegendPos({ x: MARGIN, y: MARGIN });
    }
  }, [containerRef.current]);

  // --- Export ---
  const handleExport = async () => {
    if (!cyRef.current || !pair || !graphVisualizerRef.current || !legendRef.current) return;

    setLoading(true);
    try {
      const legendRect = {
        x: legendPos?.x ?? 0,
        y: legendPos?.y ?? 0,
        width: LEGEND_W,
        height: LEGEND_H,
      };
      const [canvas, canvasNoLegend] = await Promise.all([
        exportGraphWithLegend(
          cyRef.current,
          pair,
          graphVisualizerRef.current,
          legendRef.current,
          legendRect,
          true
        ),
        exportGraphWithLegend(
          cyRef.current,
          pair,
          graphVisualizerRef.current,
          null,
          null,
          true
        ),
      ]);
      if (!canvas || !canvasNoLegend) throw new Error("Failed to generate preview!");
      setPreviewCanvas(canvas);
      setPreviewCanvasNoLegend(canvasNoLegend);

      try {
        await ensureCytoscapeSvgRegistered();
        const svgString = exportGraphAsSVG(
          cyRef.current,
          legendRef.current,
          legendRect
        );
        const svgStringNoLegend = exportGraphAsSVG(cyRef.current, null, null);
        setPreviewSvg(svgString);
        setPreviewSvgNoLegend(svgStringNoLegend);
      } catch (svgErr) {
        console.warn("SVG export unavailable:", svgErr);
        setPreviewSvg(null);
        setPreviewSvgNoLegend(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const activeTypes = useMemo(() => {
    // Keep the legend complete even when no graph elements are currently
    // visible (notably at the start of the text reconstruction task).
    const nodeTypes = manualCatalog.nodes.map((node) => node.type).filter(Boolean);

    const normalizedToLabel = new Map<string, string>();
    nodeTypes.forEach((type) => {
      const normalized = normalizeNodeType(type);
      if (!normalized || normalizedToLabel.has(normalized)) return;
      normalizedToLabel.set(normalized, type);
    });

    return Array.from(normalizedToLabel.values());
  }, [manualCatalog]);

  return (
    <div
      ref={graphVisualizerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        minHeight: 0,
        border: "1px solid #ccc",
        borderRadius: 6,
        backgroundColor: "#fafafa",
        overflow: "hidden",
      }}
    >
      {/* Menu stays above graph */}
      <GraphMenu
        ref={menuCenterRef}
        cy={cyRef.current}
        onReload={initGraph}
        hideReload={manualBuildMode}
        pair={pair}
        onExport={handleExport}
        paletteOverride={paletteOverride}
        setPaletteOverride={setPaletteOverride}
        resetColors={() => {
          resetColors();
          initGraph();
        }}
      />

      {/* Graph + Legend container */}
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          display: "flex",
          overflow: "hidden",
        }}
      >
        {manualBuildMode && (
          <ManualGraphBuilder
            nodes={manualCatalog.nodes}
            relations={manualCatalog.relations}
            addedNodeIds={manualNodeIds}
            edges={manualEdges}
            activeTab={manualBuilderTab}
            setActiveTab={setManualBuilderTab}
            layoutName={manualLayoutName}
            setLayoutName={setManualLayoutName}
            addNode={addManualNode}
            removeNode={removeManualNode}
            removeEdge={removeManualEdge}
            selectedRelationId={manualSelectedRelation?.id}
            pendingSourceId={manualPendingSourceId}
            selectRelation={selectManualRelation}
            cancelConnection={cancelManualConnection}
            clearGraph={clearManualGraph}
            getColorForType={getColorForType}
          />
        )}
        <div
          onDragOver={(event) => {
            if (!manualBuildMode) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={manualBuildMode ? handleBuilderDrop : undefined}
          style={{ position: "relative", flex: 1, minWidth: 0, minHeight: 0 }}
        >
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: "100%",
            position: "relative", // crucial for legend absolute positioning
            backgroundColor: "#fff",
            borderRadius: 6,
          }}
        />

        {manualBuildMode && elements.length === 0 && !loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem",
              color: "#4b5563",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            Add a node from the left panel or drag it onto this canvas.
          </div>
        )}

        {/* Draggable Legend */}
        {legendPos !== null && containerRef.current && (
          <Rnd
            size={legendSize}
            position={legendPos}
            bounds={containerRef.current} // restrict movement inside canvas
            onDragStop={(_, d) => setLegendPos({ x: d.x, y: d.y })}
            onResizeStop={(_, __, ref, ___, pos) => {
              setLegendSize({
                width: ref.offsetWidth,
                height: ref.offsetHeight,
              });
              setLegendPos({ x: pos.x, y: pos.y });
            }}
            minWidth={140}
            minHeight={80}
            style={{
              position: "absolute",
              zIndex: 20,
              background: "#fafafa",
              border: "1px solid #ccc",
              borderRadius: 6,
              padding: 4,
              display: "flex",
              flexDirection: "column",
              // Keep overflow visible so auto-sized labels and export bounds
              // include the legend's complete content.
            }}
            enableResizing={{
              bottom: true,
              bottomLeft: true,
              bottomRight: true,
              left: true,
              right: true,
              top: true,
              topLeft: true,
              topRight: true,
            }}
          >
            <div ref={legendRef}>
              <NodeLegend
                getColorForType={getColorForType}
                updateColor={updateColor}
                resetColors={resetColors}
                activeTypes={activeTypes}
                openColorPicker={(type, pos) =>
                  setActiveColorPicker({ type, position: pos })
                }
                isColumnLayout={isLegendColumnLayout}
                onToggleLayout={handleToggleLegendLayout}
              />
            </div>
          </Rnd>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "#ffffffaa",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            <div className="spinner" />
            <style jsx>{`
              .spinner {
                border: 6px solid #f3f3f3;
                border-top: 6px solid #3498db;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
        </div>
      </div>

      {/* Active Color Picker */}
      {featureFlags.colorChange && activeColorPicker && (
        <ColorPicker
          key={activeColorPicker.type}
          color={getColorForType(activeColorPicker.type)}
          position={activeColorPicker.position}
          onChange={c => updateColor(activeColorPicker.type, c)}
          onClose={() => setActiveColorPicker(null)}
        />
      )}

      {/* Preview Export Modal */}
      {previewCanvas && previewCanvasNoLegend && (
        <ExportPreviewModal
          canvas={previewCanvas}
          canvasNoLegend={previewCanvasNoLegend}
          svgString={previewSvg ?? undefined}
          svgStringNoLegend={previewSvgNoLegend ?? undefined}
          verbalization={pair.verbalization?.trim() || undefined}
          fileName={`${pair.source}_${pair.target}`}
          onClose={() => {
            setPreviewCanvas(null);
            setPreviewCanvasNoLegend(null);
            setPreviewSvg(null);
            setPreviewSvgNoLegend(null);
          }}
        />
      )}

    </div>
  );
}

