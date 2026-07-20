import html2canvas from "html2canvas";
import { Core } from "cytoscape";
import { Pair } from "./types"; // Adjust path
interface LegendRect { x: number; y: number; width: number; height: number; }
const EXPORT_SCALE = 3;

// Render the verbalization as a separate canvas (heading + body, sized to
// match the graph width) and stitch it under the graph canvas. The combined
// canvas is what the report-mode PNG/JPG export downloads.
//
// Text font size and wrapper width are chosen so the rasterized summary
// reads at roughly the same scale as the graph node labels — graph nodes
// render at fontSize 20 × EXPORT_SCALE = 60px, summary at 22 × 3 = 66px,
// which keeps the two visually peer-balanced rather than text being a tiny
// footnote under a giant graph (the previous 14px CSS produced 42px in the
// final canvas, which read as small for PDF/print).
export async function appendVerbalizationToCanvas(
  graphCanvas: HTMLCanvasElement,
  verbalization: string,
  options?: { backgroundColor?: string; textColor?: string }
): Promise<HTMLCanvasElement> {
  const bg = options?.backgroundColor ?? "#ffffff";
  const fg = options?.textColor ?? "#1f1f1f";

  const cssWidth = Math.max(480, Math.round(graphCanvas.width / EXPORT_SCALE));

  const wrapper = document.createElement("div");
  wrapper.style.cssText = [
    "position: fixed",
    "top: -10000px",
    "left: 0",
    `width: ${cssWidth}px`,
    // Tight top padding so the text sits close to the graph image (was 24,
    // which left a noticeable gap once stitched under the graph canvas);
    // bottom padding kept generous so PDF print doesn't clip the descenders.
    "padding: 14px 28px 24px",
    "box-sizing: border-box",
    `background-color: ${bg}`,
    `color: ${fg}`,
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif',
    "font-size: 22px",
    "line-height: 1.55",
  ].join(";");

  const heading = document.createElement("h3");
  heading.textContent = "Summary";
  heading.style.cssText =
    "margin: 0 0 10px 0; font-size: 26px; font-weight: 700;";
  wrapper.appendChild(heading);

  const body = document.createElement("div");
  body.textContent = verbalization;
  body.style.cssText = "white-space: pre-wrap; word-wrap: break-word;";
  wrapper.appendChild(body);

  document.body.appendChild(wrapper);

  try {
    const textCanvas = await html2canvas(wrapper, {
      backgroundColor: bg,
      scale: EXPORT_SCALE,
      useCORS: true,
    });

    const combined = document.createElement("canvas");
    combined.width = Math.max(graphCanvas.width, textCanvas.width);
    combined.height = graphCanvas.height + textCanvas.height;
    const ctx = combined.getContext("2d")!;

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, combined.width, combined.height);

    const graphX = Math.round((combined.width - graphCanvas.width) / 2);
    ctx.drawImage(graphCanvas, graphX, 0);

    const textX = Math.round((combined.width - textCanvas.width) / 2);
    ctx.drawImage(textCanvas, textX, graphCanvas.height);

    return combined;
  } finally {
    document.body.removeChild(wrapper);
  }
}

type CySvg = Core & {
  svg: (options?: { full?: boolean; scale?: number; bg?: string }) => string;
};

function clampLegendPos(
  legendCurrentRect: LegendRect,
  legendCssW: number,
  legendCssH: number,
  cyViewportW: number,
  cyViewportH: number
) {
  return {
    x: Math.min(
      Math.max(0, legendCurrentRect.x),
      Math.max(0, cyViewportW - legendCssW)
    ),
    y: Math.min(
      Math.max(0, legendCurrentRect.y),
      Math.max(0, cyViewportH - legendCssH)
    ),
  };
}

