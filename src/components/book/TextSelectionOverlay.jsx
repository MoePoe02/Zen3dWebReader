import { useState, useEffect, useMemo, useRef } from 'react';
import { TextLayer } from 'pdfjs-dist';
import useBookStore from '../../store/useBookStore';
import { getPageTextData } from '../../utils/pdfEngine';

const TEXT_LAYER_CSS = `
.pdfRealTextLayer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  line-height: 1;
  text-size-adjust: none;
  -webkit-text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
  user-select: none;
}

.pdfRealTextLayer span {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
  user-select: text;
}

.pdfRealTextLayer br {
  user-select: none;
  pointer-events: none;
}

.pdfRealTextLayer {
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor, 1) * var(--min-font-size));
  --min-font-size-inv: calc(1 / var(--min-font-size));
  --selection-color: rgba(0, 120, 255, 0.25); /* Default blue selection */
}

.pdfRealTextLayer.highlight-mode {
  --selection-color: rgba(255, 235, 59, 0.4); /* Yellow preview selection */
}

.pdfRealTextLayer > :not(.markedContent),
.pdfRealTextLayer .markedContent span:not(.markedContent) {
  --font-height: 0;
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  --scale-x: 1;
  --rotate: 0deg;
  transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
}

.pdfRealTextLayer .markedContent {
  display: contents;
}

.pdfRealTextLayer span::selection {
  background: rgba(181, 208, 255, 0.4); /* Celeste transparente */
}

/* Cuando estamos resaltando, hacemos la selección nativa invisible para que brille el color del resaltador */
.pdfRealTextLayer.highlight-mode span::selection {
  background: transparent;
}

/* Previsualización (mientras se arrastra el mouse) */
::highlight(pdf-selection) {
  /* Using a fixed alpha here for the preview and letting the CSS variable handle the base color */
  background-color: var(--highlight-preview-color, #fffb00);
  filter: opacity(0.4);
  color: inherit;
}

/* Resaltados definitivos: Eliminados del CSS ya que ahora se pintan en la textura 3D */

.pdfHighlightFallback .pdfRealTextLayer span::selection {
  background: #b5d0ff;
  color: transparent;
}
`;

