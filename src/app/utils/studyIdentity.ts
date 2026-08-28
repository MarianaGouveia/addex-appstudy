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

const GOOGLE_FORM_ID_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;
const GOOGLE_FORM_PATH_PATTERN =
  /^\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?([A-Za-z0-9_-]{20,200})(?:\/|$)/;

function extractGoogleFormId(value: string): string | null {
  if (GOOGLE_FORM_ID_PATTERN.test(value)) return value;

  try {
    const url = new URL(value);
    if (url.hostname !== "docs.google.com") return null;
    return url.pathname.match(GOOGLE_FORM_PATH_PATTERN)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function resolveFormCode(searchParams: URLSearchParams): string {
  if (!featureFlags.forms) return "unassigned";

  const requestedCode = searchParams.get("form")?.trim() ?? "";
  return extractGoogleFormId(requestedCode) ?? "unassigned";
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
