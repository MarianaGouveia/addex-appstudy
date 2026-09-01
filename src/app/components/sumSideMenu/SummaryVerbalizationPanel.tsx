"use client";

import React, { useEffect, useRef, useState } from "react";
import { useStudyEventLogger } from "@/app/hooks/useStudyTelemetry";

interface SummaryVerbalizationPanelProps {
  verbalization: string;
}

const MIN_FONT = 12;
const MAX_FONT = 30;

export default function SummaryVerbalizationPanel({
  verbalization,
}: SummaryVerbalizationPanelProps) {
  const [fontSize, setFontSize] = useState(16);
  const readingThresholdsRef = useRef(new Set<number>());
  const logEvent = useStudyEventLogger();

  useEffect(() => {
    readingThresholdsRef.current.clear();
  }, [verbalization]);

  const changeFontSize = (direction: "increase" | "decrease") => {
    const next = Math.min(
      MAX_FONT,
      Math.max(MIN_FONT, fontSize + (direction === "increase" ? 1 : -1))
    );
    if (next === fontSize) return;
    logEvent("font_size_changed", {
      previous_size: fontSize,
      new_size: next,
      direction,
    });
    setFontSize(next);
  };

  return (
    <section
      aria-label="Adaptive verbalization"
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        padding: "clamp(1rem, 1.4vw, 1.8rem)",
        border: "1px solid #d1d5db",
        borderRadius: 12,
        backgroundColor: "#ffffff",
        color: "#000000",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1rem",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid #d1d5db",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "clamp(1rem, 1.1vw, 1.4rem)" }}>
          Verbalization
        </h2>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => changeFontSize("decrease")}
            disabled={fontSize <= MIN_FONT}
            aria-label="Decrease font size"
            title="Decrease font size"
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              border: "1px solid #9ca3af",
              backgroundColor: "#ffffff",
              color: "#000000",
              fontWeight: 700,
              cursor: fontSize <= MIN_FONT ? "not-allowed" : "pointer",
              opacity: fontSize <= MIN_FONT ? 0.45 : 1,
            }}
          >
            A-
          </button>
          <button
            type="button"
            onClick={() => changeFontSize("increase")}
            disabled={fontSize >= MAX_FONT}
            aria-label="Increase font size"
            title="Increase font size"
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              border: "1px solid #9ca3af",
              backgroundColor: "#ffffff",
              color: "#000000",
              fontWeight: 700,
              cursor: fontSize >= MAX_FONT ? "not-allowed" : "pointer",
              opacity: fontSize >= MAX_FONT ? 0.45 : 1,
            }}
          >
            A+
          </button>
        </div>
      </div>

      <div
        style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
        onScroll={(event) => {
          const element = event.currentTarget;
          const scrollable = element.scrollHeight - element.clientHeight;
          const percent = scrollable <= 0
            ? 100
            : Math.round((element.scrollTop / scrollable) * 100);
          [25, 50, 75, 100].forEach((threshold) => {
            if (
              percent >= threshold
              && !readingThresholdsRef.current.has(threshold)
            ) {
              readingThresholdsRef.current.add(threshold);
              logEvent("reading_progress", {
                maximum_scroll_percent: threshold,
              });
            }
          });
        }}
      >
        <p
          aria-live="polite"
          style={{
            margin: 0,
            width: "100%",
            textAlign: "justify",
            textJustify: "inter-word",
            lineHeight: 1.65,
            overflowWrap: "break-word",
            wordBreak: "break-word",
            fontSize: `clamp(15px, ${fontSize * 0.075}vw, 32px)`,
          }}
        >
          {verbalization || "No saved verbalization is available for this pair."}
        </p>
      </div>
    </section>
  );
}
