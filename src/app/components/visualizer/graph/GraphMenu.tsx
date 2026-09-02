"use client";

import React, { useState, forwardRef, useImperativeHandle, JSX, useEffect, useRef } from "react";
import { Core } from "cytoscape";
import { useTheme } from "../../../../../styles/ThemeContext";
import type { ThemeName } from "../../../../../styles/themes";
import { ZoomIn, ZoomOut, RefreshCcw, Settings, Grid, Target, Download, RotateCcw, Menu, X } from "lucide-react";
import EditGraphMenu from "../Settings/GraphSettings";
import { Pair } from "@/app/hooks/types";
import { featureFlags } from "@/app/config/featureFlags";
import { useStudyEventLogger } from "@/app/hooks/useStudyTelemetry";

export interface GraphMenuProps {
  cy: Core | null;
  onReload: () => void;
  hideReload?: boolean;
  pair: Pair;
  onExport: () => void;
  paletteOverride: ThemeName | null;
  setPaletteOverride: (next: ThemeName | null) => void;
  resetColors: () => void;
  visiblePathIds: string[];
  visibleLcaIds: string[];
}

const NOOP = () => {};

const GraphMenu = forwardRef<() => void, GraphMenuProps>(({
  cy,
  onReload,
  hideReload = false,
  pair,
  onExport,
  resetColors = NOOP,
  visiblePathIds,
  visibleLcaIds,
}, ref) => {
  const colors = useTheme();
  const logEvent = useStudyEventLogger();

  const [editOpen, setEditOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const controlsMeasureRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateCompact = () => {
      const headerWidth = headerRef.current?.clientWidth ?? 0;
      const titleWidth = titleRef.current?.clientWidth ?? 0;
      const controlsWidth = controlsMeasureRef.current?.scrollWidth ?? 0;
      // Horizontal padding + a small safety gap between title and controls.
      const chromeAllowance = 48;
      const needsCompact =
        headerWidth > 0 &&
        titleWidth > 0 &&
        controlsWidth > 0 &&
        titleWidth + controlsWidth + chromeAllowance > headerWidth;
      setIsCompact(needsCompact);
    };

    updateCompact();
    window.addEventListener("resize", updateCompact);

    let ro: ResizeObserver | null = null;
    if (headerRef.current && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => updateCompact());
      ro.observe(headerRef.current);
      if (titleRef.current) ro.observe(titleRef.current);
      if (controlsMeasureRef.current) ro.observe(controlsMeasureRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateCompact);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isCompact) setMenuOpen(false);
  }, [isCompact]);

  // --------------------- CENTER FUNCTION ---------------------
  const handleCenter = () => {
    if (cy) {
      const previousZoom = cy.zoom();
      const currentPan = cy.pan();
      const previousPan = { x: currentPan.x, y: currentPan.y };
      cy.fit();
      cy.center();
      const centeredPan = cy.pan();
      logEvent("graph_centered", {
        previous_zoom: previousZoom,
        new_zoom: cy.zoom(),
        previous_pan: previousPan,
        new_pan: { x: centeredPan.x, y: centeredPan.y },
        trigger: "center_button",
      });
    }
  };

  useImperativeHandle(ref, () => handleCenter);

  const handleReload = () => {
    const reloadPan = cy?.pan();
    logEvent("graph_reloaded", {
      visible_path_ids: visiblePathIds,
      visible_lca_ids: visibleLcaIds,
      zoom_before: cy?.zoom() ?? null,
      pan_before: reloadPan ? { x: reloadPan.x, y: reloadPan.y } : null,
      node_count_before: cy?.nodes().length ?? 0,
      edge_count_before: cy?.edges().length ?? 0,
    });
    onReload();
  };

  const handleExportClick = () => {
    if (!featureFlags.exportContent) return;
    if (!pair) return alert("No pair selected for export!");
    logEvent("graph_exported", { status: "requested" });
    onExport();
  };

  const handleZoomIn = () => {
    if (cy) {
      const previousZoom = cy.zoom();
      cy.zoom({
        level: previousZoom * 1.2,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
      });
      logEvent("graph_viewport_changed", {
        interaction: "zoom_button",
        direction: "in",
        previous_zoom: previousZoom,
        new_zoom: cy.zoom(),
      });
    }
  };

  const handleZoomOut = () => {
    if (cy) {
      const previousZoom = cy.zoom();
      cy.zoom({
        level: previousZoom * 0.8,
        renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
      });
      logEvent("graph_viewport_changed", {
        interaction: "zoom_button",
        direction: "out",
        previous_zoom: previousZoom,
        new_zoom: cy.zoom(),
      });
    }
  };

  const handleGridToggle = () => {
    if (!cy) return;

    const newShowGrid = !showGrid;
    setShowGrid(newShowGrid);
    logEvent("grid_toggled", { enabled: newShowGrid });

    const gridSize = 20;

    if (newShowGrid) {
      cy.container()!.style.backgroundImage =
        `linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
         linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`;

      cy.container()!.style.backgroundSize = `${gridSize}px ${gridSize}px`;
      cy.container()!.style.backgroundColor = "#fff";
    } else {
      cy.container()!.style.backgroundImage = "none";
      cy.container()!.style.backgroundColor = "transparent";
    }
  };

  const handleEditToggle = () => setEditOpen(!editOpen);

  const buttonStyle = {
    padding: "clamp(4px, 0.35vw, 7px) clamp(8px, 0.65vw, 14px)",
    backgroundColor: colors.darkblue,
    color: colors.white,
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "clamp(4px, 0.3vw, 7px)",
    fontWeight: 600,
    fontSize: "clamp(13px, 0.75vw, 18px)",
    position: "relative" as const
  };

  const iconButtonStyle = {
    ...buttonStyle,
    padding: "clamp(6px, 0.45vw, 9px) clamp(8px, 0.55vw, 12px)",
  };

  const Tooltip = ({ text }: { text: string }) => (
    <span
      style={{
        position: "absolute",
        top: "110%",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "#333",
        color: "#fff",
        padding: "2px 6px",
        borderRadius: 4,
        fontSize: "clamp(10px, 0.6vw, 14px)",
        whiteSpace: "nowrap",
        zIndex: 200,
        pointerEvents: "none",
        opacity: 0,
        transition: "opacity 0.2s"
      }}
      className="tooltip"
    >
      {text}
    </span>
  );

  const renderButton = (
    onClick: () => void,
    icon: JSX.Element,
    tooltip: string,
    label?: JSX.Element | string
  ) => (
    <div
      style={{ position: "relative" }}
      onMouseEnter={e => {
        const tip = e.currentTarget.querySelector(".tooltip") as HTMLElement;
        if (tip) tip.style.opacity = "1";
      }}
      onMouseLeave={e => {
        const tip = e.currentTarget.querySelector(".tooltip") as HTMLElement;
        if (tip) tip.style.opacity = "0";
      }}
    >
      <button
        onClick={onClick}
        style={{
          ...buttonStyle,
          ...(isCompact
            ? {
                width: "100%",
                justifyContent: "flex-start",
              }
            : null),
        }}
      >
        {icon}
        {label && <span style={{ marginLeft: 4 }}>{label}</span>}
      </button>
      <Tooltip text={tooltip} />
    </div>
  );

  return (
    <>
      <div
        ref={headerRef}
        style={{
          padding: "clamp(0.5rem, 0.7vw, 0.9rem) clamp(0.75rem, 1vw, 1.4rem)",
          position: "relative",
          zIndex: 30,
          overflow: "visible",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#fafafa",
          borderBottom: "1px solid #ccc"
        }}
      >
        <h4
          ref={titleRef}
          style={{
            margin: 0,
            fontSize: "clamp(16px, 1vw, 24px)",
            fontWeight: "bold",
            color: "#1F2433",
          }}
        >
          Visualization
        </h4>

        {isCompact ? (
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={iconButtonStyle}
            aria-label={menuOpen ? "Close graph menu" : "Open graph menu"}
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        ) : null}

        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            ...(isCompact
              ? {
                  position: "absolute" as const,
                  top: "100%",
                  right: "0.75rem",
                  marginTop: "0.35rem",
                  padding: "0.55rem",
                  borderRadius: 8,
                  border: "1px solid #d1d5db",
                  backgroundColor: "#fafafa",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
                  flexDirection: "column" as const,
                  alignItems: "stretch",
                  minWidth: 220,
                  zIndex: 50,
                  display: menuOpen ? "flex" : "none",
                }
              : null),
          }}
        >
          {featureFlags.colorChange &&
            renderButton(
              resetColors,
              <RotateCcw size={16} />,
              "Reset node colors",
              isCompact ? "Reset node colors" : undefined
            )}
          {featureFlags.exportContent &&
            renderButton(
              handleExportClick,
              <Download size={16} />,
              "Export graph",
              isCompact ? "Export graph" : undefined
            )}
          {renderButton(
            handleCenter,
            <Target size={16} />,
            "Center graph",
            isCompact ? "Center graph" : undefined
          )}
          {!hideReload &&
            renderButton(
              handleReload,
              <RefreshCcw size={16} />,
              "Reload graph",
              isCompact ? "Reload graph" : undefined
            )}
          {renderButton(
            handleZoomIn,
            <ZoomIn size={16} />,
            "Zoom in",
            isCompact ? "Zoom in" : undefined
          )}
          {renderButton(
            handleZoomOut,
            <ZoomOut size={16} />,
            "Zoom out",
            isCompact ? "Zoom out" : undefined
          )}
          {renderButton(
            handleGridToggle,
            <Grid size={16} />,
            "Toggle grid",
            isCompact ? "Toggle grid" : undefined
          )}
          {featureFlags.graphSetting &&
            renderButton(
              handleEditToggle,
              <Settings size={16} />,
              "Settings",
              isCompact ? "Settings" : undefined
            )}
        </div>

        {/* Hidden desktop-controls measurer used to decide if compact mode is needed */}
        <div
          ref={controlsMeasureRef}
          style={{
            position: "absolute",
            visibility: "hidden",
            pointerEvents: "none",
            height: 0,
            overflow: "hidden",
            whiteSpace: "nowrap",
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
          aria-hidden="true"
        >
          {featureFlags.colorChange && (
            <button style={buttonStyle}><RotateCcw size={16} /></button>
          )}
          {featureFlags.exportContent && (
            <button style={buttonStyle}><Download size={16} /></button>
          )}
          <button style={buttonStyle}><Target size={16} /></button>
          {!hideReload && (
            <button style={buttonStyle}><RefreshCcw size={16} /></button>
          )}
          <button style={buttonStyle}><ZoomIn size={16} /></button>
          <button style={buttonStyle}><ZoomOut size={16} /></button>
          <button style={buttonStyle}><Grid size={16} /></button>
          {featureFlags.graphSetting && (
            <button style={buttonStyle}><Settings size={16} /></button>
          )}
        </div>
      </div>

      {featureFlags.graphSetting && (
        <EditGraphMenu open={editOpen} onClose={() => setEditOpen(false)} cy={cy} />
      )}
    </>
  );
});

GraphMenu.displayName = "GraphMenu";
export default GraphMenu;
