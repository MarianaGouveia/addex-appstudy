"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Check, Download } from "lucide-react";
import { Pair } from "@/app/hooks/types";
import PathList from "../pathList/PathList";
import { featureFlags } from "@/app/config/featureFlags";

interface SumSideMenuProps {
  collapsed: boolean;
  onSlideLeft?: () => void;
  onSlideRight?: () => void;
  expanded?: boolean;
  leftOffset?: number;
  pair: Pair | null;
  visiblePaths: Set<string>;
  togglePath: (pathId: string) => void;
  visibleLCAs: Set<string>;
  toggleLCA: (lcaName: string) => void;
  onPathHover: (pathId: string | null) => void;
  onLcaHover: (lcaName: string | null) => void;
  hoveredNodeId?: string | null;
}

export default function SumSideMenu({
  collapsed,
  onSlideLeft,
  onSlideRight,
  expanded = false,
  leftOffset = 0,
  pair,
  visiblePaths,
  togglePath,
  visibleLCAs,
  toggleLCA,
  onPathHover,
  onLcaHover,
  hoveredNodeId = null,
}: SumSideMenuProps) {
  const textScale = collapsed ? 0.75 : expanded ? 1.35 : 1;
  const [activeTab, setActiveTab] = useState<"verbalization" | "paths">("verbalization");
  const [otherPathsOpen, setOtherPathsOpen] = useState(false);
  const [globalExplanation, setGlobalExplanation] = useState("");
  const [verbalizationFontSize, setVerbalizationFontSize] = useState(16);
  const [copied, setCopied] = useState(false);
  const searchParams = useSearchParams();
  const selectedDataset = useMemo(() => searchParams.get("dataset") ?? "", [searchParams]);
  const selectedModality = useMemo(
    () => searchParams.get("modality")?.toLowerCase() ?? "hybrid",
    [searchParams]
  );
  const isGraphModality = selectedModality === "graph";
  const isTextModality = selectedModality === "text";
  const isSumaizeModality = selectedModality === "sumaize";
  const displayedTab = isSumaizeModality
    ? "verbalization"
    : isGraphModality
    ? "paths"
    : isTextModality
      ? "verbalization"
      : activeTab;

  const MIN_FONT = 12;
  const MAX_FONT = 30;
  const decreaseFont = () => setVerbalizationFontSize((s) => Math.max(MIN_FONT, s - 1));
  const increaseFont = () => setVerbalizationFontSize((s) => Math.min(MAX_FONT, s + 1));

  useEffect(() => {
    setGlobalExplanation(pair?.verbalization?.trim() ?? "");
  }, [pair]);

  const copyVerbalization = async () => {
    try {
      await navigator.clipboard.writeText(globalExplanation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy verbalization:", err);
    }
  };

  const downloadVerbalization = () => {
    if (!globalExplanation) return;
    const blob = new Blob([globalExplanation], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const safeName = pair
      ? `${pair.source}_${pair.target}_summary`.replace(/\s+/g, "_")
      : "summary";
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const styles = {
    aside: {
      width: collapsed
        ? "clamp(52px, 4vw, 76px)"
        : expanded
          ? `calc(100vw - ${leftOffset}px)`
          : "28vw",
      height: "100dvh",
      padding: collapsed
        ? "clamp(0.65rem, 0.8vw, 1rem) clamp(0.35rem, 0.45vw, 0.6rem)"
        : "clamp(1rem, 1.2vw, 1.6rem) clamp(0.75rem, 1vw, 1.35rem)",
      backgroundColor: "#ffffff",
      borderLeft: "1px solid #d1d5db",
      boxShadow: "0 8px 22px rgba(0,0,0,0.08)",
      color: "#000000",
      fontWeight: 500,
      boxSizing: "border-box" as const,
      overflow: "hidden" as const,
      position: "fixed" as const,
      top: 0,
      right: 0,
      zIndex: 40,
      transition: "width 0.2s ease",
      display: "flex",
      flexDirection: "column" as const,
    },
    slideControls: {
      position: "absolute" as const,
      top: "clamp(10px, 0.7vw, 16px)",
      left: "clamp(10px, 0.7vw, 16px)",
      display: "flex",
      alignItems: "center",
      gap: "clamp(8px, 0.6vw, 14px)",
      zIndex: 2,
    },
    slideLeftButton: {
      width: "clamp(30px, 2vw, 40px)",
      height: "clamp(30px, 2vw, 40px)",
      borderRadius: 8,
      border: "1px solid #9ca3af",
      backgroundColor: "#ffffff",
      color: "#000000",
      fontWeight: 600,
      fontSize: "clamp(0.95rem, 0.9vw, 1.25rem)",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
      flexShrink: 0,
    },
    slideRightButton: {
      width: "clamp(30px, 2vw, 40px)",
      height: "clamp(30px, 2vw, 40px)",
      borderRadius: 8,
      border: "1px solid #9ca3af",
      backgroundColor: "#ffffff",
      color: "#000000",
      fontWeight: 600,
      fontSize: "clamp(0.95rem, 0.9vw, 1.25rem)",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
      flexShrink: 0,
    },
    tabsContainer: {
      display: "flex",
      marginTop: isSumaizeModality ? 0 : "clamp(2.5rem, 3vw, 3.5rem)",
      marginBottom: "1rem",
      borderBottom: "1px solid #d1d5db",
    },
    tab: (isActive: boolean) => ({
      flex: 1,
      padding: "0.55rem 0.4rem",
      textAlign: "center" as const,
      cursor: "pointer",
      backgroundColor: "#ffffff",
      color: "#000000",
      borderBottom: isActive ? "2px solid #000000" : "2px solid transparent",
      borderRadius: 8,
      marginRight: "0.25rem",
      transition: "background 0.15s",
      fontSize: "clamp(0.82rem, 0.8vw, 1.1rem)",
      fontWeight: 600,
    }),
    content: {
      padding: "0.8rem",
      borderRadius: 12,
      border: "1px solid #d1d5db",
      backgroundColor: "#ffffff",
      color: "#000000",
      overflowWrap: "break-word" as const,
      wordBreak: "break-word" as const,
    },
    tabPanel: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto" as const,
      paddingRight: "0.1rem",
    },
    helperText: {
      margin: 0,
      color: "#000000",
      fontSize: "clamp(12px, 0.75vw, 17px)",
      lineHeight: 1.5,
    },
  };

  return (
    <aside style={styles.aside}>
      {!isSumaizeModality && (
        <div style={styles.slideControls}>
          {!collapsed && !expanded && (
            <button
              style={styles.slideLeftButton}
              onClick={() => onSlideLeft?.()}
              aria-label="Slide left"
              title="Slide left"
            >
              {"<"}
            </button>
          )}

          <button
            style={styles.slideRightButton}
            onClick={() => onSlideRight?.()}
            aria-label="Slide right"
            title="Slide right"
          >
            {collapsed ? "<" : ">"}
          </button>
        </div>
      )}

      {!collapsed && (
        <>
          <div style={styles.tabsContainer}>
            {!isGraphModality && (
              <div
                style={styles.tab(displayedTab === "verbalization")}
                onClick={() => setActiveTab("verbalization")}
              >
                Verbalization
              </div>
            )}
            {!isTextModality && !isSumaizeModality && (
              <div
                style={styles.tab(displayedTab === "paths")}
                onClick={() => setActiveTab("paths")}
              >
                Path Selection
              </div>
            )}
          </div>

          {displayedTab === "verbalization" && pair && (
            <div
              style={{
                ...styles.tabPanel,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  ...styles.content,
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {globalExplanation ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        justifyContent: "flex-end",
                        alignItems: "center",
                        marginBottom: "0.6rem",
                      }}
                    >
                      <button
                        type="button"
                        onClick={decreaseFont}
                        disabled={verbalizationFontSize <= MIN_FONT}
                        title="Decrease font size"
                        aria-label="Decrease font size"
                        style={{
                          width: "clamp(28px, 2vw, 40px)",
                          height: "clamp(28px, 2vw, 40px)",
                          borderRadius: 6,
                          border: "1px solid #9ca3af",
                          backgroundColor: "#ffffff",
                          color: "#000000",
                          fontWeight: 700,
                          fontSize: "clamp(12px, 0.75vw, 17px)",
                          cursor:
                            verbalizationFontSize <= MIN_FONT ? "not-allowed" : "pointer",
                          opacity: verbalizationFontSize <= MIN_FONT ? 0.45 : 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        A-
                      </button>
                      <button
                        type="button"
                        onClick={increaseFont}
                        disabled={verbalizationFontSize >= MAX_FONT}
                        title="Increase font size"
                        aria-label="Increase font size"
                        style={{
                          width: "clamp(28px, 2vw, 40px)",
                          height: "clamp(28px, 2vw, 40px)",
                          borderRadius: 6,
                          border: "1px solid #9ca3af",
                          backgroundColor: "#ffffff",
                          color: "#000000",
                          fontWeight: 700,
                          fontSize: "clamp(14px, 0.85vw, 19px)",
                          cursor:
                            verbalizationFontSize >= MAX_FONT ? "not-allowed" : "pointer",
                          opacity: verbalizationFontSize >= MAX_FONT ? 0.45 : 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        A+
                      </button>
                      {featureFlags.exportContent && (
                        <>
                          <button
                            type="button"
                            onClick={copyVerbalization}
                            title={copied ? "Copied" : "Copy summary"}
                            aria-label="Copy summary"
                            style={{
                              width: "clamp(28px, 2vw, 40px)",
                              height: "clamp(28px, 2vw, 40px)",
                              borderRadius: 6,
                              border: "1px solid #9ca3af",
                              backgroundColor: "#ffffff",
                              color: "#000000",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={downloadVerbalization}
                            title="Download summary as .txt"
                            aria-label="Download summary as text file"
                            style={{
                              width: "clamp(28px, 2vw, 40px)",
                              height: "clamp(28px, 2vw, 40px)",
                              borderRadius: 6,
                              border: "1px solid #9ca3af",
                              backgroundColor: "#ffffff",
                              color: "#000000",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Download size={14} />
                          </button>
                        </>
                      )}
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                      <p
                        style={{
                          textAlign: "justify",
                          textJustify: "inter-word",
                          lineHeight: 1.55,
                          margin: 0,
                          width: "100%",
                          overflowWrap: "break-word",
                          wordBreak: "break-word",
                          whiteSpace: "pre-wrap",
                          fontSize: `clamp(15px, ${verbalizationFontSize * textScale * 0.065}vw, 32px)`,
                        }}
                      >
                        {globalExplanation}
                      </p>
                    </div>
                  </>
                ) : (
                  <p style={styles.helperText}>
                    No saved verbalization is available for this pair.
                  </p>
                )}
              </div>
            </div>
          )}

          {displayedTab === "paths" && pair && (
            <div style={styles.tabPanel}>
              {(() => {
                const hiddenCount = pair.paths.filter((p) => !visiblePaths.has(p.id)).length;
                if (hiddenCount === 0) return null;
                return (
                  <div
                    style={{
                      margin: "0 0.5rem 0.5rem",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#ffffff",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOtherPathsOpen((v) => !v)}
                      aria-expanded={otherPathsOpen}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        padding: "0.55rem 0.75rem",
                        border: "none",
                        background: "#ffffff",
                        color: "#000000",
                        fontSize: "clamp(0.8rem, 0.75vw, 1.05rem)",
                        fontWeight: 600,
                        cursor: "pointer",
                        borderRadius: 8,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            transform: otherPathsOpen ? "rotate(90deg)" : "rotate(0deg)",
                            transition: "transform 0.15s ease",
                            fontSize: "clamp(0.7rem, 0.65vw, 0.95rem)",
                          }}
                          aria-hidden="true"
                        >
                          {">"}
                        </span>
                        Other paths
                      </span>
                      <span
                        style={{
                          fontSize: "clamp(0.72rem, 0.68vw, 0.98rem)",
                          color: "#000000",
                          fontWeight: 500,
                        }}
                      >
                        {hiddenCount} available
                      </span>
                    </button>

                    {otherPathsOpen && (
                      <div
                        style={{
                          padding: "0 0.5rem 0.6rem",
                          borderTop: "1px solid #d1d5db",
                        }}
                      >
                        <PathList
                          dataset={selectedDataset}
                          pair={pair}
                          visiblePaths={visiblePaths}
                          togglePath={togglePath}
                          visibleLCAs={visibleLCAs}
                          toggleLCA={toggleLCA}
                          onPathHover={onPathHover}
                          onLcaHover={onLcaHover}
                          hoveredNodeId={hoveredNodeId}
                          filter="hidden"
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              <PathList
                dataset={selectedDataset}
                pair={pair}
                visiblePaths={visiblePaths}
                togglePath={togglePath}
                visibleLCAs={visibleLCAs}
                toggleLCA={toggleLCA}
                onPathHover={onPathHover}
                onLcaHover={onLcaHover}
                hoveredNodeId={hoveredNodeId}
                filter="visible"
              />
            </div>
          )}
        </>
      )}
    </aside>
  );
}
