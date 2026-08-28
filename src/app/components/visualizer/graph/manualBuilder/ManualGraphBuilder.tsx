"use client";

import React from "react";
import {
  ManualBuilderTab,
  ManualGraphEdge,
  ManualGraphNode,
  ManualGraphRelation,
  ManualLayoutName,
} from "./useManualGraphBuilder";
import { useStudyEventLogger } from "@/app/hooks/useStudyTelemetry";

const LAYOUT_OPTIONS: Array<{ value: ManualLayoutName; label: string }> = [
  { value: "breadthfirst", label: "Breadth First (default)" },
  { value: "circle", label: "Circle" },
  { value: "cluster", label: "Cluster (by type)" },
  { value: "concentric", label: "Concentric" },
  { value: "grid", label: "Grid" },
  { value: "hierarchicalClassic", label: "Hierarchical (classic)" },
];

interface ManualGraphBuilderProps {
  nodes: ManualGraphNode[];
  relations: ManualGraphRelation[];
  addedNodeIds: Set<string>;
  edges: ManualGraphEdge[];
  activeTab: ManualBuilderTab;
  setActiveTab: (tab: ManualBuilderTab) => void;
  layoutName: ManualLayoutName;
  setLayoutName: (layout: ManualLayoutName) => void;
  addNode: (nodeId: string) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  selectedRelationId?: string;
  pendingSourceId?: string | null;
  selectRelation: (relation: ManualGraphRelation) => void;
  cancelConnection: () => void;
  clearGraph: () => void;
  getColorForType: (type: string) => string;
}

