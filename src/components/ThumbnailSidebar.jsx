import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import useBookStore from '../store/useBookStore';

// ─── Constants ───────────────────────────────────────────────────────────────
const SIDEBAR_WIDTH = 200;
const THUMB_W = 130; // wider thumbnails so they feel more centered
const THUMB_H = Math.round(THUMB_W / 0.707); // A4-ish ratio

const BOOKMARK_COLORS = [
  { id: 'orange', color: '#f59e42', label: 'Orange' },
  { id: 'green',  color: '#49e372', label: 'Green'   },
  { id: 'blue',   color: '#49a5e3', label: 'Blue'    },
  { id: 'pink',   color: '#e3499e', label: 'Pink'    },
];

// ─── Module-level thumbnail cache ─────────────────────────────────────────────
// Keyed by `${pdfFingerprint}_${pageNumber}` → data URL string.
// Lives outside React so it survives sidebar close/reopen and avoids re-renders.
const thumbCache = new Map();
let cachedDocFingerprint = null;

function getFingerprint(pdfDoc) {
  return pdfDoc?.fingerprints?.[0] ?? 'doc';
}

function clearThumbCacheIfNewDoc(pdfDoc) {
  const fp = getFingerprint(pdfDoc);
  if (fp !== cachedDocFingerprint) {
    thumbCache.clear();
    cachedDocFingerprint = fp;
  }
}

// ─── Hook: render one PDF page to a data-URL using pdfjs ─────────────────────
function usePageThumbnail(pdfDoc, pageNumber, enabled) {
  const cacheKey = `${getFingerprint(pdfDoc)}_${pageNumber}`;

  // Initialise from cache immediately — no loading state needed for cached pages
  const [dataUrl, setDataUrl] = useState(() => thumbCache.get(cacheKey) ?? null);
  const cancelRef = useRef(false);

  useEffect(() => {
    // Already cached — nothing to do
    if (thumbCache.has(cacheKey)) {
      setDataUrl(thumbCache.get(cacheKey));
      return;
    }

    if (!pdfDoc || !pageNumber || !enabled) return;
    cancelRef.current = false;
    let renderTask = null;

    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelRef.current) return;

        const rotation = page.rotate || 0;
        const baseVp = page.getViewport({ scale: 1, rotation });
        const scale = THUMB_W / baseVp.width;
        const vp = page.getViewport({ scale, rotation });

        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        renderTask = page.render({ canvasContext: ctx, viewport: vp });
        await renderTask.promise;
        if (cancelRef.current) return;

        const url = canvas.toDataURL('image/jpeg', 0.82);
        thumbCache.set(cacheKey, url);  // ← persist in module cache
        setDataUrl(url);
        page.cleanup();
      } catch (_) {
        // silently ignore cancelled renders
      }
    })();

    return () => {
      cancelRef.current = true;
      renderTask?.cancel?.();
    };
  // Re-run only when the page enters the viewport for the first time (or pdfDoc changes)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, pageNumber, enabled, cacheKey]);

  return dataUrl;
}

