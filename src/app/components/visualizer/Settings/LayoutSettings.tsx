"use client";
import React from "react";
import { useTheme } from "../../../../../styles/ThemeContext";

interface LayoutSettingsProps {
  layoutName: string;
  setLayoutName: (name: string) => void;
}

const LAYOUT_OPTIONS = [
  { value: "breadthfirst", label: "Breadth First (default)" },
  { value: "circle", label: "Circle" },
  { value: "cluster", label: "Cluster (by type)" },
  { value: "concentric", label: "Concentric" },
  { value: "grid", label: "Grid" },
  { value: "hierarchical", label: "Hierarchical (LCA top)" },
  { value: "hierarchicalClassic", label: "Hierarchical (classic)" },
];

export default function LayoutSettings({
  layoutName,
  setLayoutName,
}: LayoutSettingsProps) {
  const colors = useTheme();

  return (
    <div
      style={{
        border: `1px solid ${colors.white}22`,
        borderRadius: 10,
        padding: "0.85rem",
      }}
    >
      <h3 style={{ margin: "0 0 0.65rem", fontSize: 16 }}>Layout</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ minWidth: 74, fontSize: 13, color: `${colors.white}cc` }}>
          Algorithm
        </label>
        <select
          value={layoutName}
          onChange={(e) => setLayoutName(e.target.value)}
          style={{
            flex: 1,
            padding: "0.45rem 0.55rem",
            borderRadius: 8,
            border: `1px solid ${colors.white}33`,
            backgroundColor: colors.darkblue,
            color: colors.white,
            fontSize: 13,
            outline: "none",
          }}
        >
          {LAYOUT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
