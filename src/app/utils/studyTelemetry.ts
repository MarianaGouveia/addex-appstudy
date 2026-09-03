import { featureFlags } from "@/app/config/featureFlags";
import { StudyIdentity } from "@/app/utils/studyIdentity";

export type StudyEventName =
  | "explanation_opened"
  | "explanation_load_completed"
  | "page_visibility_changed"
  | "window_focus_changed"
  | "session_ended"
  | "content_tab_changed"
  | "panel_layout_changed"
  | "path_visibility_changed"
  | "lca_visibility_changed"
  | "other_paths_toggled"
  | "path_inspected"
  | "node_inspected"
  | "node_moved"
  | "lca_inspected"
  | "external_reference_clicked"
  | "graph_viewport_changed"
  | "graph_centered"
  | "graph_reloaded"
  | "grid_toggled"
  | "font_size_changed"
  | "reading_progress"
  | "summary_copied"
  | "summary_downloaded"
  | "graph_exported"
  | "builder_tab_changed"
  | "manual_node_added"
  | "manual_node_removed"
  | "manual_relation_selected"
  | "manual_edge_added"
  | "manual_edge_removed"
  | "manual_connection_cancelled"
  | "manual_node_moved"
  | "manual_layout_changed"
  | "manual_graph_cleared"
  | "manual_graph_checkpoint"
  | "manual_graph_final_state"
  | "interaction_error";

export type StudyJsonValue =
  | string
  | number
  | boolean
  | null
  | StudyJsonValue[]
  | { [key: string]: StudyJsonValue };

export type StudyEventData = Record<string, StudyJsonValue>;

export interface StudyTelemetrySession {
  identity: StudyIdentity;
  sessionId: string;
  startedAtEpochMs: number;
  nextSequenceNumber: number;
}

interface QueuedStudyEvent {
  id: string;
  client_timestamp: string;
  session_id: string;
  sequence_number: number;
  pair_code: string;
  persona: string;
  dataset: string;
  event_name: StudyEventName;
  elapsed_ms: number;
  event_data: StudyEventData;
  schema_version: number;
}

const QUEUE_KEY = "study-telemetry-queue-v1";
const MAX_QUEUED_EVENTS = 25_000;
const BATCH_SIZE = 100;
const SCHEMA_VERSION = 1;
const DUPLICATE_EVENT_WINDOW_MS = 1_000;

let activeFlush: Promise<void> | null = null;
const recentEventFingerprints = new Map<string, number>();

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function serializeForFingerprint(value: StudyJsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map(serializeForFingerprint).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${serializeForFingerprint(value[key])}`
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isImmediateDuplicate(
  session: StudyTelemetrySession,
  eventName: StudyEventName,
  eventData: StudyEventData,
  now: number
): boolean {
  const { identity } = session;
  const fingerprint = [
    session.sessionId,
    identity.pairCode,
    identity.persona,
    identity.dataset,
    eventName,
    serializeForFingerprint(eventData),
  ].join("\u0000");
  const previousTimestamp = recentEventFingerprints.get(fingerprint);

  for (const [key, timestamp] of recentEventFingerprints) {
    if (now - timestamp > DUPLICATE_EVENT_WINDOW_MS) {
      recentEventFingerprints.delete(key);
    }
  }
  recentEventFingerprints.set(fingerprint, now);

  return (
    previousTimestamp !== undefined &&
    now - previousTimestamp <= DUPLICATE_EVENT_WINDOW_MS
  );
}

function readQueue(): QueuedStudyEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as QueuedStudyEvent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(events: QueuedStudyEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      QUEUE_KEY,
      JSON.stringify(events.slice(-MAX_QUEUED_EVENTS))
    );
  } catch (error) {
    console.error("Unable to persist the study telemetry queue", error);
  }
}

function removeDeprecatedFields(
  queuedEvent: QueuedStudyEvent
): QueuedStudyEvent {
  // Older deployed clients may still have these fields in localStorage. Strip
  // them at upload time so queued events remain compatible with migrations
  // 003 and 004.
  const event = {
    ...queuedEvent,
  } as QueuedStudyEvent & Record<string, unknown>;
  delete event.form_code;
  delete event.task_id;
  delete event.source_id;
  delete event.target_id;
  delete event.modality;
  return event;
}

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}

export function createStudyTelemetrySession(
  identity: StudyIdentity
): StudyTelemetrySession {
  return {
    identity,
    sessionId: createId(),
    startedAtEpochMs: Date.now(),
    nextSequenceNumber: 1,
  };
}

export function queueStudyEvent(
  session: StudyTelemetrySession,
  eventName: StudyEventName,
  eventData: StudyEventData = {}
): void {
  if (!featureFlags.logs || typeof window === "undefined") return;

  const { identity } = session;
  const now = Date.now();
  if (isImmediateDuplicate(session, eventName, eventData, now)) return;

  const event: QueuedStudyEvent = {
    id: createId(),
    client_timestamp: new Date(now).toISOString(),
    session_id: session.sessionId,
    sequence_number: session.nextSequenceNumber++,
    pair_code: identity.pairCode,
    persona: identity.persona,
    dataset: identity.dataset,
    event_name: eventName,
    elapsed_ms: Math.max(0, now - session.startedAtEpochMs),
    event_data: eventData,
    schema_version: SCHEMA_VERSION,
  };

  writeQueue([...readQueue(), event]);
  void flushStudyTelemetry();
}

export function flushStudyTelemetry(): Promise<void> {
  if (activeFlush) return activeFlush;
  if (!featureFlags.logs || typeof window === "undefined") {
    return Promise.resolve();
  }

  const config = getSupabaseConfig();
  if (!config || !navigator.onLine) return Promise.resolve();

  activeFlush = (async () => {
    while (true) {
      const batch = readQueue().slice(0, BATCH_SIZE);
      if (batch.length === 0) return;
      const uploadBatch = batch.map(removeDeprecatedFields);

      try {
        const response = await fetch(
          `${config.url}/rest/v1/interaction_logs`,
          {
            method: "POST",
            headers: {
              apikey: config.publishableKey,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify(uploadBatch),
            keepalive: true,
          }
        );

        if (!response.ok) {
          console.error(
            `Study telemetry upload failed with HTTP ${response.status}`
          );
          return;
        }

        const sentIds = new Set(batch.map((event) => event.id));
        writeQueue(readQueue().filter((event) => !sentIds.has(event.id)));
      } catch {
        // Retain the batch in localStorage. Online/focus/timer events retry it.
        return;
      }
    }
  })().finally(() => {
    activeFlush = null;
  });

  return activeFlush;
}

export function getQueuedStudyEventCount(): number {
  return readQueue().length;
}