export default function TextSelectionOverlay() {
  const isTextSelectMode   = useBookStore(state => state.isTextSelectMode);
  const isHighlightMode    = useBookStore(state => state.isHighlightMode);
  const isEraserMode       = useBookStore(state => state.isEraserMode);
  const removeHighlightAt  = useBookStore(state => state.removeHighlightAt);
  const removeDrawAt       = useBookStore(state => state.removeDrawAt);
  const isDrawMode         = useBookStore(state => state.isDrawMode);
  const isSquareMode       = useBookStore(state => state.isSquareMode);
  const isCompassMode      = useBookStore(state => state.isCompassMode);
  const drawColor          = useBookStore(state => state.drawColor);
  const drawWidth          = useBookStore(state => state.drawWidth);
  const addDraw            = useBookStore(state => state.addDraw);
  const highlightColor     = useBookStore(state => state.highlightColor);
  const highlightPreviewColor = useBookStore(state => state.highlightPreviewColor);
  const pdfDocument        = useBookStore(state => state.pdfDocument);
  const currentSpreadIndex = useBookStore(state => state.currentSpreadIndex);
  const totalSpreads       = useBookStore(state => state.totalSpreads);
  const totalPages         = useBookStore(state => state.totalPages);
  const useNativeCover     = useBookStore(state => state.useNativeCover);
  const aspectRatio        = useBookStore(state => state.aspectRatio) || 0.707;
  const cameraZoom         = useBookStore(state => state.cameraZoom);
  const cameraPosition     = useBookStore(state => state.cameraPosition) || { x: 0, y: 0 };
  
  const highlights         = useBookStore(state => state.highlights);
  const addHighlight       = useBookStore(state => state.addHighlight);

  const [leftPageData,  setLeftPageData]  = useState(null);
  const [rightPageData, setRightPageData] = useState(null);

  // Drawing state
  const isDrawingRef       = useRef(false);
  const drawPointsRef      = useRef([]);
  const drawPageNumRef     = useRef(null);
  const drawContainerRef   = useRef(null);
  const activePreviewRef   = useRef(null);
  const isManualHighlightRef = useRef(false);
  const isRightClickDrawingRef = useRef(false);
  const leftPreviewRef     = useRef(null);
  const rightPreviewRef    = useRef(null);

  // Mapeo de páginas
  const visiblePages = useMemo(() => {
    let leftPage  = null;
    let rightPage = null;
    const ri = currentSpreadIndex;
    if (ri > 0 && ri < totalSpreads - 1) {
      rightPage = useNativeCover ? ri * 2 : ri * 2 - 1;
    }
    const li = currentSpreadIndex - 1;
    if (li >= 0 && li < totalSpreads - 1) {
      leftPage = useNativeCover ? li * 2 + 1 : li * 2;
    }
    if (li === 0 && useNativeCover) leftPage = 1;
    if (li === totalSpreads - 1 && useNativeCover) leftPage = totalPages;

    return { left: leftPage, right: rightPage };
  }, [currentSpreadIndex, totalSpreads, totalPages, useNativeCover]);

  // Cargar data de texto
  useEffect(() => {
    if (!isTextSelectMode || !pdfDocument) return;
    let cancelled = false;
    const load = async () => {
      if (visiblePages.left) {
        const d = await getPageTextData(pdfDocument, visiblePages.left);
        if (!cancelled) setLeftPageData(d);
      } else setLeftPageData(null);
      if (visiblePages.right) {
        const d = await getPageTextData(pdfDocument, visiblePages.right);
        if (!cancelled) setRightPageData(d);
      } else setRightPageData(null);
    };
    load();
    return () => { cancelled = true; };
  }, [isTextSelectMode, pdfDocument, visiblePages]);

  // CSS Highlight API — only handles the LIVE selection preview.
  // Permanent highlights are baked into the 3D textures via pdfEngine.renderPageToTexture.
  useEffect(() => {
    const supported = typeof CSS !== 'undefined' && CSS.highlights;
    // ONLY act if text select is ON AND we are specifically in HIGHLIGHT MODE
    if (!isTextSelectMode || !isHighlightMode || !supported) {
      if (supported) CSS.highlights.delete('pdf-selection');
      return;
    }

    // Update the CSS variable for the highlight color based on the store's current color
    document.documentElement.style.setProperty('--highlight-preview-color', highlightPreviewColor);

    const sync = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        CSS.highlights.delete('pdf-selection');
      } else {
        const previewRanges = [];
        for (let i = 0; i < sel.rangeCount; i++) previewRanges.push(sel.getRangeAt(i));
        CSS.highlights.set('pdf-selection', new Highlight(...previewRanges));
      }
    };

    document.addEventListener('selectionchange', sync);
    return () => {
      document.removeEventListener('selectionchange', sync);
      CSS.highlights.delete('pdf-selection');
    };
  }, [isTextSelectMode, isHighlightMode, highlightPreviewColor]);

  const handlePointerDown = (e, pageNum, container, previewCanvas) => {
    if (isEraserMode && container) {
      e.stopPropagation();
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      removeHighlightAt(pageNum, nx, ny);
      removeDrawAt(pageNum, nx, ny);
      return;
    }

    const anyShapeMode = isDrawMode || isSquareMode || isCompassMode;
    if (anyShapeMode && container) {
      if (isDrawMode) {
        // Differentiation for DRAW: Left click = freehand, Right click (button 2) = straight line
        if (e.button === 2 || e.button === 0) {
          if (e.button === 2) isRightClickDrawingRef.current = true;
          else isDrawingRef.current = true;
          e.preventDefault();
          e.stopPropagation();
        } else return;
      } else {
        // Square/Compass only use left click for now
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        isDrawingRef.current = true;
      }

      drawPageNumRef.current  = pageNum;
      drawContainerRef.current = container;
      activePreviewRef.current = previewCanvas;
      
      const rect = container.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      drawPointsRef.current = [{ x: nx, y: ny }];
      
      if (previewCanvas && !isRightClickDrawingRef.current && !isSquareMode && !isCompassMode) {
        const ctx = previewCanvas.getContext('2d');
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = drawWidth * previewCanvas.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      }
      return;
    }

    if (isHighlightMode && container && e.target === container) {
      // Manual highlight line only on Left Click
      if (e.button !== 0) return;
      e.stopPropagation();
      isManualHighlightRef.current = true;
      drawPageNumRef.current  = pageNum;
      drawContainerRef.current = container;
      activePreviewRef.current = previewCanvas;

      const rect = container.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      drawPointsRef.current = [{ x: nx, y: ny }];
    }
  };

  const handlePointerMove = (e) => {
    const container = drawContainerRef.current;
    const previewCanvas = activePreviewRef.current;
    if (!(isDrawMode || isSquareMode || isCompassMode || isManualHighlightRef.current) || !container || !previewCanvas) return;
    if (!isDrawingRef.current && !isManualHighlightRef.current && !isRightClickDrawingRef.current) return;
    
    // Stop propagation here too for consistency
    e.stopPropagation();

    const rect = container.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    
    const nx = px / rect.width;
    const ny = py / rect.height;

    const ctx = previewCanvas.getContext('2d');
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawWidth * previewCanvas.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isRightClickDrawingRef.current) {
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      const p1x = drawPointsRef.current[0].x * previewCanvas.width;
      const p1y = drawPointsRef.current[0].y * previewCanvas.height;
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(px, py);
      ctx.stroke();

      if (drawPointsRef.current.length > 1) {
        drawPointsRef.current[1] = { x: nx, y: ny };
      } else {
        drawPointsRef.current.push({ x: nx, y: ny });
      }
      return;
    }

    if (isManualHighlightRef.current) {
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      ctx.strokeStyle = highlightPreviewColor;
      ctx.lineWidth = 20; // Fixed thickness in pixels for preview
      ctx.lineCap = 'butt';
      
      const p1x = drawPointsRef.current[0].x * previewCanvas.width;
      const p1y = drawPointsRef.current[0].y * previewCanvas.height;
      
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(px, py);
      ctx.stroke();

      if (drawPointsRef.current.length > 1) {
        drawPointsRef.current[1] = { x: nx, y: ny };
      } else {
        drawPointsRef.current.push({ x: nx, y: ny });
      }
      return;
    }

    if (isSquareMode || isCompassMode) {
      // Shape mode (Preview only needs first and current point)
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      const p1x = drawPointsRef.current[0].x * previewCanvas.width;
      const p1y = drawPointsRef.current[0].y * previewCanvas.height;
      
      const width = px - p1x;
      const height = py - p1y;
      
      if (isSquareMode) {
        ctx.strokeRect(p1x, p1y, width, height);
      } else {
        const centerX = p1x + width / 2;
        const centerY = p1y + height / 2;
        const radiusX = Math.abs(width) / 2;
        const radiusY = Math.abs(height) / 2;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();
      }
      // Update the second point (last) for final commit
      if (drawPointsRef.current.length > 1) {
        drawPointsRef.current[1] = { x: nx, y: ny };
      } else {
        drawPointsRef.current.push({ x: nx, y: ny });
      }
    } else {
      // Freehand Draw
      drawPointsRef.current.push({ x: nx, y: ny });
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, py);
    }
  };

  const handlePointerUp = (e) => {
    const anyShapeMode = isDrawMode || isSquareMode || isCompassMode;
    if (anyShapeMode && (isDrawingRef.current || isRightClickDrawingRef.current)) {
      e.stopPropagation();
      const isRight = isRightClickDrawingRef.current;
      isDrawingRef.current = false;
      isRightClickDrawingRef.current = false;

      if (drawPointsRef.current.length >= 2 || (anyShapeMode && !isRight && drawPointsRef.current.length >= 1)) {
        let type = 'stroke';
        if (isSquareMode) type = 'rect';
        if (isCompassMode) type = 'ellipse';
        if (isRight) type = 'line';
        
        addDraw(drawPageNumRef.current, { 
          color: drawColor, 
          points: drawPointsRef.current,
          type 
        });
      }
      [leftPreviewRef.current, rightPreviewRef.current].forEach(c => {
        if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
      });
      drawPointsRef.current = [];
      activePreviewRef.current = null;
      return;
    }
    
    if (isManualHighlightRef.current) {
      isManualHighlightRef.current = false;
      if (drawPointsRef.current.length >= 2) {
        addHighlight(drawPageNumRef.current, [], highlightColor, 'line', drawPointsRef.current);
      }
      [leftPreviewRef.current, rightPreviewRef.current].forEach(c => {
        if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
      });
      drawPointsRef.current = [];
      activePreviewRef.current = null;
      return;
    }

    if (!isHighlightMode || isEraserMode) return;

    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const leftContainer = document.querySelector('.pdfPageContainer.left .pdfRealTextLayer');
      const rightContainer = document.querySelector('.pdfPageContainer.right .pdfRealTextLayer');
      const leftBound = leftContainer?.getBoundingClientRect();
      const rightBound = rightContainer?.getBoundingClientRect();
      const leftRects = [];
      const rightRects = [];
      for (let i = 0; i < sel.rangeCount; i++) {
        const range = sel.getRangeAt(i);
        const rects = range.getClientRects();
        for (let j = 0; j < rects.length; j++) {
          const r = rects[j];
          const midX = r.left + r.width / 2;
          const midY = r.top + r.height / 2;
          if (leftBound && midX >= leftBound.left && midX <= leftBound.right && midY >= leftBound.top && midY <= leftBound.bottom) {
            const nw = r.width / leftBound.width;
            const nh = r.height / leftBound.height;
            if (nw > 0.001 && nh > 0.001 && nw < 0.9 && nh < 0.2)
              leftRects.push({ x: (r.left - leftBound.left) / leftBound.width, y: (r.top - leftBound.top) / leftBound.height, w: nw, h: nh });
          } else if (rightBound && midX >= rightBound.left && midX <= rightBound.right && midY >= rightBound.top && midY <= rightBound.bottom) {
            const nw = r.width / rightBound.width;
            const nh = r.height / rightBound.height;
            if (nw > 0.001 && nh > 0.001 && nw < 0.9 && nh < 0.2)
              rightRects.push({ x: (r.left - rightBound.left) / rightBound.width, y: (r.top - rightBound.top) / rightBound.height, w: nw, h: nh });
          }
        }
      }
      if (leftRects.length > 0) addHighlight(visiblePages.left, leftRects, highlightColor);
      if (rightRects.length > 0) addHighlight(visiblePages.right, rightRects, highlightColor);
      sel.removeAllRanges();
    }
  };

  if (!isTextSelectMode) return null;

  return (
    <>
      <style>{TEXT_LAYER_CSS}</style>
      <div 
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onWheel={(e) => {
          const canvas = document.querySelector('canvas[data-engine]') || document.querySelector('canvas');
          if (canvas) {
            canvas.dispatchEvent(new WheelEvent('wheel', {
              deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ,
              clientX: e.clientX, clientY: e.clientY,
              ctrlKey: e.ctrlKey, bubbles: true, cancelable: true,
            }));
          }
        }}
        style={{ 
          position: 'absolute', inset: 0, zIndex: 150, 
          pointerEvents: (isHighlightMode || isEraserMode || isDrawMode || isSquareMode || isCompassMode) ? 'auto' : 'none',
          cursor: isEraserMode ? `url(/ERASER.svg) 9 28, auto` : (isDrawMode || isSquareMode || isCompassMode) ? 'crosshair' : (isHighlightMode) ? 'text' : 'auto'
        }}
      >
        <PageLayer 
          data={leftPageData} 
          side="left" 
          aspectRatio={aspectRatio} 
          currentSpreadIndex={currentSpreadIndex} 
          totalSpreads={totalSpreads} 
          cameraZoom={cameraZoom} 
          cameraPosition={cameraPosition}
          isHighlightMode={isHighlightMode}
          isEraserMode={isEraserMode}
          isDrawMode={isDrawMode}
          isSquareMode={isSquareMode}
          isCompassMode={isCompassMode}
          drawColor={drawColor}
          previewRef={leftPreviewRef}
          onPointerDown={(e, p, c, cv) => handlePointerDown(e, p, c, cv)}
        />
        <PageLayer 
          data={rightPageData} 
          side="right" 
          aspectRatio={aspectRatio} 
          currentSpreadIndex={currentSpreadIndex} 
          totalSpreads={totalSpreads} 
          cameraZoom={cameraZoom} 
          cameraPosition={cameraPosition}
          isHighlightMode={isHighlightMode}
          isEraserMode={isEraserMode}
          isDrawMode={isDrawMode}
          isSquareMode={isSquareMode}
          isCompassMode={isCompassMode}
          drawColor={drawColor}
          previewRef={rightPreviewRef}
          onPointerDown={(e, p, c, cv) => handlePointerDown(e, p, c, cv)}
        />
      </div>
    </>
  );
}

