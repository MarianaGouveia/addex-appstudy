"use client";
import React, { JSX, useState } from "react";
import { Circle, Hexagon, Square, Diamond, Triangle, Octagon, Minus } from "lucide-react";
import { useTheme } from "../../../../../styles/ThemeContext";

interface NodeSettingsProps {
  neShape: string;
  setNeShape: (shape: string) => void;
  lcaShape: string;
  setLcaShape: (shape: string) => void;
  neBorderStyle: string;
  setNeBorderStyle: (style: string) => void;
  lcaBorderStyle: string;
  setLcaBorderStyle: (style: string) => void;
}

export default function NodeSettings({
  neShape,
  setNeShape,
  lcaShape,
  setLcaShape,
  neBorderStyle,
  setNeBorderStyle,
  lcaBorderStyle,
  setLcaBorderStyle,
}: NodeSettingsProps) {
  const colors = useTheme();
  const [openShapeDropdown, setOpenShapeDropdown] = useState<"ne" | "lca" | null>(null);
  const [openBorderDropdown, setOpenBorderDropdown] = useState<"ne" | "lca" | null>(null);
  // Match EdgeSettings: dropdown chrome stays white-on-black regardless of
  // theme so the controls read consistently across light/dark/legacy.
  const buttonBg = "white";
  const iconColor = "black";

  const shapes: { type: string; icon: JSX.Element }[] = [
    { type: "diamond", icon: <Diamond size={20} /> },
    { type: "ellipse", icon: <Circle size={20} /> },
    { type: "hexagon", icon: <Hexagon size={20} /> },
    { type: "octagon", icon: <Octagon size={20} /> },
    { type: "roundrectangle", icon: <Square size={20} /> }, // Cytoscape rectangle
    { type: "triangle", icon: <Triangle size={20} /> },
  ];

  const borderOptions: { type: string; icon: JSX.Element }[] = [
    { type: "solid", icon: <Minus size={20} /> },
    { type: "dashed", icon: <Minus size={20} style={{ strokeDasharray: "4 2" }} /> },
    { type: "dotted", icon: <Minus size={20} style={{ strokeDasharray: "1 3" }} /> },
    { type: "double", icon: <div style={{ width: 20, height: 20, position: "relative" }}>
      <span style={{ position: "absolute", top: 6, left: 0, right: 0, height: 2, background: "black" }} />
      <span style={{ position: "absolute", top: 12, left: 0, right: 0, height: 2, background: "black" }} />
    </div> },
  ];
  const getShapeObj = (shape: string) =>
    shapes.find((s) => s.type === shape) || shapes.find((s) => s.type === "roundrectangle");

  const renderNodeTypeControls = (
    label: "NE" | "LCA",
    shape: string,
    setShape: (shape: string) => void,
    borderStyle: string,
    setBorderStyle: (style: string) => void
  ) => {
    const selectedShapeObj = getShapeObj(shape);
    const selectedBorderObj =
      borderOptions.find((b) => b.type === borderStyle) || borderOptions[0];
    const shapeKey = label.toLowerCase() as "ne" | "lca";

    return (
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <strong style={{ minWidth: 34 }}>{label}</strong>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>Shape:</span>
          <div style={{ position: "relative" }}>
            <button
              onClick={() =>
                setOpenShapeDropdown(openShapeDropdown === shapeKey ? null : shapeKey)
              }
              style={{
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #ccc",
                borderRadius: 4,
                backgroundColor: buttonBg,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {selectedShapeObj &&
                React.cloneElement(selectedShapeObj.icon, { color: iconColor, size: 20 })}
            </button>
            {openShapeDropdown === shapeKey && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  backgroundColor: buttonBg,
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  marginTop: 4,
                  overflow: "hidden",
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {shapes.map((shapeOption) => (
                  <div
                    key={shapeOption.type}
                    onClick={() => {
                      setShape(shapeOption.type);
                      setOpenShapeDropdown(null);
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      backgroundColor: shape === shapeOption.type ? "#e0f0ff" : buttonBg,
                    }}
                  >
                    {React.cloneElement(shapeOption.icon, { color: iconColor, size: 20 })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>Border:</span>
          <div style={{ position: "relative" }}>
            <button
              onClick={() =>
                setOpenBorderDropdown(openBorderDropdown === shapeKey ? null : shapeKey)
              }
              style={{
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #ccc",
                borderRadius: 4,
                backgroundColor: buttonBg,
                cursor: "pointer",
              }}
            >
              {selectedBorderObj.type === "double"
                ? selectedBorderObj.icon
                : React.cloneElement(selectedBorderObj.icon as JSX.Element, { color: iconColor })}
            </button>
            {openBorderDropdown === shapeKey && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  backgroundColor: buttonBg,
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  marginTop: 4,
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {borderOptions.map((option) => (
                  <div
                    key={option.type}
                    onClick={() => {
                      setBorderStyle(option.type);
                      setOpenBorderDropdown(null);
                    }}
                    style={{
                      width: 40,
                      height: 40,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: borderStyle === option.type ? "#e0f0ff" : "white",
                      cursor: "pointer",
                    }}
                  >
                    {option.type === "double"
                      ? option.icon
                      : React.cloneElement(option.icon as JSX.Element, { color: "black" })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
      <h4 style={{ margin: 0 }}>Nodes</h4>
      {renderNodeTypeControls("NE", neShape, setNeShape, neBorderStyle, setNeBorderStyle)}
      {renderNodeTypeControls("LCA", lcaShape, setLcaShape, lcaBorderStyle, setLcaBorderStyle)}
    </div>
  );
}
