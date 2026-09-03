import {
  createStudyPairCode,
  findStudyPair,
  normalizeStudyModality,
  StudyModality,
} from "@/app/config/studyPairs";

export interface StudyIdentity {
  pairCode: string;
  taskId: string;
  sourceId: string;
  targetId: string;
  modality: StudyModality;
  persona: string;
  dataset: string;
}

export function resolveStudyIdentity(
  searchParams: URLSearchParams
): StudyIdentity | null {
  const task = searchParams.get("task") ?? "";
  const source = searchParams.get("source") ?? "";
  const target = searchParams.get("target") ?? "";
  const modality = normalizeStudyModality(searchParams.get("modality"));
  const pair = findStudyPair(task, source, target);
  const pairCode = createStudyPairCode(task, source, target, modality);

  if (!pair || !pairCode) return null;

  return {
    pairCode,
    taskId: pair.taskId,
    sourceId: pair.sourceId,
    targetId: pair.targetId,
    modality,
    persona: searchParams.get("persona")?.trim() ?? "",
    dataset: searchParams.get("dataset")?.trim() ?? "",
  };
}