// ─── Single thumbnail item ────────────────────────────────────────────────────
const ThumbItem = memo(function ThumbItem({ pdfDoc, pageNumber, isActive, dots, onClick, visible }) {
  const [hovered, setHovered] = useState(false);
  const dataUrl = usePageThumbnail(pdfDoc, pageNumber, visible);

  return (
    <div
      data-page={pageNumber}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',   // ← thumbnails centred horizontally
        gap: 7,
        padding: '5px 6px',
        cursor: 'pointer',
        borderRadius: 8,
        background: isActive
          ? 'rgba(144,110,80,0.3)'
          : hovered
          ? 'rgba(255,255,255,0.06)'
          : 'transparent',
        transition: 'background 0.18s ease',
        flexShrink: 0,
      }}
    >
      {/* Thumbnail box */}
      <div style={{
        width: THUMB_W,
        height: THUMB_H,
        flexShrink: 0,
        borderRadius: 4,
        overflow: 'hidden',
        border: isActive
          ? '2px solid #906E50'
          : `2px solid ${hovered ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'}`,
        transition: 'border-color 0.18s ease',
        // No box-shadow per request #2
        position: 'relative',
        background: '#e8e4df',
      }}>
        {dataUrl
          ? <img src={dataUrl} alt={`Página ${pageNumber}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 18, height: 18, border: '2px solid rgba(0,0,0,0.15)',
                borderTopColor: '#906E50', borderRadius: '50%',
                animation: 'spin 0.9s linear infinite',
              }} />
            </div>
          )
        }

        {/* Page number badge */}
        <div style={{
          position: 'absolute', bottom: 2, right: 4,
          fontSize: 9, color: 'rgba(0,0,0,0.45)',
          fontFamily: 'monospace', letterSpacing: '0.04em',
          pointerEvents: 'none',
          textShadow: '0 0 4px rgba(255,255,255,0.8)',
        }}>
          {pageNumber}
        </div>
      </div>

      {/* Bookmark dots — no glow (#2 & #3) */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        gap: 5, alignItems: 'center', minWidth: 12, flexShrink: 0,
      }}>
        {dots.map((color, i) => (
          <div
            key={i}
            title={BOOKMARK_COLORS.find(b => b.color === color)?.label ?? color}
            style={{
              width: 9, height: 9, borderRadius: '50%',
              backgroundColor: color,
              // No box-shadow/glow per request #2/#3
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
});

// ─── Intersection observer for lazy rendering ─────────────────────────────────
function useInView(ref) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { threshold: 0, rootMargin: '200px' }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return inView;
}

function LazyThumbItem(props) {
  const wrapRef = useRef(null);
  const inView = useInView(wrapRef);
  return (
    <div ref={wrapRef} style={{ minHeight: THUMB_H + 10 }}>
      <ThumbItem {...props} visible={inView} />
    </div>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
export default function ThumbnailSidebar() {
  const [isOpen, setIsOpen]       = useState(false);
  const [activeFilters, setFilters] = useState([]);
  const [isFilterMode, setIsFilterMode] = useState(false); // hides non-matching pages from the 3D book
  const [isToggleHovered, setIsToggleHovered] = useState(false);
  const [isVisibilityHovered, setIsVisibilityHovered] = useState(false);
  const listRef = useRef(null);
  const sidebarWrapperRef = useRef(null);

  const pdfDocument        = useBookStore(s => s.pdfDocument);
  const totalPages         = useBookStore(s => s.totalPages);
  const bookmarks          = useBookStore(s => s.bookmarks);
  const goToPage           = useBookStore(s => s.goToPage);
  const currentSpreadIndex = useBookStore(s => s.currentSpreadIndex);
  const useNativeCover     = useBookStore(s => s.useNativeCover);
  const totalSpreads       = useBookStore(s => s.totalSpreads);
  const isCutMode          = useBookStore(s => s.isCutMode);
  const isPasteMode        = useBookStore(s => s.isPasteMode);
  const setFilteredPages   = useBookStore(s => s.setFilteredPages);

  // Clear the module-level cache whenever a new PDF is opened
  useEffect(() => {
    if (pdfDocument) clearThumbCacheIfNewDoc(pdfDocument);
  }, [pdfDocument]);

  // Approximate current page number from spread index
  const currentPage = useCallback(() => {
    if (currentSpreadIndex === 0) return 1;
    if (currentSpreadIndex >= totalSpreads) return totalPages;
    if (useNativeCover) return Math.max(1, currentSpreadIndex * 2 - 1);
    return currentSpreadIndex === 1 ? 1 : (currentSpreadIndex - 1) * 2;
  }, [currentSpreadIndex, totalSpreads, totalPages, useNativeCover]);

  // Pages to show (filtered or all)
  const visiblePages = activeFilters.length > 0
    ? [...new Set(bookmarks.filter(b => activeFilters.includes(b.color)).map(b => b.pageNumber))].sort((a, b) => a - b)
    : Array.from({ length: totalPages }, (_, i) => i + 1);

  // Unique bookmark colors per page in canonical order
  const getDotsForPage = useCallback((pg) => {
    const present = new Set(bookmarks.filter(b => b.pageNumber === pg).map(b => b.color));
    return BOOKMARK_COLORS.map(c => c.color).filter(c => present.has(c));
  }, [bookmarks]);

  // Scroll active item into view when panel opens or page changes
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const cp = currentPage();
    const el = listRef.current.querySelector(`[data-page="${cp}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isOpen, currentPage]);

  // ── Wheel events are handled by Theatre.jsx via data-no-pan attribute ──────
  // No explicit stopPropagation needed here anymore.

  // ── Publish filteredPages to store whenever filterMode / filters / bookmarks change
  useEffect(() => {
    if (!isFilterMode || activeFilters.length === 0) {
      setFilteredPages(null);
      return;
    }
    const markedPages = new Set(
      bookmarks.filter(b => activeFilters.includes(b.color)).map(b => b.pageNumber)
    );
    setFilteredPages(Array.from(markedPages).sort((a,b) => a - b));
    return () => setFilteredPages(null);
  }, [isFilterMode, activeFilters, bookmarks, setFilteredPages]);

  if (!pdfDocument) return null;

  const cp = currentPage();
  const totalBookmarksCount = bookmarks.length;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        #thumb-list::-webkit-scrollbar { width: 20px; }
        #thumb-list::-webkit-scrollbar-track { background: transparent; }
        #thumb-list::-webkit-scrollbar-thumb { background: rgba(144,110,80,0.55); border: 4px solid rgba(0,0,0,0); background-clip: padding-box; border-radius: 9px; min-height: 80px; }
        #thumb-list::-webkit-scrollbar-thumb:hover { background: rgba(144,110,80,0.9); border: 4px solid rgba(0,0,0,0); background-clip: padding-box; }
        #thumb-list::-webkit-scrollbar-button:single-button { background-color: transparent; display: block; height: 26px; cursor: pointer; }
        #thumb-list::-webkit-scrollbar-button:single-button:vertical:decrement { background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='rgba(144,110,80,0.8)' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='18 15 12 9 6 15'></polyline></svg>"); background-repeat: no-repeat; background-position: center; }
        #thumb-list::-webkit-scrollbar-button:single-button:vertical:increment { background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='rgba(144,110,80,0.8)' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>"); background-repeat: no-repeat; background-position: center; }
      `}</style>

      <div ref={sidebarWrapperRef} data-no-pan="true" onWheel={(e) => e.stopPropagation()}>
        {/* ── Sliding panel ── */}
        <div
          data-no-pan="true"
          style={{
          position: 'fixed',
          top: 0, left: isOpen ? 0 : -SIDEBAR_WIDTH,
          width: SIDEBAR_WIDTH, height: '100vh',
          zIndex: 210, // above HUD bottom container (zIndex 200) to allow scrolling & clicks
          display: 'flex', flexDirection: 'column',
          background: '#1A1615',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          // No box-shadow per request #2
          transition: 'left 0.38s cubic-bezier(0.16,1,0.3,1)',
          pointerEvents: (isOpen && !isCutMode) ? 'auto' : 'none',
          opacity: isCutMode ? 0.5 : 1,
        }}>
          {/* ─ Header: Filter pills ─ */}
          <div style={{ padding: '52px 8px 8px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', alignItems: 'flex-start' }}>

              {/* "All" pill — grey dot only, no text (#4) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 26 }}>
                <button
                  onClick={() => setFilters([])}
                  title="All pages"
                  style={{
                    width: 26, height: 16,
                    borderRadius: 99,
                    border: activeFilters.length === 0 ? '1.5px solid #906E50' : '1.5px solid rgba(255,255,255,0.15)',
                    background: activeFilters.length === 0 ? 'rgba(144,110,80,0.35)' : 'rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  {/* grey dot */}
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    backgroundColor: activeFilters.length === 0 ? '#F0EAE0' : '#6A6059',
                    transition: 'background-color 0.2s',
                  }} />
                </button>
                <span style={{
                  fontSize: 9,
                  color: activeFilters.length === 0 ? '#906E50' : '#8A7F78',
                  fontWeight: activeFilters.length === 0 ? 'bold' : 'normal',
                  height: 12,
                  lineHeight: '12px',
                  fontFamily: 'monospace',
                  userSelect: 'none'
                }}>
                  {totalBookmarksCount > 0 ? totalBookmarksCount : ''}
                </span>
              </div>

              {/* Color pills — dot only, no text (#4), no neon (#3) */}
              {BOOKMARK_COLORS.map(({ id, color, label }) => {
                const isActive = activeFilters.includes(color);
                const count = bookmarks.filter(b => b.color === color).length;
                return (
                  <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 26 }}>
                    <button
                      onClick={() => {
                        setFilters(prev =>
                          prev.includes(color)
                            ? prev.filter(c => c !== color)
                            : [...prev, color]
                        );
                      }}
                      title={label}
                      style={{
                        width: 26, height: 16,
                        borderRadius: 99,
                        border: isActive
                          ? `1.5px solid ${color}`
                          : '1.5px solid rgba(255,255,255,0.12)',
                        background: isActive
                          ? `${color}30`
                          : 'rgba(255,255,255,0.05)',
                        // No box-shadow/glow (#2 & #3)
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0,
                      }}
                    >
                      <div style={{
                        width: 7, height: 7, borderRadius: '50%',
                        backgroundColor: color,
                        opacity: isActive ? 1 : 0.7,
                        transition: 'opacity 0.2s',
                      }} />
                    </button>
                    <span style={{
                      fontSize: 9,
                      color: isActive ? color : '#8A7F78',
                      fontWeight: isActive ? 'bold' : 'normal',
                      height: 12,
                      lineHeight: '12px',
                      fontFamily: 'monospace',
                      userSelect: 'none'
                    }}>
                      {count > 0 ? count : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '9px 4px 4px' }} />
          </div>

          {/* ─ Scrollable list ─ */}
          <div
            id="thumb-list"
            ref={listRef}
            data-no-pan="true"
            style={{
              flex: 1, overflowY: 'auto', overflowX: 'hidden',
              display: 'flex', flexDirection: 'column', gap: 3,
              padding: '0 0 20px',
              opacity: 1,
              pointerEvents: 'auto',
              transition: 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {visiblePages.length === 0 ? (
              <div style={{
                color: '#5A5249', fontSize: 11, textAlign: 'center',
                fontFamily: 'monospace', padding: '28px 16px', letterSpacing: '0.08em',
              }}>
                No bookmarks
              </div>
            ) : visiblePages.map(pg => (
              <LazyThumbItem
                key={pg}
                pdfDoc={pdfDocument}
                pageNumber={pg}
                isActive={pg === cp}
                dots={getDotsForPage(pg)}
                onClick={() => goToPage(pg)}
              />
            ))}
          </div>
        </div>

        {/* ── Arc toggle button — top-left corner (#1) ── */}
        <button
          onClick={() => setIsOpen(o => !o)}
          title={isOpen ? 'Close panel' : 'View all pages'}
          style={{
            position: 'fixed',
            top: 10,              // ← top of the screen (#1)
            left: isOpen ? SIDEBAR_WIDTH - 2 : -1,
            zIndex: 215,          // above HUD widgets
            width: isToggleHovered ? 32 : 28,
            height: 52,
            borderRadius: '0 26px 26px 0',
            background: '#1A1615',
            borderWidth: '1px 1px 1px 0',
            borderStyle: 'solid',
            borderColor: '#2F2B2A',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
            paddingLeft: 2,
            color: '#B8AFA6',
            fontSize: 18, fontWeight: 'bold',
            transition: 'left 0.38s cubic-bezier(0.16,1,0.3,1), width 0.2s cubic-bezier(0.16,1,0.3,1)',
            pointerEvents: !isCutMode ? 'auto' : 'none',
            opacity: isCutMode ? 0.5 : 1,
            userSelect: 'none',
          }}
          onMouseEnter={() => setIsToggleHovered(true)}
          onMouseLeave={() => setIsToggleHovered(false)}
        >
          <div style={{
            width: 22,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            {isOpen ? '‹' : '›'}
          </div>
        </button>

        {/* ── Visibility filter button: hides non-matching pages from the 3D book ── */}
        <button
          onClick={() => setIsFilterMode(v => !v)}
          title={isFilterMode ? 'Show all pages' : 'Hide pages without selected bookmarks'}
          style={{
            position: 'fixed',
            top: 67,
            left: isOpen ? SIDEBAR_WIDTH - 2 : -1,
            zIndex: 215,
            width: isVisibilityHovered ? 32 : 28,
            height: 52,
            borderRadius: '0 26px 26px 0',
            background: '#1A1615',
            borderWidth: '1px 1px 1px 0',
            borderStyle: 'solid',
            borderColor: '#2F2B2A',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
            paddingLeft: 2,
            transition: 'left 0.38s cubic-bezier(0.16,1,0.3,1), width 0.2s cubic-bezier(0.16,1,0.3,1), transform 0.38s cubic-bezier(0.16,1,0.3,1), opacity 0.38s cubic-bezier(0.16,1,0.3,1)',
            pointerEvents: (activeFilters.length > 0 && !isCutMode) ? 'auto' : 'none',
            opacity: activeFilters.length > 0 ? (isCutMode ? 0.5 : 1) : 0,
            transform: activeFilters.length > 0 ? 'translateX(0)' : 'translateX(-100%)',
            userSelect: 'none',
          }}
          onMouseEnter={() => setIsVisibilityHovered(true)}
          onMouseLeave={() => setIsVisibilityHovered(false)}
        >
          <div style={{
            width: 22,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <div style={{
              width: isFilterMode ? 22 : 16,
              height: isFilterMode ? 22 : 16,
              borderRadius: '50%',
              backgroundColor: isFilterMode ? '#906E50' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}>
              {isFilterMode ? (
                <EyeOff size={14} color="#F0EAE0" />
              ) : (
                <Eye size={16} color={isVisibilityHovered ? '#F0EAE0' : '#B8AFA6'} />
              )}
            </div>
          </div>
        </button>
      </div>
    </>
  );
}
