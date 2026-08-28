"use client";

import {
  createContext,
  createElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { featureFlags } from "@/app/config/featureFlags";
import { StudyIdentity } from "@/app/utils/studyIdentity";
import {
  createStudyTelemetrySession,
  flushStudyTelemetry,
  queueStudyEvent,
  StudyEventData,
  StudyEventName,
  StudyTelemetrySession,
} from "@/app/utils/studyTelemetry";

type StudyEventLogger = (
  eventName: StudyEventName,
  eventData?: StudyEventData
) => void;

const NOOP_LOGGER: StudyEventLogger = () => {};
const StudyTelemetryContext = createContext<StudyEventLogger>(NOOP_LOGGER);

export function StudyTelemetryProvider({
  logEvent,
  children,
}: {
  logEvent: StudyEventLogger;
  children: ReactNode;
}) {
  return createElement(StudyTelemetryContext.Provider, { value: logEvent }, children);
}

export function useStudyEventLogger() {
  return useContext(StudyTelemetryContext);
}

export function useStudyTelemetry(
  identity: StudyIdentity | null,
  finalState: StudyEventData = {}
) {
  const sessionRef = useRef<StudyTelemetrySession | null>(null);
  const finalStateRef = useRef(finalState);
  finalStateRef.current = finalState;

  const logEvent = useCallback(
    (eventName: StudyEventName, eventData: StudyEventData = {}) => {
      if (sessionRef.current) {
        queueStudyEvent(sessionRef.current, eventName, eventData);
      }
    },
    []
  );

  useEffect(() => {
    if (!featureFlags.logs || !identity) return;

    const session = createStudyTelemetrySession(identity);
    let ended = false;
    sessionRef.current = session;
    queueStudyEvent(session, "explanation_opened", {
      page_visible: document.visibilityState === "visible",
      window_focused: document.hasFocus(),
    });

    const onVisibilityChange = () => {
      queueStudyEvent(session, "page_visibility_changed", {
        state: document.visibilityState,
      });
      if (document.visibilityState === "visible") void flushStudyTelemetry();
    };
    const onFocus = () => {
      queueStudyEvent(session, "window_focus_changed", { focused: true });
      void flushStudyTelemetry();
    };
    const onBlur = () =>
      queueStudyEvent(session, "window_focus_changed", { focused: false });
    const onOnline = () => void flushStudyTelemetry();
    const onPageHide = () => {
      if (ended) return;
      ended = true;
      queueStudyEvent(session, "session_ended", {
        reason: "page_hidden_or_closed",
        ...finalStateRef.current,
      });
      void flushStudyTelemetry();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onPageHide);
    const flushTimer = window.setInterval(() => void flushStudyTelemetry(), 10_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(flushTimer);
      if (sessionRef.current === session) {
        if (!ended) {
          ended = true;
          queueStudyEvent(session, "session_ended", {
            reason: "pair_changed",
            ...finalStateRef.current,
          });
        }
        sessionRef.current = null;
      }
    };
  }, [identity]);

  return { logEvent };
}
