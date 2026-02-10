import { NODE_HEIGHT, NODE_WIDTH, NOISE_NODE_SIZE } from "../components/constants.js";

const MAX_CANVAS_SIDE = 8192;
const DEFAULT_FILENAME_PREFIX = "causion-dag";

function isNoiseNode(node) {
  return node?.type === "noise" || String(node?.id || "").startsWith("noise:");
}

function getNodeRect(node) {
  const width = Math.max(
    1,
    Number(node?.measured?.width) ||
      Number(node?.width) ||
      (isNoiseNode(node) ? NOISE_NODE_SIZE : NODE_WIDTH)
  );
  const height = Math.max(
    1,
    Number(node?.measured?.height) ||
      Number(node?.height) ||
      (isNoiseNode(node) ? NOISE_NODE_SIZE : NODE_HEIGHT)
  );
  const sourcePosition = node?.positionAbsolute || node?.position || { x: 0, y: 0 };
  const x = Number(sourcePosition.x) || 0;
  const y = Number(sourcePosition.y) || 0;
  return { x, y, width, height };
}

export function computeNodeBounds(nodes = []) {
  const nodeRects = (Array.isArray(nodes) ? nodes : []).map(getNodeRect);
  if (!nodeRects.length) {
    return { minX: 0, minY: 0, width: 0, height: 0 };
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  nodeRects.forEach((rect) => {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  });
  return {
    minX,
    minY,
    width: Math.max(1, Math.ceil(maxX - minX)),
    height: Math.max(1, Math.ceil(maxY - minY)),
  };
}

function writeInlineStyles(sourceElement, targetElement) {
  const computedStyle = window.getComputedStyle(sourceElement);
  const styleText = [];
  for (let index = 0; index < computedStyle.length; index += 1) {
    const property = computedStyle[index];
    const value = computedStyle.getPropertyValue(property);
    styleText.push(`${property}:${value};`);
  }
  targetElement.setAttribute("style", styleText.join(""));
}

function cloneWithInlineStyles(sourceRoot) {
  const clonedRoot = sourceRoot.cloneNode(true);
  const sourceElements = [sourceRoot, ...sourceRoot.querySelectorAll("*")];
  const clonedElements = [clonedRoot, ...clonedRoot.querySelectorAll("*")];
  sourceElements.forEach((sourceElement, index) => {
    const clonedElement = clonedElements[index];
    if (!clonedElement) return;
    writeInlineStyles(sourceElement, clonedElement);
  });
  return clonedRoot;
}

function buildViewportSvgMarkup(viewportElement, bounds) {
  const viewportClone = cloneWithInlineStyles(viewportElement);
  viewportClone.style.transformOrigin = "0 0";
  viewportClone.style.transform = `translate(${-bounds.minX}px, ${-bounds.minY}px) scale(1)`;
  viewportClone.style.background = "transparent";
  viewportClone.style.margin = "0";

  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  wrapper.style.width = `${bounds.width}px`;
  wrapper.style.height = `${bounds.height}px`;
  wrapper.style.margin = "0";
  wrapper.style.padding = "0";
  wrapper.style.overflow = "hidden";
  wrapper.style.background = "transparent";
  wrapper.appendChild(viewportClone);

  const serializer = new XMLSerializer();
  const wrapperMarkup = serializer.serializeToString(wrapper);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">${wrapperMarkup}</foreignObject>` +
    `</svg>`
  );
}

function svgToPngDataUrl(svgMarkup, width, height) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const deviceScale = Math.max(1, Number(window.devicePixelRatio) || 1);
      const scale = Math.min(3, Math.max(2, deviceScale * 1.5));
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(MAX_CANVAS_SIDE, Math.max(1, Math.round(width * scale)));
      canvas.height = Math.min(MAX_CANVAS_SIDE, Math.max(1, Math.round(height * scale)));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas context unavailable."));
        return;
      }
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("Failed to rasterize DAG image."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  });
}

function downloadFromDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function timestampForFilename(timestamp = new Date()) {
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, "0");
  const day = String(timestamp.getDate()).padStart(2, "0");
  const hours = String(timestamp.getHours()).padStart(2, "0");
  const minutes = String(timestamp.getMinutes()).padStart(2, "0");
  const seconds = String(timestamp.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

export function buildDagImageFilename(prefix = DEFAULT_FILENAME_PREFIX, timestamp = new Date()) {
  const safePrefix = String(prefix || DEFAULT_FILENAME_PREFIX).replace(/[^a-z0-9-_]+/gi, "-");
  return `${safePrefix}-${timestampForFilename(timestamp)}.png`;
}

export async function downloadDagImage({
  rootElement,
  nodes = [],
  filenamePrefix = DEFAULT_FILENAME_PREFIX,
} = {}) {
  if (!rootElement) {
    throw new Error("DAG export root element is missing.");
  }
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new Error("There are no DAG nodes to export.");
  }
  const viewportElement = rootElement.querySelector(".react-flow__viewport");
  if (!viewportElement) {
    throw new Error("DAG viewport not found.");
  }

  const bounds = computeNodeBounds(nodes);
  const svgMarkup = buildViewportSvgMarkup(viewportElement, bounds);
  const pngDataUrl = await svgToPngDataUrl(svgMarkup, bounds.width, bounds.height);
  const filename = buildDagImageFilename(filenamePrefix);
  downloadFromDataUrl(pngDataUrl, filename);
  return { filename, width: bounds.width, height: bounds.height };
}

export const __TEST_ONLY__ = {
  computeNodeBounds,
  buildDagImageFilename,
};
