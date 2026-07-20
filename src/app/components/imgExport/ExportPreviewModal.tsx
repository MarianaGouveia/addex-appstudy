"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../../../../styles/ThemeContext";
import { appendVerbalizationToCanvas } from "../../hooks/exportPNG";

type ExportFormat = "png" | "jpg" | "pdf" | "svg";

interface ExportPreviewModalProps {
  canvas: HTMLCanvasElement;
  canvasNoLegend: HTMLCanvasElement;
  svgString?: string;
  svgStringNoLegend?: string;
  verbalization?: string;
  onClose: () => void;
  fileName: string;
}

const BASE_FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "pdf", label: "PDF" },
];

const JPEG_QUALITY = 0.92;
const JPEG_BACKGROUND = "#ffffff";

function withJpegBackground(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext("2d")!;
  ctx.fillStyle = JPEG_BACKGROUND;
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  return flat;
}

// Append the verbalization to an SVG string as a <foreignObject> below the
// existing graph SVG, so SVG report exports stay self-contained and editable.
function appendVerbalizationToSvg(
  svgString: string,
  verbalization: string
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName.toLowerCase() !== "svg") return svgString;

  const widthAttr = root.getAttribute("width");
  const heightAttr = root.getAttribute("height");
  const width = widthAttr ? parseFloat(widthAttr) : 800;
  const height = heightAttr ? parseFloat(heightAttr) : 600;

  // Heuristic text height: line ≈ 22px at the rendered font, plus padding +
  // heading. Renderer (browser/inkscape) wraps the foreignObject content
  // automatically, so over-estimating just leaves a bit of whitespace.
  const lines = Math.ceil(verbalization.length / Math.max(60, width / 8));
  const textHeight = 60 + lines * 22 + 40;

  const newHeight = height + textHeight;
  root.setAttribute("height", String(newHeight));
  const viewBox = root.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(parseFloat);
    if (parts.length === 4) {
      parts[3] = newHeight;
      root.setAttribute("viewBox", parts.join(" "));
    }
  }

  const fo = doc.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
  fo.setAttribute("x", "0");
  fo.setAttribute("y", String(height));
  fo.setAttribute("width", String(width));
  fo.setAttribute("height", String(textHeight));

  const xhtml = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
  xhtml.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  xhtml.setAttribute(
    "style",
    "padding:24px 28px;background:#ffffff;color:#1f1f1f;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif;" +
      "font-size:14px;line-height:1.6;box-sizing:border-box;"
  );
  xhtml.innerHTML =
    `<h3 style="margin:0 0 12px 0;font-size:16px;font-weight:700;">Summary</h3>` +
    `<div style="white-space:pre-wrap;word-wrap:break-word;">${escapeHtml(verbalization)}</div>`;
  fo.appendChild(xhtml);
  root.appendChild(fo);

  return new XMLSerializer().serializeToString(root);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function ExportPreviewModal({
  canvas,
  canvasNoLegend,
  svgString,
  svgStringNoLegend,
  verbalization,
  onClose,
  fileName,
}: ExportPreviewModalProps) {
  const colors = useTheme();
  const [format, setFormat] = useState<ExportFormat>("png");
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeVerbalization, setIncludeVerbalization] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portal to document.body: the graph container has a transform that would
  // otherwise become the containing block for our position:fixed overlay,
  // trapping it inside the canvas instead of covering the viewport.
  useEffect(() => setMounted(true), []);

  // Close on Escape and lock background scroll while the modal is open, so the
  // preview always has a keyboard exit and doesn't leave the page trapped.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const hasVerbalization = !!verbalization;
  const activeCanvas = includeLegend ? canvas : canvasNoLegend;
  const activeSvgString = includeLegend ? svgString : svgStringNoLegend;

  const hasSvg = includeLegend ? !!svgString : !!svgStringNoLegend;
  const formatOptions = useMemo(
    () =>
      hasSvg
        ? [...BASE_FORMAT_OPTIONS, { value: "svg" as ExportFormat, label: "SVG" }]
        : BASE_FORMAT_OPTIONS,
    [hasSvg]
  );

  const previewSrc = useMemo(
    () => activeCanvas.toDataURL("image/png"),
    [activeCanvas]
  );
  const safeName = fileName.replace(/\s+/g, "_");

  const handleCopy = async () => {
    try {
      const out = await buildExportCanvas();
      const blob: Blob = await new Promise((resolve, reject) => {
        out.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
          "image/png"
        );
      });
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      alert("Image copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy image:", err);
      alert("Failed to copy image.");
    }
  };

  const triggerDownload = (href: string, filename: string) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.click();
  };

  // Build the canvas to export. If the user enabled "Verbalization", stitch
  // the verbalization text under the graph (rendered via html2canvas so the
  // exported image is a self-contained report).
  const buildExportCanvas = async (): Promise<HTMLCanvasElement> => {
    if (!includeVerbalization || !verbalization) return activeCanvas;
    return appendVerbalizationToCanvas(activeCanvas, verbalization);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      if (format === "png") {
        const out = await buildExportCanvas();
        triggerDownload(out.toDataURL("image/png"), `${safeName}.png`);
        return;
      }

      if (format === "jpg") {
        const out = await buildExportCanvas();
        const flat = withJpegBackground(out);
        triggerDownload(
          flat.toDataURL("image/jpeg", JPEG_QUALITY),
          `${safeName}.jpg`
        );
        return;
      }

      if (format === "svg") {
        if (!activeSvgString) {
          alert("SVG export is unavailable for this graph.");
          return;
        }
        // jsPDF / native SVG don't compose easily with arbitrary text on top
        // of the cytoscape SVG, so when verbalization is requested we still
        // honor it via a foreignObject appended to the bottom of the SVG.
        const finalSvg =
          includeVerbalization && verbalization
            ? appendVerbalizationToSvg(activeSvgString, verbalization)
            : activeSvgString;
        const blob = new Blob([finalSvg], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        triggerDownload(url, `${safeName}.svg`);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        return;
      }

      const { jsPDF } = await import("jspdf");
      const pxToMm = (px: number) => (px * 25.4) / 96;
      const out = await buildExportCanvas();
      const orientation = out.width >= out.height ? "landscape" : "portrait";
      const pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: [pxToMm(out.width), pxToMm(out.height)],
      });
      pdf.addImage(
        out.toDataURL("image/jpeg", JPEG_QUALITY),
        "JPEG",
        0,
        0,
        pxToMm(out.width),
        pxToMm(out.height)
      );
      pdf.save(`${safeName}.pdf`);
    } catch (err) {
      console.error("Failed to export image:", err);
      alert("Failed to export image.");
    } finally {
      setExporting(false);
    }
  };

  const downloadLabel = exporting
    ? "Preparing…"
    : `Download ${format.toUpperCase()}`;

  if (!mounted) return null;

  return createPortal(
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        boxSizing: "border-box",
        padding: "1rem",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Image graph preview export"
        style={{
          width: "92vw",
          maxWidth: "1200px",
          height: "92vh",
          maxHeight: "92vh",
          backgroundColor: colors.darkblue,
          borderRadius: 10,
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          color: colors.white,
          position: "relative",
          boxSizing: "border-box",
          overflow: "hidden",
          boxShadow: "0 0 20px rgba(0,0,0,0.4)",
        }}
      >
        <h2 style={{ margin: 0, textAlign: "center", fontWeight: "bold" }}>
          Image Graph Preview Export
        </h2>
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            backgroundColor: "transparent",
            border: "none",
            fontSize: 20,
            fontWeight: 700,
            cursor: "pointer",
            color: colors.white,
          }}
        >
          ×
        </button>

        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            padding: 12,
            backgroundColor: "#ffffff",
            borderRadius: 6,
          }}
        >
          <img
            src={previewSrc}
            alt="Graph Preview"
            style={{
              maxWidth: "100%",
              maxHeight: includeVerbalization && verbalization ? "60%" : "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              borderRadius: 6,
            }}
          />
          {includeVerbalization && verbalization && (
            <div
              style={{
                width: "min(100%, 720px)",
                color: "#1f1f1f",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif',
                fontSize: 14,
                lineHeight: 1.6,
                padding: "16px 20px",
                boxSizing: "border-box",
                borderTop: "1px solid #e0e0e0",
              }}
            >
              <h3
                style={{
                  margin: "0 0 12px 0",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                Summary
              </h3>
              <div style={{ whiteSpace: "pre-wrap", wordWrap: "break-word" }}>
                {verbalization}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label
            style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}
          >
            Format:
            <select
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as ExportFormat)
              }
              style={{
                padding: "0.4rem 0.6rem",
                borderRadius: 6,
                border: `1px solid ${colors.white}35`,
                backgroundColor: colors.black,
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {formatOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={includeLegend}
              onChange={(event) => setIncludeLegend(event.target.checked)}
              style={{ cursor: "pointer" }}
            />
            Caption
          </label>

          <label
            title={
              hasVerbalization
                ? "Append the natural-language summary below the graph"
                : "No summary available for this hypothesis"
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              cursor: hasVerbalization ? "pointer" : "not-allowed",
              userSelect: "none",
              opacity: hasVerbalization ? 1 : 0.5,
            }}
          >
            <input
              type="checkbox"
              checked={includeVerbalization && hasVerbalization}
              disabled={!hasVerbalization}
              onChange={(event) =>
                setIncludeVerbalization(event.target.checked)
              }
              style={{ cursor: hasVerbalization ? "pointer" : "not-allowed" }}
            />
            Summary
          </label>

          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: 6,
              border: "none",
              backgroundColor: colors.buttons,
              color: "white",
              fontWeight: 600,
              cursor: exporting ? "wait" : "pointer",
              opacity: exporting ? 0.7 : 1,
            }}
          >
            {downloadLabel}
          </button>
          <button
            onClick={handleCopy}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: 6,
              border: "none",
              backgroundColor: colors.buttons,
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Copy to Clipboard
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
