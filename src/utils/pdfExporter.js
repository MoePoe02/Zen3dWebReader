import { PDFDocument, rgb } from 'pdf-lib';

const ATTACHMENT_FILENAME = 'zen-reader-state.json';

// ─── Color helpers ────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '').slice(0, 6);
  const n = parseInt(h.padEnd(6, '0'), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// ─── Export ───────────────────────────────────────────────────────────────────
/**
 * Exports the current PDF with:
 *  1. Standard PDF annotations (postits, highlights, draws, bookmarks)
 *     so other readers can display them.
 *  2. A hidden JSON attachment with the full Zen Reader state
 *     so re-importing the file restores everything perfectly.
 *
 * @param {ArrayBuffer} originalPdfBytes  — the raw bytes of the original PDF
 * @param {object}      state             — snapshot of the relevant store fields
 * @returns {Uint8Array} the modified PDF bytes ready for download
 */
export async function exportPdfWithAnnotations(originalPdfBytes, state) {
  const {
    postits = [],
    bookmarks = [],
    draws = [],
    highlights = [],
    imageTags = [],
    fileName = 'document.pdf',
  } = state;

  // Load the original document
  const pdfDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  // ── Helper: get page dimensions ──────────────────────────────────────────
  const getPageDims = (pageNum) => {
    const idx = Math.max(0, Math.min(pageNum - 1, totalPages - 1));
    const { width, height } = pages[idx].getSize();
    return { width, height, page: pages[idx] };
  };

  // ── 1. Highlights → /Highlight annotations ───────────────────────────────
  for (const hl of highlights) {
    if (!hl.pageNumber || !hl.rects || hl.rects.length === 0) continue;
    const { width, height, page } = getPageDims(hl.pageNumber);

    // Extract base color from the stored color string (e.g. '#ffea0875')
    const baseHex = (hl.color || '#ffea08').slice(0, 7);
    const c = hexToRgb(baseHex);

    for (const r of hl.rects) {
      try {
        page.drawRectangle({
          x: r.x * width,
          y: height - (r.y + r.h) * height,
          width: r.w * width,
          height: r.h * height,
          color: rgb(c.red, c.green, c.blue),
          opacity: 0.35,
        });
      } catch (_) { /* skip malformed rects */ }
    }
  }

  // ── 2. Drawings → render onto page canvas ────────────────────────────────
  for (const d of draws) {
    if (!d.pageNumber || !d.points || d.points.length < 2) continue;
    const { width, height, page } = getPageDims(d.pageNumber);
    const c = hexToRgb((d.color || '#ffea08').slice(0, 7));
    const lw = (d.width || 0.003) * width;

    const toX = (nx) => nx * width;
    const toY = (ny) => height - ny * height;

    if (d.type === 'rect') {
      const p1 = d.points[0];
      const p2 = d.points[d.points.length - 1];
      page.drawRectangle({
        x: Math.min(toX(p1.x), toX(p2.x)),
        y: Math.min(toY(p1.y), toY(p2.y)),
        width: Math.abs(toX(p2.x) - toX(p1.x)),
        height: Math.abs(toY(p1.y) - toY(p2.y)),
        borderColor: c, borderWidth: lw, opacity: 1,
      });
    } else if (d.type === 'ellipse') {
      const p1 = d.points[0];
      const p2 = d.points[d.points.length - 1];
      page.drawEllipse({
        x: (toX(p1.x) + toX(p2.x)) / 2,
        y: (toY(p1.y) + toY(p2.y)) / 2,
        xScale: Math.abs(toX(p2.x) - toX(p1.x)) / 2,
        yScale: Math.abs(toY(p1.y) - toY(p2.y)) / 2,
        borderColor: c, borderWidth: lw, opacity: 1,
      });
    } else {
      // Freehand / line — draw as connected line segments
      for (let i = 1; i < d.points.length; i++) {
        const a = d.points[i - 1];
        const b = d.points[i];
        page.drawLine({
          start: { x: toX(a.x), y: toY(a.y) },
          end:   { x: toX(b.x), y: toY(b.y) },
          color: c, thickness: lw, opacity: 1,
        });
      }
    }
  }

  // ── 3. Post-its — NOT drawn as visual elements.
  //    They are preserved exclusively in the embedded JSON attachment (section 4)
  //    so that Zen 3D Web Reader can restore them perfectly on re-import.
  //    Other PDF readers will simply not see them, keeping the page clean.

  // ── 4. Bookmarks — NOT drawn as visual elements.
  //    They are preserved exclusively in the embedded JSON attachment (section 5)
  //    so that Zen 3D Web Reader can restore them perfectly on re-import.
  //    Other PDF readers will simply not see them, keeping the page clean.


  // ── 5. Embed hidden JSON attachment for re-import ─────────────────────────
  const zenState = {
    version: 1,
    exportedAt: new Date().toISOString(),
    fileName,
    postits,
    bookmarks,
    draws,
    highlights,
    imageTags,
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(zenState));
  await pdfDoc.attach(jsonBytes, ATTACHMENT_FILENAME, {
    mimeType: 'application/json',
    description: 'Zen Reader annotations — do not delete',
    creationDate: new Date(),
    modificationDate: new Date(),
  });

  return pdfDoc.save();
}

// ─── Import: extract embedded state if present ────────────────────────────────
/**
 * Given a pdfjs-dist PDFDocumentProxy (the object returned by loadPdfDocument),
 * reads the embedded Zen Reader JSON attachment if one exists.
 *
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdfjsDoc
 * @returns {object|null} parsed state object or null
 */
export async function extractZenState(pdfjsDoc) {
  try {
    // pdfjs-dist exposes all /EmbeddedFiles as a plain object: { filename → { content: Uint8Array } }
    const attachments = await pdfjsDoc.getAttachments();
    if (!attachments || !attachments[ATTACHMENT_FILENAME]) return null;

    const content = attachments[ATTACHMENT_FILENAME].content; // Uint8Array
    const text = new TextDecoder().decode(content);
    const state = JSON.parse(text);
    console.log('[pdfExporter] Zen state found — version', state.version, '— exported', state.exportedAt);
    return state;
  } catch (e) {
    console.warn('[pdfExporter] Could not extract Zen state:', e);
    return null;
  }
}

// ─── Trigger browser download ─────────────────────────────────────────────────
export function downloadBytes(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
