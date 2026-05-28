import * as pdfjsLib from 'pdfjs-dist';
import * as THREE from 'three';

// Use Vite's ?url import to get the worker's real file URL (not inlined as blob).
// This preserves import.meta.url context inside the worker for relative asset loading.
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export const loadPdfDocument = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({
    data: arrayBuffer,
    // THE FIX: Point to WASM decoders copied to public/pdfjs-wasm/
    // These are the openjpeg, jbig2 and qcms files needed for scanned books (JPEG2000/JPX).
    wasmUrl: `${import.meta.env.BASE_URL}pdfjs-wasm/`,
    cMapUrl: 'https://unpkg.com/pdfjs-dist@5.6.205/cmaps/',
    cMapPacked: true,
    useSystemFonts: true,
  }).promise;
  return pdfDoc;
};

// ─── Texture Cache ────────────────────────────────────────────────────────────
const textureCache = new Map();
const MAX_CACHE = 20;

const getCacheKey = (pdfDoc, pageNumber) =>
  `${pdfDoc.fingerprints?.[0] ?? 'doc'}_${pageNumber}`;

const evictOldest = () => {
  if (textureCache.size >= MAX_CACHE) {
    const firstKey = textureCache.keys().next().value;
    const oldTex = textureCache.get(firstKey);
    oldTex?.dispose();
    textureCache.delete(firstKey);
  }
};

