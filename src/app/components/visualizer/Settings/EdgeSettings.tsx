"use client";
import React, { useState } from "react";
import { useTheme } from "../../../../../styles/ThemeContext";
import { Triangle, Circle, Square, Minus } from "lucide-react";
import ColorPicker from "../legend/ColorPicker";
import { featureFlags } from "@/app/config/featureFlags";

interface EdgeSettingsProps {
  thickness: number;
  setThickness: (val: number) => void;
  arrowShape: string;
  setArrowShape: (val: string) => void;
  neLineStyle: string;
  setNeLineStyle: (val: string) => void;
  lcaLineStyle: string;
  setLcaLineStyle: (val: string) => void;
  neEdgeColor: string;
  setNeEdgeColor: (val: string) => void;
  lcaEdgeColor: string;
  setLcaEdgeColor: (val: string) => void;
}

export default function EdgeSettings({
  thickness,
  setThickness,
  arrowShape,
  setArrowShape,
  neLineStyle,
  setNeLineStyle,
  lcaLineStyle,
  setLcaLineStyle,
  neEdgeColor,
  setNeEdgeColor,
  lcaEdgeColor,
  setLcaEdgeColor,
}: EdgeSettingsProps) {
  const colors = useTheme();
  const [arrowOpen, setArrowOpen] = useState(false);
  const [neOpen, setNeOpen] = useState(false);
  const [lcaOpen, setLcaOpen] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState<{
    target: "ne" | "lca";
    position: { x: number; y: number };
  } | null>(null);

  const arrowOptions = [
    { type: "triangle", icon: <Triangle size={20} /> },
    { type: "circle", icon: <Circle size={20} /> },
    { type: "square", icon: <Square size={20} /> },
  ];

  const lineOptions = [
    { type: "solid", icon: <Minus size={20} /> },
    { type: "dashed", icon: <Minus size={20} style={{ strokeDasharray: "4 2" }} /> },
    { type: "dotted", icon: <Minus size={20} style={{ strokeDasharray: "1 3" }} /> },
  ];

  const renderDropdown = (
    label: string,
    value: string,
    setValue: (val: string) => void,
    options: typeof arrowOptions,
    open: boolean,
    setOpen: (val: boolean) => void
  ) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span>{label}:</span>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setOpen(!open)}
            style={{
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #ccc",
              borderRadius: 4,
              backgroundColor: "white",
              cursor: "pointer",
            }}
          >
            {options.find((o) => o.type === value)?.icon &&
              React.cloneElement(options.find((o) => o.type === value)!.icon, { color: "black" })}
          </button>
          {open && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                width: 40,
                backgroundColor: "white",
                borderRadius: 4,
                border: "1px solid #ccc",
                marginTop: 4,
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {options.map((o) => (
                <div
                  key={o.type}
                  onClick={() => {
                    setValue(o.type);
                    setOpen(false);
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    backgroundColor: value === o.type ? "#e0f0ff" : "white",
                  }}
                >
                  {React.cloneElement(o.icon, { color: "black" })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const handleOpenColorPicker = (
    target: "ne" | "lca",
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const _rect = e.currentTarget.getBoundingClientRect();
    const pickerW = 220;
    const pickerH = 320;
    const x = Math.max(8, Math.round(window.innerWidth / 2 - pickerW / 2));
    const y = Math.max(8, Math.round(window.innerHeight / 2 - pickerH / 2));

    setActiveColorPicker({
      target,
      position: { x, y },
    });
  };

  return (
    <div
      style={{
        border: `1px solid ${colors.white}30`,
        borderRadius: 10,
        padding: "1rem",
        backgroundColor: colors.darkblue,
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {featureFlags.colorChange && <style>{`
        .edge-color-swatch {
          position: relative;
        }
        .edge-color-swatch:hover {
          transform: scale(1.2);
          border-color: #000 !important;
          box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.15);
        }
        .edge-color-swatch::after {
          content: "Change color";
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: #333;
          color: #fff;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.08s ease;
          z-index: 10;
        }
        .edge-color-swatch:hover::after {
          opacity: 1;
        }
      `}</style>}
      <h4 style={{ margin: 0 }}>Edges</h4>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        {/* Thickness */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>Thickness:</span>
          <input
            type="number"
            min={1}
            max={20}
            value={thickness}
            onChange={(e) => setThickness(Number(e.target.value))}
            style={{
              width: 60,
              padding: "4px 6px",
              borderRadius: 4,
              border: "1px solid #ccc",
            }}
          />
        </div>

        {/* Arrow */}
        {renderDropdown("Arrow", arrowShape, setArrowShape, arrowOptions, arrowOpen, setArrowOpen)}

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {renderDropdown("NE", neLineStyle, setNeLineStyle, lineOptions, neOpen, setNeOpen)}
            {featureFlags.colorChange && (
              <>
                <span>Color:</span>
                <div
                  className="edge-color-swatch"
                  onClick={(e) => handleOpenColorPicker("ne", e)}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 3,
                    backgroundColor: neEdgeColor,
                    cursor: "pointer",
                    border: "1px solid #555",
                    boxSizing: "border-box",
                    transition:
                      "transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease",
                  }}
                />
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {renderDropdown("LCA", lcaLineStyle, setLcaLineStyle, lineOptions, lcaOpen, setLcaOpen)}
            {featureFlags.colorChange && (
              <>
                <span>Color:</span>
                <div
                  className="edge-color-swatch"
                  onClick={(e) => handleOpenColorPicker("lca", e)}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 3,
                    backgroundColor: lcaEdgeColor,
                    cursor: "pointer",
                    border: "1px solid #555",
                    boxSizing: "border-box",
                    transition:
                      "transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease",
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {featureFlags.colorChange && activeColorPicker && (
        <ColorPicker
          color={(activeColorPicker.target === "ne" ? neEdgeColor : lcaEdgeColor).toLowerCase()}
          position={activeColorPicker.position}
          onChange={(color) => {
            const next = color.toLowerCase();
            if (activeColorPicker.target === "ne") {
              if (neEdgeColor.toLowerCase() !== next) setNeEdgeColor(next);
            } else {
              if (lcaEdgeColor.toLowerCase() !== next) setLcaEdgeColor(next);
            }
          }}
          onClose={() => setActiveColorPicker(null)}
        />
      )}
    </div>
  );
}
