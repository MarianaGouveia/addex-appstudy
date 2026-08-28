"use client";
import React, { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import GraphVisualizer from "../../components/visualizer/graph/GraphVisualizer";
import { ExplanationSearchState, Pair } from "../../hooks/types";
import { useTheme, useThemeContext } from "../../../../styles/ThemeContext";
import SumSideMenu from "../../components/sumSideMenu/SumSideMenu";
import Loading from "../../loading";
import {
  publicAssetPath,
  toPublicDataSegment,
} from "../../utils/publicAssetPath";
import { resolveStudyIdentity } from "../../utils/studyIdentity";
import {
  StudyTelemetryProvider,
  useStudyTelemetry,
} from "../../hooks/useStudyTelemetry";

function SearchPageContent() {
  const colors = useTheme();
  const { theme } = useThemeContext();
  const searchParams = useSearchParams();
  // Stringify once so navigation to another study link updates identity and data.
  const searchParamsStr = searchParams.toString();
  const studyIdentity = useMemo(
    () => resolveStudyIdentity(new URLSearchParams(searchParamsStr)),
    [searchParamsStr]
  );
  const selectedModality = searchParams.get("modality")?.toLowerCase() ?? "hybrid";
  const isTextModality = selectedModality === "text";
  const isSummarizeModality = selectedModality === "sumarize";
  const hasCompletePairParams = ["persona", "dataset", "task", "source", "target"].every(
    (param) => !!searchParams.get(param)
  );

  // Error text uses the current persona's accent. When no persona is picked
  // yet, fall back to a saturated green per theme so the line still reads as a
  // notification.
  const personaId = searchParams.get("persona");
  const errorColor = !personaId
    ? colors.firstColor
    : theme === "legacy"
      ? personaId === "mechanistic_analyst"
        ? colors.green
        : colors.firstColor
      : personaId === "mechanistic_analyst"
        ? colors.headingAccents[3]
        : personaId === "insight_driven"
          ? colors.headingAccents[0]
          : colors.headingAccents[6];
  const [selectedPair, setSelectedPair] = useState<Pair | null>(null);
  const [showSummaryMenu, setShowSummaryMenu] = useState(false);
  const [searchState, setSearchState] = useState<ExplanationSearchState>({
    status: "idle",
  });

  const [visiblePaths, setVisiblePaths] = useState<Set<string>>(new Set());
  const [visibleLCAs, setVisibleLCAs] = useState<Set<string>>(new Set());
  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null);
  const [hoveredLcaName, setHoveredLcaName] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [graphCollapsed, setGraphCollapsed] = useState(false);
  const panelLayout = graphCollapsed
    ? "explanation_only"
    : rightCollapsed
      ? "graph_with_collapsed_explanation"
      : "both";
  const telemetryFinalState = useMemo(
    () => ({
      final_panel_layout: panelLayout,
      final_visible_path_ids: Array.from(visiblePaths),
      final_visible_lca_ids: Array.from(visibleLCAs),
    }),
    [panelLayout, visibleLCAs, visiblePaths]
  );
  const { logEvent } = useStudyTelemetry(studyIdentity, telemetryFinalState);
  const isDirectPairLoading =
    hasCompletePairParams &&
    (searchState.status === "idle" || searchState.status === "checking");

  useEffect(() => {
    const persona = searchParams.get("persona");
    const dataset = searchParams.get("dataset");
    const task = searchParams.get("task");
    const source = searchParams.get("source");
    const target = searchParams.get("target");

    if (!persona || !dataset || !task || !source || !target) return;

    let cancelled = false;
    const loadStartedAt = Date.now();
    setSelectedPair(null);
    setSearchState({
      status: "checking",
      message: "Loading the saved explanation from public data...",
    });

    const pairFileName = `${toPublicDataSegment(source)}__${toPublicDataSegment(
      target
    )}.json`;
    const pairUrl = publicAssetPath(
      `data/${toPublicDataSegment(task)}/${pairFileName}`
    );

    fetch(pairUrl)
      .then(async (response) => {
        if (response.status === 404) {
          return null;
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<Pair>;
      })
      .then((savedPair) => {
        if (cancelled) return;
        if (!savedPair) {
          setSearchState({
            status: "missing",
            message: "No saved public-data explanation was found for this pair.",
          });
          logEvent("explanation_load_completed", {
            status: "missing",
            duration_ms: Date.now() - loadStartedAt,
          });
          return;
        }

        const loadedPair = {
          ...savedPair,
          source,
          target,
          paths: (savedPair.paths ?? []).map((path, index) => ({
            ...path,
            id: path.id ?? `path_${index + 1}`,
          })),
        };
        setSelectedPair(loadedPair);
        setSearchState({ status: "idle" });
        setRightCollapsed(false);
        setGraphCollapsed(isSummarizeModality);
        setShowSummaryMenu(true);
        const uniqueNodeIds = new Set(
          loadedPair.paths.flatMap((path) => path.nodes.map((node) => node.id))
        );
        const uniqueLcaIds = new Set(
          loadedPair.paths.flatMap((path) =>
            Object.values(path.lowest_common_ancestors ?? {}).flat()
          )
        );
        logEvent("explanation_load_completed", {
          status: "success",
          duration_ms: Date.now() - loadStartedAt,
          path_count: loadedPair.paths.length,
          initially_visible_path_count: isTextModality
            ? 0
            : Math.min(3, loadedPair.paths.length),
          initially_visible_lca_count: uniqueLcaIds.size,
          initial_panel_layout: isSummarizeModality
            ? "explanation_only"
            : "both",
          initial_content_tab:
            selectedModality === "graph" ? "paths" : "verbalization",
          node_count: uniqueNodeIds.size,
          edge_count: loadedPair.paths.reduce(
            (total, path) => total + path.edges.length,
            0
          ),
          lca_count: uniqueLcaIds.size,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load URL pair:", error);
        setSearchState({
          status: "failed",
          message: "Failed to load the saved public-data explanation.",
        });
        logEvent("explanation_load_completed", {
          status: "failed",
          duration_ms: Date.now() - loadStartedAt,
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsStr]);

  useEffect(() => {
    if (selectedPair) {
      setHoveredPathId(null);
      setHoveredLcaName(null);
      // Text modality is a graph-reconstruction task, so it starts empty.
      // Other modalities keep the first three saved paths visible.
      setVisiblePaths(
        isTextModality
          ? new Set()
          : new Set(selectedPair.paths.slice(0, 3).map((p) => p.id))
      );

      // Extract and initialize all LCAs as visible
      const lcaSet = new Set<string>();

      selectedPair.paths.forEach((path) => {
        if (!path.lowest_common_ancestors) return;

        Object.values(path.lowest_common_ancestors).forEach((lcaList) => {
          const arr = Array.isArray(lcaList) ? lcaList : [lcaList];
          arr.forEach((lca) => {
            if (lca) lcaSet.add(lca);
          });
        });
      });

      setVisibleLCAs(lcaSet);
    }
  }, [selectedPair, isTextModality]);

  // Layout invariant: never allow both graph and verbalization to be hidden.
  // If summary is closed while graph is collapsed, reopen the graph.
  useEffect(() => {
    if (!showSummaryMenu && graphCollapsed) {
      setGraphCollapsed(false);
    }
  }, [showSummaryMenu, graphCollapsed]);

  const handleSlideRight = useCallback(() => {
    // Right arrow -> verbalization-only.
    if (panelLayout !== "explanation_only") {
      logEvent("panel_layout_changed", {
        previous_layout: panelLayout,
        new_layout: "explanation_only",
        trigger: "panel_arrow",
      });
    }
    if (!showSummaryMenu) setShowSummaryMenu(true);
    setRightCollapsed(false);
    setGraphCollapsed(true);
  }, [logEvent, panelLayout, showSummaryMenu]);

  const handleSlideLeft = useCallback(() => {
    if (isSummarizeModality) {
      if (panelLayout !== "explanation_only") {
        logEvent("panel_layout_changed", {
          previous_layout: panelLayout,
          new_layout: "explanation_only",
          trigger: "panel_arrow",
        });
      }
      setShowSummaryMenu(true);
      setRightCollapsed(false);
      setGraphCollapsed(true);
      return;
    }

    // Left arrow sequence:
    // 1) If graph is hidden, bring it back (both visible).
    // 2) If graph is visible, toggle verbalization panel collapsed/expanded.
    // Verbalization is never fully hidden by this control.
    if (graphCollapsed) {
      logEvent("panel_layout_changed", {
        previous_layout: panelLayout,
        new_layout: "both",
        trigger: "panel_arrow",
      });
      setGraphCollapsed(false);
      if (!showSummaryMenu) setShowSummaryMenu(true);
      setRightCollapsed(false);
      return;
    }

    if (!showSummaryMenu) {
      logEvent("panel_layout_changed", {
        previous_layout: panelLayout,
        new_layout: "both",
        trigger: "panel_arrow",
      });
      setShowSummaryMenu(true);
      setRightCollapsed(false);
      return;
    }

    const newLayout = rightCollapsed ? "both" : "graph_with_collapsed_explanation";
    logEvent("panel_layout_changed", {
      previous_layout: panelLayout,
      new_layout: newLayout,
      trigger: "panel_arrow",
    });
    setRightCollapsed((prev) => !prev);
  }, [
    graphCollapsed,
    isSummarizeModality,
    logEvent,
    panelLayout,
    rightCollapsed,
    showSummaryMenu,
  ]);

  const togglePath = useCallback(
    (pathId: string) => {
      const path = selectedPair?.paths.find((candidate) => candidate.id === pathId);
      const willBeVisible = !visiblePaths.has(pathId);
      const autoShownLcas = new Set<string>();
      if (willBeVisible && path?.lowest_common_ancestors) {
        Object.values(path.lowest_common_ancestors).forEach((lcaList) => {
          const entries = Array.isArray(lcaList) ? lcaList : [lcaList];
          entries.forEach((lca) => {
            if (lca && !visibleLCAs.has(lca)) autoShownLcas.add(lca);
          });
        });
      }

      autoShownLcas.forEach((lcaId) => {
        logEvent("lca_visibility_changed", {
          lca_id: lcaId,
          visibility: "shown",
          cause: "path_added_automatically",
          triggering_path_id: pathId,
        });
      });

      logEvent("path_visibility_changed", {
        path_id: pathId,
        path_rank: path ? selectedPair!.paths.indexOf(path) + 1 : null,
        visibility: willBeVisible ? "shown" : "hidden",
        visible_path_count_after: visiblePaths.size + (willBeVisible ? 1 : -1),
        auto_shown_lca_ids: Array.from(autoShownLcas),
        agentic_score: path?.score?.agentic_score ?? null,
        final_score: path?.score?.final_score ?? null,
      });

      setVisiblePaths((prev) => {
        const copy = new Set(prev);
        if (willBeVisible) copy.add(pathId);
        else copy.delete(pathId);

        // When a path is newly added to the viz, auto-include its LCAs so
        // the graph shows the full context. Removing a path leaves LCAs
        // alone so other paths that share them aren't affected.
        if (willBeVisible && selectedPair) {
          const addedPath = selectedPair.paths.find((p) => p.id === pathId);
          if (addedPath?.lowest_common_ancestors) {
            const lcaNames = new Set<string>();
            Object.values(addedPath.lowest_common_ancestors).forEach(
              (lcaList) => {
                const arr = Array.isArray(lcaList) ? lcaList : [lcaList];
                arr.forEach((lca) => {
                  if (lca) lcaNames.add(lca);
                });
              }
            );
            if (lcaNames.size > 0) {
              setVisibleLCAs((prevLcas) => {
                const lcaCopy = new Set(prevLcas);
                lcaNames.forEach((name) => lcaCopy.add(name));
                return lcaCopy;
              });
            }
          }
        }

        return copy;
      });
    },
    [logEvent, selectedPair, visibleLCAs, visiblePaths]
  );

  const toggleLCA = useCallback(
    (lcaName: string) => {
      const willBeVisible = !visibleLCAs.has(lcaName);
      logEvent("lca_visibility_changed", {
        lca_id: lcaName,
        visibility: willBeVisible ? "shown" : "hidden",
        visible_lca_count_after: visibleLCAs.size + (willBeVisible ? 1 : -1),
        cause: "participant",
      });
      setVisibleLCAs((prev) => {
        const copy = new Set(prev);
        if (willBeVisible) copy.add(lcaName);
        else copy.delete(lcaName);
        return copy;
      });
    },
    [logEvent, visibleLCAs]
  );

  const handlePathHover = useCallback((pathId: string | null) => {
    setHoveredPathId(pathId);
    if (pathId) {
      setHoveredLcaName(null);
      setHoveredNodeId(null);
    }
  }, []);

  const handleLcaHover = useCallback((lcaName: string | null) => {
    setHoveredLcaName(lcaName);
    if (lcaName) {
      setHoveredPathId(null);
      setHoveredNodeId(null);
    }
  }, []);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
    if (nodeId) {
      setHoveredPathId(null);
      setHoveredLcaName(null);
    }
  }, []);

  const RIGHTMENU_WIDTH = "28vw";
  const RIGHTMENU_COLLAPSED_WIDTH = "clamp(52px, 4vw, 76px)";

  return (
    <StudyTelemetryProvider logEvent={logEvent}>
    <div
      className="search-explanation-page"
      style={{
        backgroundColor: colors.background,
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style jsx global>{`
        .search-explanation-page button {
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          border: 1px solid #9ca3af !important;
        }

        .search-explanation-page button:hover:not(:disabled) {
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #000000 !important;
          border-color: #6b7280 !important;
        }
      `}</style>

      <div style={{ display: "flex", flex: 1 }}>
        {/* RIGHT MENU */}
        {showSummaryMenu && (
          <SumSideMenu
            collapsed={rightCollapsed}
            onSlideLeft={handleSlideRight}
            onSlideRight={handleSlideLeft}
            expanded={graphCollapsed}
            leftOffset={0}
            pair={selectedPair}
            visiblePaths={visiblePaths}
            togglePath={togglePath}
            visibleLCAs={visibleLCAs}
            toggleLCA={toggleLCA}
            onPathHover={handlePathHover}
            onLcaHover={handleLcaHover}
            hoveredNodeId={hoveredNodeId}
          />
        )}

        {/* MAIN CONTENT: sumarize renders only the full-screen verbalization menu. */}
        {(!isSummarizeModality || !selectedPair) && (
        <main
          style={{
            flex: 1,
            marginLeft: 0,
            marginRight: showSummaryMenu
              ? graphCollapsed
                ? 0
                : rightCollapsed
                ? RIGHTMENU_COLLAPSED_WIDTH
                : RIGHTMENU_WIDTH
              : 0,
            padding: "clamp(0.75rem, 1.2vw, 1.75rem)",
            border: `1px solid ${colors.grayDark}40`,
            borderRadius: 12,
            backgroundColor: colors.background,
            overflow: "hidden",
            boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
            height: "100dvh",
            minHeight: 0,
            boxSizing: "border-box",
            transition: "margin 0.2s ease",
          }}
        >

          {!selectedPair && (
            <div
              style={{
                minHeight: "60vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "2rem",
              }}
            >
              <div>
                    {isDirectPairLoading ? (
                      <div
                        role="status"
                        aria-live="polite"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "1rem",
                          color: `${colors.white}cc`,
                        }}
                      >
                        <svg
                          width="48"
                          height="48"
                          viewBox="0 0 48 48"
                          aria-hidden="true"
                        >
                          <circle
                            cx="24"
                            cy="24"
                            r="18"
                            fill="none"
                            stroke={`${colors.white}35`}
                            strokeWidth="4"
                          />
                          <path
                            d="M24 6a18 18 0 0 1 18 18"
                            fill="none"
                            stroke={colors.firstColor}
                            strokeWidth="4"
                            strokeLinecap="round"
                          >
                            <animateTransform
                              attributeName="transform"
                              type="rotate"
                              from="0 24 24"
                              to="360 24 24"
                              dur="0.8s"
                              repeatCount="indefinite"
                            />
                          </path>
                        </svg>
                        <p style={{ margin: 0 }}>
                          {searchState.message ?? "Loading pair explanation..."}
                        </p>
                      </div>
                    ) : searchState.status === "failed" ||
                      searchState.status === "missing" ? (() => {
                      const raw =
                        searchState.message ??
                        "No saved public-data explanation was found for this pair.";
                      // Split into the main error line (shown bold + accent)
                      // and any follow-up hint lines (shown plain, matching
                      // the empty-state prompt style).
                      const [primary, ...rest] = raw.split("\n");
                      const hint = rest.join(" ").trim();
                      return (
                        <div>
                          <p
                            style={{
                              color: errorColor,
                              margin: 0,
                              fontWeight: 700,
                              lineHeight: 1.6,
                            }}
                          >
                            {primary}
                          </p>
                          {hint && (
                            <p style={{ marginTop: "0.35rem", marginBottom: 0 }}>
                              {hint}
                            </p>
                          )}
                        </div>
                      );
                    })() : (
                      <p style={{ margin: 0, color: `${colors.white}cc` }}>
                        Open a complete pair link to load its explanation.
                      </p>
                    )}
              </div>
            </div>
          )}

          {selectedPair && (
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "stretch",
                height: "100%",
                minHeight: 0,
              }}
            >
              <div
                style={{
                  width: graphCollapsed ? 18 : "100%",
                  minWidth: graphCollapsed ? 18 : 0,
                  overflow: "hidden",
                  border: graphCollapsed ? "1px solid #d6d6d6" : "none",
                  borderRadius: graphCollapsed ? 8 : 0,
                  backgroundColor: graphCollapsed ? "#ffffff" : "transparent",
                  transition: "width 0.25s ease",
                  height: "100%",
                }}
              >
                <div
                  style={{
                    visibility: graphCollapsed ? "hidden" : "visible",
                    pointerEvents: graphCollapsed ? "none" : "auto",
                    transform: graphCollapsed ? "translateX(-12px)" : "translateX(0)",
                    opacity: graphCollapsed ? 0 : 1,
                    transition: "transform 0.25s ease, opacity 0.25s ease",
                    height: "100%",
                  }}
                >
                  <GraphVisualizer
                    pair={selectedPair}
                    manualBuildMode={isTextModality}
                    visiblePaths={visiblePaths}
                    visibleLCAs={visibleLCAs}
                    isVisible={!graphCollapsed}
                    leftCollapsed={false}
                    rightCollapsed={rightCollapsed}
                    hoveredPathId={hoveredPathId}
                    hoveredLcaName={hoveredLcaName}
                    hoveredNodeId={hoveredNodeId}
                    onNodeHover={handleNodeHover}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
        )}
      </div>
    </div>
    </StudyTelemetryProvider>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SearchPageContent />
    </Suspense>
  );
}