function PageLayer({ 
  data, side, aspectRatio, currentSpreadIndex, totalSpreads, cameraZoom, cameraPosition,
  isHighlightMode, isEraserMode, isDrawMode, isSquareMode, isCompassMode,
  drawColor, previewRef, onPointerDown 
}) {
  const containerRef = useRef(null);
  const textLayerRef = useRef(null);
  const [dim, setDim] = useState({ width: 0, height: 0, left: 0, top: 0 });

  // Sincronizar dimensiones con el zoom 3D
  useEffect(() => {
    const update = () => {
      const h = window.innerHeight;
      const w = window.innerWidth;
      const zoom = cameraZoom || ((h * 0.85) / 4.24);
      const sheetW = 4.24 * aspectRatio * zoom;
      const sheetH = 4.24 * zoom;
      const centerX = w / 2;
      const centerY = h / 2;

      let offset3D = 0;
      if (currentSpreadIndex === 0) offset3D = -(4.24 * aspectRatio / 2);
      else if (currentSpreadIndex === totalSpreads) offset3D = (4.24 * aspectRatio / 2);
      
      const spineX = centerX + (offset3D * zoom) - (cameraPosition.x * zoom);
      const left = side === 'left' ? spineX - sheetW : spineX;

      setDim({ width: sheetW, height: sheetH, left, top: centerY - sheetH / 2 + (cameraPosition.y * zoom) });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [aspectRatio, side, currentSpreadIndex, totalSpreads, cameraZoom, cameraPosition]);

  // Actualizar la capa de texto
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data || dim.width === 0) return;

    if (textLayerRef.current) {
      textLayerRef.current.cancel();
      textLayerRef.current = null;
    }
    container.innerHTML = '';

    const { page, viewport } = data;
    const currentScale = dim.height / viewport.height;
    const scaledViewport = page.getViewport({ scale: currentScale, rotation: viewport.rotation });

    container.style.setProperty('--total-scale-factor', String(currentScale));

    const tl = new TextLayer({
      textContentSource: page.streamTextContent({ includeMarkedContent: true }),
      container,
      viewport: scaledViewport,
    });

    textLayerRef.current = tl;
    tl.render().catch(err => {
      if (err?.name !== 'AbortException') console.error('[TextLayer]', err);
    });

    return () => tl.cancel();
  }, [data, dim.width, dim.height]); 

  const pageNum = data?.page?.pageNumber;

  return (
    <div 
      className={`pdfPageContainer ${side}`}
      style={{
        position: 'absolute',
        width: dim.width,
        height: dim.height,
        left: dim.left,
        top: dim.top,
        pointerEvents: 'none',
        zIndex: 10
      }}
    >
      {/* Draw Preview Canvas */}
      <canvas
        ref={previewRef}
        width={dim.width}
        height={dim.height}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 80,
          opacity: (isDrawMode || isSquareMode || isCompassMode || isHighlightMode) ? 1 : 0
        }}
      />

      {/* Interaction Layer: Captures clicks for Eraser and Draw */}
      <div 
        onPointerDown={(e) => onPointerDown(e, pageNum, containerRef.current, previewRef?.current)}
        style={{ 
          position: 'absolute', 
          inset: 0, 
          background: 'transparent',
          zIndex: 100,
          pointerEvents: (isEraserMode || isDrawMode || isSquareMode || isCompassMode) ? 'auto' : 'none',
        }}
      />

      {/* Actual Text Layer: pdf.js renders here */}
      <div 
        ref={containerRef}
        className={`pdfRealTextLayer ${isHighlightMode ? 'highlight-mode' : ''}`}
        onPointerDown={(e) => onPointerDown(e, pageNum, containerRef.current, previewRef?.current)}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 1,
          pointerEvents: (isEraserMode || isDrawMode || isSquareMode || isCompassMode) ? 'none' : 'auto',
          zIndex: 50
        }}
      />
    </div>
  );
}
