"use client";
import React, { useState, useEffect, useRef } from "react";
import { HexColorPicker } from "react-colorful";
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv, FALLBACK_COLOR } from "../../../../../styles/colorUtils";

interface ColorPickerProps {
  color: string;
  position: { x: number; y: number };
  onChange: (color: string) => void;
  onClose: () => void;
}

export default function ColorPicker({ color, position, onChange, onClose }: ColorPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const normalizeHex = (input?: string) => {
    const raw = (input || FALLBACK_COLOR).trim();
    const withHash = raw.startsWith("#") ? raw : `#${raw}`;
    const v = withHash.toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    if (/^#[0-9a-f]{3}$/.test(v)) {
      return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
    }
    return FALLBACK_COLOR;
  };

  // Ensure all states start with safe defaults
  const initialColor = normalizeHex(color);
  const [tempColor, setTempColor] = useState(initialColor);
  const [hex, setHex] = useState(initialColor);
  const [rgb, setRgb] = useState(() => hexToRgb(initialColor));
  const [hsv, setHsv] = useState(() => rgbToHsv(rgb.r, rgb.g, rgb.b));
  const [pos, setPos] = useState(position);
  const lastSyncedColorRef = useRef<string>(initialColor);

  // Sync state when prop color changes
  useEffect(() => {
    const c = normalizeHex(color);
    if (lastSyncedColorRef.current === c) return;
    lastSyncedColorRef.current = c;
    setTempColor(c);
    setHex(c);
    const { r, g, b } = hexToRgb(c);
    setRgb({ r, g, b });
    setHsv(rgbToHsv(r, g, b));
  }, [color]);

  // Position adjustment
  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const margin = 8;
    let x = position.x;
    let y = position.y;
    if (x + rect.width + margin > window.innerWidth) x = window.innerWidth - rect.width - margin;
    if (y + rect.height + margin > window.innerHeight) y = window.innerHeight - rect.height - margin;
    if (x < margin) x = margin;
    if (y < margin) y = margin;
    setPos({ x, y });
  }, [position]);

  // Esc and outside-click both close the picker. Color changes are applied
  // live as the user adjusts the wheel/inputs, so closing simply commits.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      const root = containerRef.current;
      if (root && !root.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [onClose]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value || FALLBACK_COLOR;
    setHex(val);
    if (/^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(val)) {
      const normalized = normalizeHex(val);
      const { r, g, b } = hexToRgb(normalized);
      setRgb({ r, g, b });
      setHsv(rgbToHsv(r, g, b));
      setTempColor(normalized);
      lastSyncedColorRef.current = normalized;
      if (normalizeHex(color) !== normalized) onChange(normalized);
    }
  };

  const handleRgbChange = (key: "r" | "g" | "b", value: number) => {
    const newRgb = { ...rgb, [key]: Math.max(0, Math.min(255, value)) };
    setRgb(newRgb);
    const hexVal = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setHex(hexVal);
    setHsv(rgbToHsv(newRgb.r, newRgb.g, newRgb.b));
    setTempColor(hexVal);
    const normalized = normalizeHex(hexVal);
    lastSyncedColorRef.current = normalized;
    if (normalizeHex(color) !== normalized) onChange(normalized);
  };

  const handleHsvChange = (key: "h" | "s" | "v", value: number) => {
    const newHsv = { ...hsv, [key]: value };
    setHsv(newHsv);
    const { r, g, b } = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
    setRgb({ r, g, b });
    const hexVal = rgbToHex(r, g, b);
    setHex(hexVal);
    setTempColor(hexVal);
    const normalized = normalizeHex(hexVal);
    lastSyncedColorRef.current = normalized;
    if (normalizeHex(color) !== normalized) onChange(normalized);
  };

  const rowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "32px 1fr 1fr 1fr",
    gap: 4,
    alignItems: "center",
  };

  const inputStyle: React.CSSProperties = {
    height: 24,
    padding: "0 4px",
    borderRadius: 4,
    border: "1px solid #e0e0e0",
    textAlign: "center",
    boxSizing: "border-box",
    width: "100%",
    fontSize: 11,
    color: "#333",
    backgroundColor: "#fafafa",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: "#999",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: pos.y,
        left: pos.x,
        zIndex: 1000,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.08)",
        borderRadius: 10,
        backgroundColor: "#fff",
        color: "#000",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: 220,
      }}
    >
      <HexColorPicker
        color={tempColor || FALLBACK_COLOR}
        onChange={(c) => {
          const safeColor = normalizeHex(c);
          if (safeColor === tempColor) return;
          setTempColor(safeColor);
          setHex(safeColor);
          const { r, g, b } = hexToRgb(safeColor);
          setRgb({ r, g, b });
          setHsv(rgbToHsv(r, g, b));
          lastSyncedColorRef.current = safeColor;
          if (safeColor !== normalizeHex(color)) onChange(safeColor);
        }}
        style={{ width: "100%", height: 160, borderRadius: 6 }}
      />

      <div style={{ height: 1, backgroundColor: "#f0f0f0", margin: "0 -10px" }} />

      <div style={rowStyle}>
        <span style={labelStyle}>HEX</span>
        <input
          type="text"
          value={hex || ""}
          onChange={handleHexChange}
          style={{ ...inputStyle, gridColumn: "span 2" }}
        />
        <div
          style={{
            height: 24,
            width: "100%",
            backgroundColor: tempColor || FALLBACK_COLOR,
            border: "1px solid #e0e0e0",
            borderRadius: 4,
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>RGB</span>
        {(["r", "g", "b"] as const).map((k) => (
          <input
            key={k}
            type="number"
            value={rgb[k] ?? 0}
            onChange={(e) => handleRgbChange(k, parseInt(e.target.value) || 0)}
            style={inputStyle}
          />
        ))}
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>HSV</span>
        {(["h", "s", "v"] as const).map((k) => (
          <input
            key={k}
            type="number"
            value={hsv[k] ?? 0}
            onChange={(e) => handleHsvChange(k, parseInt(e.target.value) || 0)}
            style={inputStyle}
          />
        ))}
      </div>

    </div>
  );
}
