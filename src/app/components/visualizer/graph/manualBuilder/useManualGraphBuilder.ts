"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pair } from "@/app/hooks/types";

export type ManualBuilderTab = "nodes" | "edges" | "layout";
export type ManualLayoutName =
  | "breadthfirst"
  | "circle"
  | "cluster"
  | "concentric"
  | "grid"
  | "hierarchicalClassic";

export interface ManualGraphNode {
  id: string;
  type: string;
}

export interface ManualGraphRelation {
  id: string;
  label: string;
  type: string;
}

export interface ManualGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
}

export interface ManualNodePosition {
  x: number;
  y: number;
}

export function useManualGraphBuilder(pair: Pair, enabled: boolean) {
  const [nodeIds, setNodeIds] = useState<Set<string>>(new Set());
  const [edges, setEdges] = useState<ManualGraphEdge[]>([]);
  const [activeTab, setActiveTab] = useState<ManualBuilderTab>("nodes");
  const [layoutName, setLayoutName] =
    useState<ManualLayoutName>("breadthfirst");
  const [selectedRelation, setSelectedRelation] =
    useState<ManualGraphRelation | null>(null);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const nodePositionsRef = useRef<Record<string, ManualNodePosition>>({});

  const catalog = useMemo(() => {
    const nodes = new Map<string, ManualGraphNode>();
    const relations = new Map<string, ManualGraphRelation>();

    // Match the default visualization and exclude LCA/extra-path elements.
    pair.paths.slice(0, 3).forEach((path) => {
      path.nodes.forEach((node) => {
        if (node.type.toLowerCase() === "lca") return;
        nodes.set(node.id, node);
      });
      path.edges.forEach((edge) => {
        if (edge.type === "LCA") return;
        const type = edge.type ?? "NE";
        const id = `${type}-${edge.label}`;
        relations.set(id, { id, label: edge.label, type });
      });
    });

    return {
      nodes: Array.from(nodes.values()).sort((a, b) => a.id.localeCompare(b.id)),
      relations: Array.from(relations.values()).sort((a, b) =>
        a.label.localeCompare(b.label)
      ),
    };
  }, [pair]);

  const cancelConnection = useCallback(() => {
    setSelectedRelation(null);
    setPendingSourceId(null);
  }, []);

  const clear = useCallback(() => {
    // Preserve the existing references when the graph is already empty. This
    // prevents mount/reset effects from emitting a second identical graph
    // checkpoint without an intervening participant action.
    setNodeIds((current) => (current.size === 0 ? current : new Set()));
    setEdges((current) => (current.length === 0 ? current : []));
    nodePositionsRef.current = {};
    cancelConnection();
  }, [cancelConnection]);

  useEffect(() => {
    clear();
    setActiveTab("nodes");
    setLayoutName("breadthfirst");
  }, [pair.id, enabled, clear]);

  const addNode = useCallback(
    (nodeId: string, position?: ManualNodePosition) => {
      const fallbackIndex = nodeIds.size;
      const fallbackPosition = {
        x: 180 + (fallbackIndex % 3) * 210,
        y: 150 + Math.floor(fallbackIndex / 3) * 150,
      };
      setNodeIds((current) => new Set(current).add(nodeId));
      nodePositionsRef.current = {
        ...nodePositionsRef.current,
        [nodeId]:
          position ?? nodePositionsRef.current[nodeId] ?? fallbackPosition,
      };
    },
    [nodeIds.size]
  );

  const removeNode = useCallback((nodeId: string) => {
    setNodeIds((current) => {
      const next = new Set(current);
      next.delete(nodeId);
      return next;
    });
    setEdges((current) =>
      current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    );
    const nextPositions = { ...nodePositionsRef.current };
    delete nextPositions[nodeId];
    nodePositionsRef.current = nextPositions;
    setPendingSourceId((current) => (current === nodeId ? null : current));
  }, []);

  const selectRelation = useCallback((relation: ManualGraphRelation) => {
    setSelectedRelation(relation);
    setPendingSourceId(null);
  }, []);

  const selectEndpoint = useCallback(
    (nodeId: string) => {
      if (!selectedRelation || !nodeIds.has(nodeId)) return;
      if (!pendingSourceId) {
        setPendingSourceId(nodeId);
        return;
      }
      if (pendingSourceId === nodeId) return;

      const id = `${pendingSourceId}-${nodeId}-${selectedRelation.label}`;
      setEdges((current) => {
        if (current.some((edge) => edge.id === id)) return current;
        return [
          ...current,
          {
            id,
            source: pendingSourceId,
            target: nodeId,
            label: selectedRelation.label,
            type: selectedRelation.type,
          },
        ];
      });
      setPendingSourceId(null);
      setSelectedRelation(null);
    },
    [nodeIds, pendingSourceId, selectedRelation]
  );

  const removeEdge = useCallback((edgeId: string) => {
    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
  }, []);

  const updateNodePosition = useCallback(
    (nodeId: string, position: ManualNodePosition) => {
      nodePositionsRef.current[nodeId] = position;
    },
    []
  );

  return {
    catalog,
    nodeIds,
    edges,
    nodePositions: nodePositionsRef.current,
    activeTab,
    setActiveTab,
    layoutName,
    setLayoutName,
    selectedRelation,
    pendingSourceId,
    addNode,
    removeNode,
    selectRelation,
    selectEndpoint,
    cancelConnection,
    removeEdge,
    updateNodePosition,
    clear,
  };
}
