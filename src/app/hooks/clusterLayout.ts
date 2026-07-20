import type { Core } from "cytoscape";

type Position = { x: number; y: number };

function layoutClusterNodesAsGrid(
  nodeIds: string[],
  center: Position,
  stepX: number,
  stepY: number
): Record<string, Position> {
  const positions: Record<string, Position> = {};
  const total = nodeIds.length;
  if (total === 0) return positions;

  const cols = Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.ceil(total / cols);
  const xOffset = ((cols - 1) * stepX) / 2;
  const yOffset = ((rows - 1) * stepY) / 2;

  for (let i = 0; i < total; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[nodeIds[i]] = {
      x: center.x + col * stepX - xOffset,
      y: center.y + row * stepY - yOffset,
    };
  }

  return positions;
}

export function runClusterLayoutByType(cy: Core, fit = true) {
  const nodesByType = new Map<string, string[]>();
  cy.nodes().forEach((node) => {
    const type = String(node.data("type") ?? "Unknown");
    const bucket = nodesByType.get(type) ?? [];
    bucket.push(node.id());
    nodesByType.set(type, bucket);
  });

  const sortedTypes = [...nodesByType.keys()].sort((a, b) => a.localeCompare(b));
  const clusterCount = sortedTypes.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(clusterCount)));
  const rows = Math.max(1, Math.ceil(clusterCount / cols));
  const nodeStepX = 260;
  const nodeStepY = 230;
  const maxClusterSize = Math.max(
    1,
    ...sortedTypes.map((type) => (nodesByType.get(type) ?? []).length)
  );
  const approxClusterCols = Math.max(1, Math.ceil(Math.sqrt(maxClusterSize)));
  const approxClusterRows = Math.max(1, Math.ceil(maxClusterSize / approxClusterCols));
  const clusterGapX = Math.max(900, approxClusterCols * nodeStepX + 320);
  const clusterGapY = Math.max(760, approxClusterRows * nodeStepY + 280);

  const positions: Record<string, Position> = {};
  sortedTypes.forEach((type, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const center = {
      x: (col - (cols - 1) / 2) * clusterGapX,
      y: (row - (rows - 1) / 2) * clusterGapY,
    };
    const ids = (nodesByType.get(type) ?? []).slice().sort();
    Object.assign(positions, layoutClusterNodesAsGrid(ids, center, nodeStepX, nodeStepY));
  });

  cy.layout({
    name: "preset",
    positions,
    animate: true,
    fit,
    padding: 48,
  }).run();
}
