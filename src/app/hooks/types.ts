export interface Node {
  id: string;
  type: string;
  link?: string;
}

export interface Edge {
  source: string;
  target: string;
  label: string;
  type?: "NE" | "LCA";
}

export interface Score {
  scientific_validity?: number;
  completeness?: number;
  relevance?: number;
  ic_mean?: number;
  agentic_score?: number;
  final_score: number;
}

export interface Path {
  id: string;
  score: Score;
  reasoning: string;
  verbalization?: string;
  nodes: Node[];
  edges: Edge[];
  lowest_common_ancestors?: Record<string, string[]>;
}

export interface Pair {
  id: string;
  source: string; // ID of the source node
  target: string; // ID of the target node
  verbalization?: string;
  paths: Path[];
}

export type ExplanationSearchStatus =
  | "idle"
  | "checking"
  | "failed"
  | "missing";

export interface ExplanationSearchState {
  status: ExplanationSearchStatus;
  message?: string;
}