export function exportGraphAsSVG(
  cy: Core,
  legendContentEl: HTMLDivElement | null,
  legendCurrentRect: LegendRect | null
): string {
  const cySvgInstance = cy as CySvg;
  if (typeof cySvgInstance.svg !== "function") {
    throw new Error("cytoscape-svg plugin is not registered.");
  }

  const graphSvgString = cySvgInstance.svg({
    full: false,
    scale: 1,
    bg: "transparent",
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(graphSvgString, "image/svg+xml");
  const rootSvg = doc.documentElement;

  if (rootSvg.nodeName.toLowerCase() !== "svg") {
    throw new Error("cytoscape-svg returned invalid SVG output.");
  }

  if (!legendContentEl || !legendCurrentRect) {
    return new XMLSerializer().serializeToString(rootSvg);
  }

  const cyContainer = cy.container() as HTMLDivElement | null;
  if (!cyContainer) {
    throw new Error("Cytoscape container is unavailable.");
  }

  const legendCaptureEl =
    legendContentEl.parentElement instanceof HTMLDivElement
      ? legendContentEl.parentElement
      : legendContentEl;
  const legendRect = legendCaptureEl.getBoundingClientRect();
  const legendCssW = legendRect.width;
  const legendCssH = legendRect.height;

  const { x: clampedX, y: clampedY } = clampLegendPos(
    legendCurrentRect,
    legendCssW,
    legendCssH,
    Math.max(1, cyContainer.clientWidth),
    Math.max(1, cyContainer.clientHeight)
  );

  const legendClone = legendCaptureEl.cloneNode(true) as HTMLElement;
  legendClone
    .querySelectorAll('[data-export-hide="true"]')
    .forEach((node) => node.parentElement?.removeChild(node));

  const fo = doc.createElementNS(
    "http://www.w3.org/2000/svg",
    "foreignObject"
  );
  fo.setAttribute("x", String(clampedX));
  fo.setAttribute("y", String(clampedY));
  fo.setAttribute("width", String(legendCssW));
  fo.setAttribute("height", String(legendCssH));

  const xhtmlWrapper = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "div"
  );
  xhtmlWrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  xhtmlWrapper.innerHTML = legendClone.outerHTML;
  fo.appendChild(xhtmlWrapper);
  rootSvg.appendChild(fo);

  return new XMLSerializer().serializeToString(rootSvg);
}

export async function exportGraphWithLegend(
  cy: Core,
  pair: Pair,
  mainContainerEl: HTMLDivElement,
  legendContentEl: HTMLDivElement | null,
  legendCurrentRect: LegendRect | null,
  returnCanvas = false
): Promise<HTMLCanvasElement | void> {
  if (!cy || !pair) return;

  try {
    const graphPng = cy.png({ full: false, scale: EXPORT_SCALE });

    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = reject;
      });

    const cyContainer = cy.container() as HTMLDivElement | null;
    if (!cyContainer) {
      throw new Error("Cytoscape container is unavailable.");
    }

    const includeLegend = !!(legendContentEl && legendCurrentRect);
    const legendCaptureEl = includeLegend
      ? legendContentEl!.parentElement instanceof HTMLDivElement
        ? legendContentEl!.parentElement
        : legendContentEl!
      : null;

    const legendPng = legendCaptureEl
      ? (
          await html2canvas(legendCaptureEl, {
            backgroundColor: null,
            scale: EXPORT_SCALE,
            useCORS: true,
            ignoreElements: (element) =>
              element instanceof HTMLElement &&
              element.dataset.exportHide === "true",
          })
        ).toDataURL("image/png")
      : null;

    const [graphImg, legendImg] = await Promise.all([
      loadImage(graphPng),
      legendPng ? loadImage(legendPng) : Promise.resolve(null),
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = graphImg.width;
    canvas.height = graphImg.height;
    const ctx = canvas.getContext("2d")!;

    const bgColor =
      cyContainer.style.backgroundColor ||
      mainContainerEl.style.backgroundColor ||
      "#ffffff";
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw graph exactly as rendered in the Cytoscape viewport.
    ctx.drawImage(graphImg, 0, 0, graphImg.width, graphImg.height);

    const cyViewportW = Math.max(1, cyContainer.clientWidth);
    const cyViewportH = Math.max(1, cyContainer.clientHeight);
    const graphScaleX = graphImg.width / cyViewportW;
    const graphScaleY = graphImg.height / cyViewportH;

    let legendCssBox: { x: number; y: number; w: number; h: number } | null = null;

    if (legendImg && legendCaptureEl && legendCurrentRect) {
      const legendRect = legendCaptureEl.getBoundingClientRect();
      const legendCssW = legendRect.width;
      const legendCssH = legendRect.height;

      const clampedLegendX = Math.min(
        Math.max(0, legendCurrentRect.x),
        Math.max(0, cyViewportW - legendCssW)
      );
      const clampedLegendY = Math.min(
        Math.max(0, legendCurrentRect.y),
        Math.max(0, cyViewportH - legendCssH)
      );

      // Render the legend smaller than its on-screen footprint (which is
      // tuned for an interactive draggable widget, not a print caption). At
      // 1:1 it reads heavier than a graph node in the exported PDF/PNG;
      // 0.6x scale brings it visually in line with the node labels.
      const LEGEND_EXPORT_SCALE = 0.6;
      const drawnCssW = legendCssW * LEGEND_EXPORT_SCALE;
      const drawnCssH = legendCssH * LEGEND_EXPORT_SCALE;

      // Map legend from CSS pixels to exported graph pixels using measured scale.
      const legendX = Math.round(clampedLegendX * graphScaleX);
      const legendY = Math.round(clampedLegendY * graphScaleY);
      const legendW = Math.max(1, Math.round(drawnCssW * graphScaleX));
      const legendH = Math.max(1, Math.round(drawnCssH * graphScaleY));
      ctx.drawImage(legendImg, legendX, legendY, legendW, legendH);

      legendCssBox = {
        x: clampedLegendX,
        y: clampedLegendY,
        w: drawnCssW,
        h: drawnCssH,
      };
    }

    // Crop the canvas to just the graph elements (+ legend if shown).
    // cy.png({full: false}) bakes the entire viewport into the image, which
    // for short paths leaves a lot of empty whitespace around the actual
    // content — making the exported PNG/PDF feel huge with the graph
    // floating in a sea of blank space, and the verbalization text below
    // looks tiny by comparison. Cropping ties the export tightly to the
    // visible graph + legend.
    const elBbox = cy.elements().renderedBoundingBox();
    const PAD_CSS = 24;
    const minXcss = Math.max(
      0,
      Math.min(elBbox.x1, legendCssBox?.x ?? Infinity) - PAD_CSS
    );
    const minYcss = Math.max(
      0,
      Math.min(elBbox.y1, legendCssBox?.y ?? Infinity) - PAD_CSS
    );
    const maxXcss = Math.min(
      cyViewportW,
      Math.max(elBbox.x2, legendCssBox ? legendCssBox.x + legendCssBox.w : 0) +
        PAD_CSS
    );
    const maxYcss = Math.min(
      cyViewportH,
      Math.max(elBbox.y2, legendCssBox ? legendCssBox.y + legendCssBox.h : 0) +
        PAD_CSS
    );
    const cropX = Math.round(minXcss * graphScaleX);
    const cropY = Math.round(minYcss * graphScaleY);
    const cropW = Math.max(1, Math.round((maxXcss - minXcss) * graphScaleX));
    const cropH = Math.max(1, Math.round((maxYcss - minYcss) * graphScaleY));

    const cropped = document.createElement("canvas");
    cropped.width = cropW;
    cropped.height = cropH;
    const cctx = cropped.getContext("2d")!;
    cctx.fillStyle = bgColor;
    cctx.fillRect(0, 0, cropW, cropH);
    cctx.drawImage(canvas, -cropX, -cropY);

    if (returnCanvas) return cropped;

    const link = document.createElement("a");
    link.download = `${pair.source}_${pair.target}`.replace(/\s+/g, "_") + ".png";
    link.href = cropped.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.error("Failed to export graph:", err);
    alert("Failed to export graph! Check console for details.");
  }
}
