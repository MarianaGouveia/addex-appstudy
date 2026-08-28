export const STUDY_MODALITIES = ["graph", "text", "hybrid", "sumarize"] as const;

export type StudyModality = (typeof STUDY_MODALITIES)[number];

interface StudyPairDefinition {
  taskId: string;
  task: "drug_repurposing" | "drug_target";
  sourceId: string;
  targetId: string;
  sourceQueryId: string;
  targetQueryId: string;
}

/** The six pairs used in the study, in the codes defined by the protocol. */
export const STUDY_PAIRS: readonly StudyPairDefinition[] = [
  {
    taskId: "DR1",
    task: "drug_repurposing",
    sourceId: "DB00175",
    targetId: "DOID1936",
    sourceQueryId: "DB00175",
    targetQueryId: "DOID1936",
  },
  {
    taskId: "DR2",
    task: "drug_repurposing",
    sourceId: "DB01222",
    targetId: "DOID2841",
    sourceQueryId: "DB01222",
    targetQueryId: "DOID2841",
  },
  {
    taskId: "DR3",
    task: "drug_repurposing",
    sourceId: "DB01039",
    targetId: "DOID3393",
    sourceQueryId: "DB01039",
    targetQueryId: "DOID3393",
  },
  {
    taskId: "DTI1",
    task: "drug_target",
    sourceId: "DB00714",
    targetId: "NCBI1813",
    sourceQueryId: "DB00714",
    targetQueryId: "1813",
  },
  {
    taskId: "DTI2",
    task: "drug_target",
    sourceId: "DB01114",
    targetId: "NCBI1565",
    sourceQueryId: "DB01114",
    targetQueryId: "1565",
  },
  {
    taskId: "DTI3",
    task: "drug_target",
    sourceId: "DB01183",
    targetId: "4988",
    sourceQueryId: "DB01183",
    targetQueryId: "4988",
  },
] as const;

function normalizeQueryEntityId(value: string): string {
  const finalSegment = value.split("__").at(-1) ?? value;
  return finalSegment.replace(/[_:\s-]/g, "").toUpperCase();
}

export function normalizeStudyModality(value: string | null): StudyModality {
  const normalized = value?.trim().toLowerCase();
  return STUDY_MODALITIES.includes(normalized as StudyModality)
    ? (normalized as StudyModality)
    : "hybrid";
}

export function findStudyPair(
  task: string,
  source: string,
  target: string
): StudyPairDefinition | null {
  const sourceQueryId = normalizeQueryEntityId(source);
  const targetQueryId = normalizeQueryEntityId(target);

  return (
    STUDY_PAIRS.find(
      (pair) =>
        pair.task === task &&
        pair.sourceQueryId === sourceQueryId &&
        pair.targetQueryId === targetQueryId
    ) ?? null
  );
}

export function createStudyPairCode(
  task: string,
  source: string,
  target: string,
  modality: StudyModality
): string | null {
  const pair = findStudyPair(task, source, target);
  if (!pair) return null;
  return `${pair.taskId}_${pair.sourceId}_${pair.targetId}_${modality}`;
}