export const renderPageToTexture = async (pdfDoc, pageNumber, highlights = [], draws = [], pdfQuality = 2.0) => {
  if (!pdfDoc || !pageNumber) return null;

  const hlKey = highlights.map(h => `${h.id}-${h.color}`).join('|');
  const drKey = draws.map(d => d.id).join('|');
  const key = `${getCacheKey(pdfDoc, pageNumber)}_${hlKey}_${drKey}_q${pdfQuality}`;
  
  if (textureCache.has(key)) return textureCache.get(key);


  console.log(`[pdfEngine] Rendering page ${pageNumber} at quality ${pdfQuality}...`);
  let page;
  try {
    page = await pdfDoc.getPage(pageNumber);
  } catch (e) {
    console.error(`[pdfEngine] Error getting page ${pageNumber}:`, e);
    return null;
  }

  const rotation = page.rotate || 0;
  const viewport = page.getViewport({ scale: 1.0, rotation });

  const dpr = window.devicePixelRatio || 1;
  // Render at target height based on pdfQuality
  const targetHeight = window.innerHeight * pdfQuality * dpr;
  let scale = targetHeight / viewport.height;
  // Raised cap to 6144 to accommodate the higher base resolution.
  const MAX_DIM = 6144;
  if (viewport.width * scale > MAX_DIM)  scale = MAX_DIM / viewport.width;
  if (viewport.height * scale > MAX_DIM) scale = MAX_DIM / viewport.height;

  const scaledViewport = page.getViewport({ scale, rotation });
  const canvas = document.createElement('canvas');
  canvas.width  = Math.floor(scaledViewport.width);
  canvas.height = Math.floor(scaledViewport.height);

  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  try {
    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
  } catch (e) {
    console.error(`[pdfEngine] Error rendering page ${pageNumber}:`, e);
    return null;
  }

  // Draw saved highlights onto the texture.
  // Grouping by color to avoid alpha-stacking WITHIN the same color.
  if (highlights && highlights.length > 0) {
    const offscreen = document.createElement('canvas');
    offscreen.width  = canvas.width;
    offscreen.height = canvas.height;
    const off = offscreen.getContext('2d');

    // Grouping by color to avoid alpha-stacking WITHIN the same color.
    const groups = highlights.reduce((acc, hl) => {
      const c = hl.color || '#fffb0066'; // Default to yellow with 40% alpha
      if (!acc[c]) acc[c] = [];
      acc[c].push(hl);
      return acc;
    }, {});

    Object.entries(groups).forEach(([color, hls]) => {
      off.clearRect(0, 0, offscreen.width, offscreen.height);
      
      // Extract base color and alpha from hex (e.g. #fffb0030)
      const baseColor = color.length >= 7 ? color.substring(0, 7) : '#fffb00';
      const alphaHex  = color.length >= 9 ? color.substring(7, 9) : '40';
      const alpha     = parseInt(alphaHex, 16) / 255;

      off.fillStyle = baseColor;
      off.strokeStyle = baseColor;
      off.lineWidth = 0.02 * canvas.height; // Fixed thickness for highlight lines
      off.lineCap = 'butt';

      hls.forEach(hl => {
        if (hl.type === 'line' && hl.points && hl.points.length >= 2) {
          off.beginPath();
          off.moveTo(hl.points[0].x * canvas.width, hl.points[0].y * canvas.height);
          off.lineTo(hl.points[1].x * canvas.width, hl.points[1].y * canvas.height);
          off.stroke();
        } else {
          (hl.rects || []).forEach(r => {
            off.fillRect(
              r.x * canvas.width,
              r.y * canvas.height,
              r.w * canvas.width,
              r.h * canvas.height
            );
          });
        }
      });

      ctx.globalAlpha = alpha;
      ctx.drawImage(offscreen, 0, 0);
    });
    ctx.globalAlpha = 1.0;
  }

  // Draw freehand strokes on top of highlights, fully opaque.
  if (draws && draws.length > 0) {
    draws.forEach(d => {
      if (!d.points || d.points.length < 1) return;
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = d.color || '#f3ff0b';
      ctx.lineWidth = (d.width || 0.003) * canvas.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (d.type === 'rect') {
        if (d.points.length < 2) return;
        const p1 = d.points[0];
        const p2 = d.points[d.points.length - 1];
        ctx.strokeRect(p1.x * canvas.width, p1.y * canvas.height, (p2.x - p1.x) * canvas.width, (p2.y - p1.y) * canvas.height);
      } 
      else if (d.type === 'ellipse') {
        if (d.points.length < 2) return;
        const p1 = d.points[0];
        const p2 = d.points[d.points.length - 1];
        const centerX = ((p1.x + p2.x) / 2) * canvas.width;
        const centerY = ((p1.y + p2.y) / 2) * canvas.height;
        const radiusX = Math.abs(p2.x - p1.x) / 2 * canvas.width;
        const radiusY = Math.abs(p2.y - p1.y) / 2 * canvas.height;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();
      }
      else if (d.type === 'line') {
        if (d.points.length < 2) return;
        const p1 = d.points[0];
        const p2 = d.points[d.points.length - 1];
        ctx.beginPath();
        ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
        ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
        ctx.stroke();
      }
      else {
        // Default: Freehand Stroke
        ctx.beginPath();
        ctx.moveTo(d.points[0].x * canvas.width, d.points[0].y * canvas.height);
        for (let i = 1; i < d.points.length; i++) {
          ctx.lineTo(d.points[i].x * canvas.width, d.points[i].y * canvas.height);
        }
        ctx.stroke();
      }
    });
  }

  page.cleanup();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  // ── No mipmaps for PDF text content ──────────────────────────────────────────
  // WebGL's auto-generated mipmaps use a box-filter average that progressively
  // turns thin black text strokes into gray pixels as the camera zooms out.
  // The higher the source resolution, the more averaging levels → worse contrast.
  // This is why high-quality textures looked WORSE at a distance than low-quality ones.
  //
  // Without mipmaps, LinearFilter samples directly from the original canvas pixels
  // (which are either black or white), preserving maximum contrast at any zoom level.
  // The cover textures already use this approach and look correct.
  texture.generateMipmaps = false;
  texture.minFilter        = THREE.LinearFilter;
  texture.magFilter        = THREE.LinearFilter;
  texture.anisotropy       = 16;

  evictOldest();
  textureCache.set(key, texture);
  console.log(`[pdfEngine] Page ${pageNumber} OK — ${canvas.width}x${canvas.height}`);
  return texture;
};

export const clearTextureCache = () => {
  textureCache.forEach(tex => tex.dispose());
  textureCache.clear();
};

export const getPageTextData = async (pdfDoc, pageNumber) => {
  if (!pdfDoc || !pageNumber) return null;
  try {
    const page = await pdfDoc.getPage(pageNumber);
    const rotation = page.rotate || 0;
    // We return the page itself along with its viewport.
    // The caller (TextSelectionOverlay) will pass page.streamTextContent()
    // directly to PDF.js TextLayer for pixel-perfect, font-aware positioning.
    const viewport = page.getViewport({ scale: 1.0, rotation });
    return { page, viewport, rotation };
  } catch (e) {
    console.error(`[pdfEngine] Error getting text for page ${pageNumber}:`, e);
    return null;
  }
};