export default function ManualGraphBuilder({
  nodes,
  relations,
  addedNodeIds,
  edges,
  activeTab,
  setActiveTab,
  layoutName,
  setLayoutName,
  addNode,
  removeNode,
  removeEdge,
  selectedRelationId,
  pendingSourceId,
  selectRelation,
  cancelConnection,
  clearGraph,
  getColorForType,
}: ManualGraphBuilderProps) {
  const logEvent = useStudyEventLogger();

  const handleAddNode = (node: ManualGraphNode, method: "click" | "keyboard") => {
    logEvent("manual_node_added", {
      node_id: node.id,
      node_type: node.type,
      method,
    });
    addNode(node.id);
  };

  const handleSelectRelation = (
    relation: ManualGraphRelation,
    method: "click" | "keyboard"
  ) => {
    logEvent("manual_relation_selected", {
      relation_id: relation.id,
      relation: relation.label,
      relation_type: relation.type,
      method,
    });
    selectRelation(relation);
  };

  return (
    <aside
      aria-label="Graph construction panel"
      style={{
        width: "clamp(230px, 20vw, 310px)",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        borderRight: "1px solid #cbd5e1",
        backgroundColor: "#f8fafc",
        color: "#111827",
        zIndex: 25,
      }}
    >
      <div style={{ padding: "0.85rem 0.85rem 0.55rem" }}>
        <strong style={{ fontSize: "clamp(14px, 0.85vw, 18px)" }}>
          Construct the graph
        </strong>
        <p
          style={{
            margin: "0.35rem 0 0",
            color: "#4b5563",
            fontSize: "clamp(11px, 0.68vw, 14px)",
            lineHeight: 1.35,
          }}
        >
          Click an item to add it, or drag it onto the canvas.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Graph element type"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          padding: "0 0.65rem 0.65rem",
          gap: "0.4rem",
        }}
      >
        {(["nodes", "edges", "layout"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const count =
            tab === "nodes"
              ? addedNodeIds.size
              : tab === "edges"
                ? edges.length
                : null;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                if (tab !== activeTab) {
                  logEvent("builder_tab_changed", {
                    previous_tab: activeTab,
                    new_tab: tab,
                  });
                  setActiveTab(tab);
                }
              }}
              style={{
                padding: "0.55rem 0.4rem",
                borderRadius: 7,
                border: isActive ? "2px solid #2563eb" : "1px solid #9ca3af",
                backgroundColor: isActive ? "#eff6ff" : "#ffffff",
                color: "#111827",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {tab === "nodes" ? "Nodes" : tab === "edges" ? "Edges" : "Layout"}
              {count !== null && ` (${count})`}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: activeTab === "edges" ? "hidden" : "auto",
          padding: "0 0.65rem 0.75rem",
        }}
      >
        {activeTab === "nodes" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            {nodes.map((node) => {
              const isAdded = addedNodeIds.has(node.id);
              return (
                <div
                  key={node.id}
                  draggable={!isAdded}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("application/x-addex-node", node.id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => !isAdded && handleAddNode(node, "click")}
                  onKeyDown={(event) => {
                    if (!isAdded && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      handleAddNode(node, "keyboard");
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${isAdded ? "Added" : "Add"} node ${node.id}`}
                  style={{
                    padding: "0.6rem",
                    borderRadius: 8,
                    border: isAdded ? "1px solid #86efac" : "1px solid #94a3b8",
                    backgroundColor: isAdded ? "#f0fdf4" : "#ffffff",
                    cursor: isAdded ? "default" : "grab",
                    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 13,
                        height: 13,
                        flexShrink: 0,
                        borderRadius: 3,
                        border: "1px solid #475569",
                        backgroundColor: getColorForType(node.type),
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 650, overflowWrap: "anywhere" }}>
                        {node.id}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 11 }}>
                        {node.type.replace(/_/g, " ")}
                      </div>
                    </div>
                    {isAdded && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          logEvent("manual_node_removed", {
                            node_id: node.id,
                            node_type: node.type,
                            connected_edge_count: edges.filter(
                              (edge) => edge.source === node.id || edge.target === node.id
                            ).length,
                          });
                          removeNode(node.id);
                        }}
                        aria-label={`Remove node ${node.id}`}
                        title="Remove node"
                        style={{ padding: "0.2rem 0.4rem", borderRadius: 5 }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeTab === "edges" ? (
          <div
            style={{
              height: "100%",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.45rem",
              }}
            >
              <p style={{ margin: "0 0 0.25rem", color: "#4b5563", fontSize: 12 }}>
              {addedNodeIds.size < 2
                ? "Add at least two nodes before creating a relationship."
                : pendingSourceId
                  ? "Source selected. Now click the target node on the canvas."
                  : selectedRelationId
                    ? "Relationship selected. Click its source node on the canvas."
                    : "Choose a relationship, then click its source and target nodes."}
              </p>
              {relations.map((relation) => {
              const isSelected = selectedRelationId === relation.id;
              const isAvailable = addedNodeIds.size >= 2;
              return (
                <div
                  key={relation.id}
                  draggable={isAvailable}
                  onDragStart={(event) => {
                    if (!isAvailable) return;
                    event.dataTransfer.setData(
                      "application/x-addex-relation",
                      relation.id
                    );
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() =>
                    isAvailable && handleSelectRelation(relation, "click")
                  }
                  onKeyDown={(event) => {
                    if (
                      isAvailable &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      handleSelectRelation(relation, "keyboard");
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-disabled={!isAvailable}
                  aria-pressed={isSelected}
                  aria-label={`Select relation ${relation.label}`}
                  style={{
                    padding: "0.6rem",
                    borderRadius: 8,
                    border: isSelected
                      ? "2px solid #2563eb"
                      : isAvailable
                        ? "1px solid #60a5fa"
                        : "1px solid #cbd5e1",
                    backgroundColor: isSelected
                      ? "#dbeafe"
                      : isAvailable
                        ? "#eff6ff"
                        : "#f1f5f9",
                    opacity: isAvailable ? 1 : 0.58,
                    cursor: isAvailable ? "pointer" : "default",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <strong
                      style={{
                        minWidth: 0,
                        flex: 1,
                        color: "#1d4ed8",
                        fontSize: 13,
                        lineHeight: 1.4,
                        overflowWrap: "anywhere",
                        textAlign: "center",
                      }}
                    >
                      {relation.label.replace(/_/g, " ")}
                    </strong>
                  </div>
                </div>
              );
              })}
              {selectedRelationId && (
                <button
                  type="button"
                  onClick={() => {
                    logEvent("manual_connection_cancelled", {
                      stage: pendingSourceId ? "source_selected" : "relation_selected",
                      source_id: pendingSourceId ?? null,
                      relation_id: selectedRelationId ?? null,
                    });
                    cancelConnection();
                  }}
                >
                  Cancel connection
                </button>
              )}
            </div>

            {edges.length > 0 && (
              <section
                aria-label="Added edges"
                style={{
                  minHeight: 0,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem",
                  paddingTop: "0.55rem",
                  borderTop: "1px solid #cbd5e1",
                }}
              >
                <strong style={{ color: "#334155", fontSize: 12 }}>
                  Added edges
                </strong>
                <div
                  style={{
                    minHeight: 0,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.45rem",
                    paddingRight: "0.15rem",
                  }}
                >
                  {edges.map((edge) => (
                    <div
                      key={edge.id}
                      style={{
                        flexShrink: 0,
                        padding: "0.6rem",
                        borderRadius: 8,
                        border: "1px solid #86efac",
                        backgroundColor: "#f0fdf4",
                        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
                      }}
                    >
                      <div
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 650,
                              fontSize: 13,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {edge.source} &rarr; {edge.target}
                          </div>
                          <div
                            style={{
                              color: "#64748b",
                              fontSize: 11,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {edge.label.replace(/_/g, " ")}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            logEvent("manual_edge_removed", {
                              edge_id: edge.id,
                              source_id: edge.source,
                              target_id: edge.target,
                              relation: edge.label,
                              relation_type: edge.type,
                            });
                            removeEdge(edge.id);
                          }}
                          aria-label={`Remove edge from ${edge.source} to ${edge.target}`}
                          title="Remove edge"
                          style={{ padding: "0.2rem 0.4rem", borderRadius: 5 }}
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <fieldset
            style={{
              margin: 0,
              padding: 0,
              border: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <legend
              style={{
                marginBottom: "0.35rem",
                color: "#4b5563",
                fontSize: 12,
                lineHeight: 1.35,
              }}
            >
              Choose how the nodes are arranged. You can still move them manually.
            </legend>
            {LAYOUT_OPTIONS.map((option) => {
              const isSelected = layoutName === option.value;
              return (
                <label
                  key={option.value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.55rem",
                    padding: "0.6rem",
                    borderRadius: 8,
                    border: isSelected
                      ? "2px solid #2563eb"
                      : "1px solid #94a3b8",
                    backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: isSelected ? 700 : 500,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => setLayoutName(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </fieldset>
        )}
      </div>

      <div style={{ padding: "0.65rem", borderTop: "1px solid #cbd5e1" }}>
        <button
          type="button"
          onClick={() => {
            logEvent("manual_graph_cleared", {
              node_count_before: addedNodeIds.size,
              edge_count_before: edges.length,
            });
            clearGraph();
          }}
          disabled={addedNodeIds.size === 0}
          style={{ width: "100%", padding: "0.5rem", borderRadius: 7 }}
        >
          Clear graph
        </button>
      </div>
    </aside>
  );
}
