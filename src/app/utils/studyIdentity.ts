import { featureFlags } from "@/app/config/featureFlags";
import {
  createStudyPairCode,
  findStudyPair,
  normalizeStudyModality,
  StudyModality,
} from "@/app/config/studyPairs";

export interface StudyIdentity {
  formCode: string;
  pairCode: string;
  taskId: string;
  sourceId: string;
  targetId: string;
  modality: StudyModality;
  persona: string;
  dataset: string;
}

const FORM_CODE_PATTERN = /^Form(?:[1-9]\d*)$/i;

export function resolveFormCode(searchParams: URLSearchParams): string {
  if (!featureFlags.forms) return "Form0";

  const requestedCode = searchParams.get("form")?.trim() ?? "";
  if (!FORM_CODE_PATTERN.test(requestedCode)) return "Form0";
  return `Form${requestedCode.slice(4)}`;
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
    formCode: resolveFormCode(searchParams),
    pairCode,
    taskId: pair.taskId,
    sourceId: pair.sourceId,
    targetId: pair.targetId,
    modality,
    persona: searchParams.get("persona")?.trim() ?? "",
    dataset: searchParams.get("dataset")?.trim() ?? "",
  };
}
