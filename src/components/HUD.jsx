import { useState, useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, X, BookMarked, ChevronLeft, ChevronRight, Download, Scissors,
  ClipboardPaste, Undo, Redo, StickyNote, Highlighter, Pencil, Square, Eraser,
  DraftingCompass, BookA, BookHeart, BadgeInfo, Shrink, TextCursor, ZoomIn, ZoomOut
} from 'lucide-react';
import useBookStore from '../store/useBookStore';
import { exportPdfWithAnnotations, downloadBytes } from '../utils/pdfExporter';
import { clearTextureCache } from '../utils/pdfEngine';

export default function HUD() {
  const currentSpreadIndex = useBookStore(state => state.currentSpreadIndex);
  const totalSpreads = useBookStore(state => state.totalSpreads);
  const isFlipping = useBookStore(state => state.isFlipping);
  const nextSpread = useBookStore(state => state.nextSpread);
  const prevSpread = useBookStore(state => state.prevSpread);
  const closePdf = useBookStore(state => state.closePdf);
  const totalPages = useBookStore(state => state.totalPages);
  const useNativeCover = useBookStore(state => state.useNativeCover);
  const toggleNativeCover = useBookStore(state => state.toggleNativeCover);

  const goToSpread = useBookStore(state => state.goToSpread);
  const goToPage = useBookStore(state => state.goToPage);
  const isBookmarkMode = useBookStore(state => state.isBookmarkMode);
  const toggleBookmarkMode = useBookStore(state => state.toggleBookmarkMode);
  const isTextSelectMode = useBookStore(state => state.isTextSelectMode);
  const toggleTextSelectMode = useBookStore(state => state.toggleTextSelectMode);
  const isHighlightMode = useBookStore(state => state.isHighlightMode);
  const toggleHighlightMode = useBookStore(state => state.toggleHighlightMode);
  const isEraserMode = useBookStore(state => state.isEraserMode);
  const toggleEraserMode = useBookStore(state => state.toggleEraserMode);
  const isCutMode = useBookStore(state => state.isCutMode);
  const isPasteMode = useBookStore(state => state.isPasteMode);
  const removeLastHighlight = useBookStore(state => state.removeLastHighlight);
  const isHighlighterColorMenuOpen = useBookStore(state => state.isHighlighterColorMenuOpen);
  const toggleHighlighterColorMenu = useBookStore(state => state.toggleHighlighterColorMenu);
  const pdfQuality = useBookStore(state => state.pdfQuality);
  const setPdfQuality = useBookStore(state => state.setPdfQuality);
  const highlightColor = useBookStore(state => state.highlightColor);
  const setHighlightColors = useBookStore(state => state.setHighlightColors);
  const isDrawMode = useBookStore(state => state.isDrawMode);
  const toggleDrawMode = useBookStore(state => state.toggleDrawMode);
  const drawColor = useBookStore(state => state.drawColor);
  const setDrawColor = useBookStore(state => state.setDrawColor);
  const drawWidth = useBookStore(state => state.drawWidth);
  const setDrawWidth = useBookStore(state => state.setDrawWidth);
  const isDrawColorMenuOpen = useBookStore(state => state.isDrawColorMenuOpen);
  const toggleDrawColorMenu = useBookStore(state => state.toggleDrawColorMenu);
  
  const isSquareMode       = useBookStore(state => state.isSquareMode);
  const toggleSquareMode   = useBookStore(state => state.toggleSquareMode);
  const isCompassMode      = useBookStore(state => state.isCompassMode);
  const toggleCompassMode  = useBookStore(state => state.toggleCompassMode);

  const undo = useBookStore(state => state.undo);
  const redo = useBookStore(state => state.redo);
  const past = useBookStore(state => state.past);
  const future = useBookStore(state => state.future);
  const triggerFocusCamera = useBookStore(state => state.triggerFocusCamera);

  const [pillHovered, setPillHovered] = useState(false);
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [localQuality, setLocalQuality] = useState(2.0);

  useEffect(() => {
    if (isHelpOpen) {
      setLocalQuality(pdfQuality || 2.0);
    }
  }, [isHelpOpen, pdfQuality]);

  const getQualityText = (q) => {
    if (q === 1.0) return "Low (Fast load)";
    if (q === 1.5) return "Medium";
    if (q === 2.0) return "High (Recommended)";
    if (q === 2.5) return "Very High";
    if (q === 3.0) return "Excellent";
    if (q === 3.5) return "Ultra";
    if (q === 4.0) return "Max (Ultra sharp)";
    return `${q}x`;
  };

  const handleQualityChange = (e) => {
    setLocalQuality(parseFloat(e.target.value));
  };

  const handleQualityRelease = () => {
    if (localQuality !== pdfQuality) {
      setPdfQuality(localQuality);
      clearTextureCache();
    }
  };

  const pdfBytes  = useBookStore(state => state.pdfBytes);
  const postits   = useBookStore(state => state.postits);
  const bookmarks = useBookStore(state => state.bookmarks);
  const draws     = useBookStore(state => state.draws);
  const highlights = useBookStore(state => state.highlights);
  const imageTags = useBookStore(state => state.imageTags);
  const fileName  = useBookStore(state => state.fileName);

  const handleExport = async () => {
    if (isExporting || !pdfBytes) return;
    setIsExporting(true);
    try {
      const bytes = await exportPdfWithAnnotations(pdfBytes, {
        postits, bookmarks, draws, highlights, imageTags, fileName,
      });
      const exportName = fileName.replace(/\.pdf$/i, '') + '_zen.pdf';
      downloadBytes(bytes, exportName);
    } catch (e) {
      console.error('[HUD] Export failed:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const bookmarkColor = useBookStore(state => state.bookmarkColor);
  const setBookmarkColor = useBookStore(state => state.setBookmarkColor);

  // Sync tools menu with global selection mode
  useEffect(() => {
    if (!isTextSelectMode) {
      setIsToolsOpen(false);
    }
  }, [isTextSelectMode]);

  // Determine displayed page number (for the input)
  let numericLabel = 0;
  let label = '';
  let sub = null;

  if (currentSpreadIndex === 0) {
    label = 'Cover';
    numericLabel = 1;
  } else if (currentSpreadIndex === totalSpreads) {
    label = 'Back Cover';
    numericLabel = totalPages;
  } else if (useNativeCover) {
    const rawP1 = currentSpreadIndex * 2 - 1;
    const rawP2 = currentSpreadIndex * 2;
    const p1 = rawP1 >= 2 ? rawP1 : null;
    const p2 = Math.min(rawP2, totalPages - 1);
    numericLabel = p1 || p2;
    if (p1 && p1 <= totalPages - 1) {
      label = p1 === p2 ? `${p1}` : `${p1}–${p2}`;
    } else {
      label = (p2 >= 2 && p2 <= totalPages - 1) ? `${p2}` : '–';
    }
    sub = `/ ${totalPages}`;
  } else {
    if (currentSpreadIndex === 1) {
      label = '1';
      numericLabel = 1;
    } else {
      const p1 = (currentSpreadIndex - 1) * 2;
      const p2 = Math.min(currentSpreadIndex * 2 - 1, totalPages);
      numericLabel = p1;
      if (p1 > totalPages) label = '–';
      else label = p1 === p2 ? `${p1}` : `${p1}–${p2}`;
    }
    sub = `/ ${totalPages}`;
  }

  const atStart = currentSpreadIndex <= 0;
  const atEnd = currentSpreadIndex >= totalSpreads;

  const handlePageSubmit = (e) => {
    e?.preventDefault();
    const val = parseInt(editValue, 10);
    if (!isNaN(val)) {
      goToPage(val);
    }
    setIsEditingPage(false);
  };

  const btnStyle = (disabled) => ({
    width: 48, height: 48,
    background: 'transparent', border: 'none',
    color: disabled ? 'rgba(232,221,213,0.3)' : '#C6C1B9',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  });

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=range]::-webkit-slider-runnable-track {
          background: #2C2826;
          height: 6px;
          border-radius: 3px;
          border: 1px solid rgba(232, 221, 213, 0.1);
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: #906E50;
          margin-top: -4px;
          box-shadow: 0 0 10px rgba(0,0,0,0.2);
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        input[type=range]:hover::-webkit-slider-thumb {
          transform: scale(1.4);
        }
        input[type=range]:focus {
          outline: none;
        }
        .help-tutorial-list::-webkit-scrollbar {
          width: 14px;
        }
        .help-tutorial-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .help-tutorial-list::-webkit-scrollbar-thumb {
          background: rgba(144,110,80,0.45);
          border: 3px solid rgba(0,0,0,0);
          background-clip: padding-box;
          border-radius: 9px;
          min-height: 40px;
        }
        .help-tutorial-list::-webkit-scrollbar-thumb:hover {
          background: rgba(144,110,80,0.85);
          border: 3px solid rgba(0,0,0,0);
          background-clip: padding-box;
        }
        .help-tutorial-list::-webkit-scrollbar-button:single-button {
          background-color: transparent;
          display: block;
          height: 16px;
          cursor: pointer;
        }
        .help-tutorial-list::-webkit-scrollbar-button:single-button:vertical:decrement {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(144,110,80,0.8)' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='18 15 12 9 6 15'></polyline></svg>");
          background-repeat: no-repeat;
          background-position: center;
        }
        .help-tutorial-list::-webkit-scrollbar-button:single-button:vertical:increment {
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(144,110,80,0.8)' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>");
          background-repeat: no-repeat;
          background-position: center;
        }
      `}</style>



      {/* Export button — left of close */}
      <button
        onClick={() => setIsDownloadModalOpen(true)}
        disabled={isExporting || !pdfBytes}
        title={isExporting ? 'Exporting...' : 'Download PDF with annotations'}
        style={{
          position: 'fixed', top: 14, right: 80, zIndex: 200,
          width: 40, height: 40, borderRadius: '50%',
          background: isExporting ? '#906E50' : '#F0EAE0',
          color: '#5E6056',
          border: '2px solid rgba(38, 34, 33, 0.8)',
          cursor: isExporting ? 'wait' : (!pdfBytes ? 'not-allowed' : 'pointer'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
          pointerEvents: 'auto',
          opacity: !pdfBytes ? 0.4 : 1,
        }}
        onMouseEnter={e => { if (!isExporting && pdfBytes) e.currentTarget.style.background = '#a89f94'; }}
        onMouseLeave={e => { if (!isExporting) e.currentTarget.style.background = '#F0EAE0'; }}
      >
        {isExporting
          ? <div style={{ width: 16, height: 16, border: '2px solid #F0EAE0', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          : <Download size={17} color="#5E6056" />
        }
      </button>

      {/* Close button */}
      <button
        onClick={closePdf}
        title="Go back to home"
        style={{
          position: 'fixed', top: 14, right: 32, zIndex: 200,
          width: 40, height: 40, borderRadius: '50%',
          background: '#F0EAE0', color: '#5E6056',
          border: '2px solid rgba(38, 34, 33, 0.8)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'none',
          transition: 'background 0.15s',
          pointerEvents: 'auto',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#a89f94'}
        onMouseLeave={e => e.currentTarget.style.background = '#F0EAE0'}
      >
        <X size={18} />
      </button>

      {/* Help button */}
      <button
        onClick={() => setIsHelpOpen(true)}
        title="Tutorial / Help"
        style={{
          position: 'fixed', top: 14, right: 128, zIndex: 200,
          width: 40, height: 40, borderRadius: '50%',
          background: '#F0EAE0', color: '#5E6056',
          border: '2px solid rgba(38, 34, 33, 0.8)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'none',
          transition: 'background 0.15s',
          pointerEvents: 'auto',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#a89f94'}
        onMouseLeave={e => e.currentTarget.style.background = '#F0EAE0'}
      >
        <BadgeInfo size={20} color="#5E6056" />
      </button>

      {/* Undo, Redo, Focus Stack */}
      <div style={{
        position: 'fixed', top: 70, right: 32, zIndex: 200,
        display: 'flex', flexDirection: 'column', gap: 11,
        pointerEvents: 'none'
      }}>
        <button
          onClick={undo}
          disabled={past.length === 0}
          title="Undo"
          style={{
            width: 40, height: 40, borderRadius: '50%', background: '#F0EAE0',
            border: '2px solid rgba(38, 34, 33, 0.8)',
            cursor: past.length === 0 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'none', transition: 'background 0.15s', pointerEvents: 'auto',
            opacity: past.length === 0 ? 0.5 : 1
          }}
          onMouseEnter={e => { if (past.length > 0) e.currentTarget.style.background = '#a89f94'; }}
          onMouseLeave={e => { if (past.length > 0) e.currentTarget.style.background = '#F0EAE0'; }}
        >
          <Undo size={20} color="#5E6056" />
        </button>

        <button
          onClick={redo}
          disabled={future.length === 0}
          title="Redo"
          style={{
            width: 40, height: 40, borderRadius: '50%', background: '#F0EAE0',
            border: '2px solid rgba(38, 34, 33, 0.8)',
            cursor: future.length === 0 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'none', transition: 'background 0.15s', pointerEvents: 'auto',
            opacity: future.length === 0 ? 0.5 : 1
          }}
          onMouseEnter={e => { if (future.length > 0) e.currentTarget.style.background = '#a89f94'; }}
          onMouseLeave={e => { if (future.length > 0) e.currentTarget.style.background = '#F0EAE0'; }}
        >
          <Redo size={20} color="#5E6056" />
        </button>

        <button
          onClick={triggerFocusCamera}
          title="Focus Camera"
          style={{
            width: 40, height: 40, borderRadius: '50%', background: '#F0EAE0',
            border: '2px solid rgba(38, 34, 33, 0.8)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'none', transition: 'background 0.15s', pointerEvents: 'auto',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#a89f94'}
          onMouseLeave={e => e.currentTarget.style.background = '#F0EAE0'}
        >
          <Shrink size={20} color="#5E6056" />
        </button>

        <button
          onClick={useBookStore.getState().triggerZoomIn}
          title="Zoom In"
          style={{
            width: 40, height: 40, borderRadius: '50%', background: '#F0EAE0',
            border: '2px solid rgba(38, 34, 33, 0.8)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'none', transition: 'background 0.15s', pointerEvents: 'auto',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#a89f94'}
          onMouseLeave={e => e.currentTarget.style.background = '#F0EAE0'}
        >
          <ZoomIn size={20} color="#5E6056" />
        </button>

        <button
          onClick={useBookStore.getState().triggerZoomOut}
          title="Zoom Out"
          style={{
            width: 40, height: 40, borderRadius: '50%', background: '#F0EAE0',
            border: '2px solid rgba(38, 34, 33, 0.8)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'none', transition: 'background 0.15s', pointerEvents: 'auto',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#a89f94'}
          onMouseLeave={e => e.currentTarget.style.background = '#F0EAE0'}
        >
          <ZoomOut size={20} color="#5E6056" />
        </button>
      </div>

      {/* Native Cover Toggle */}
      <button
        onClick={toggleNativeCover}
        title={useNativeCover ? 'Use generated cover' : 'Use PDF cover'}
        style={{
          position: 'fixed', top: 223, right: 32, zIndex: 200,
          width: 40, height: 40, borderRadius: '50%',
          background: useNativeCover ? '#906E50' : '#F0EAE0',
          border: '2px solid rgba(38, 34, 33, 0.8)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'none',
          transition: 'all 0.2s',
          pointerEvents: 'auto',
          padding: 0,
        }}
        onMouseEnter={e => {
          if (!useNativeCover) e.currentTarget.style.background = '#a89f94';
        }}
        onMouseLeave={e => {
          if (!useNativeCover) e.currentTarget.style.background = '#F0EAE0';
        }}
      >
        {useNativeCover ? (
          <BookHeart size={20} color="#F0EAE0" />
        ) : (
          <BookA size={20} color="#5E6056" />
        )}
      </button>

      {/* Bookmarks Section */}
      <div style={{
        position: 'fixed', top: 266,
        right: 24,
        height: 56,
        zIndex: 200,
        display: 'flex', flexDirection: 'row-reverse', alignItems: 'center',
        padding: '0 8px',
        background: isBookmarkMode ? 'rgba(50, 40, 35, 0.9)' : 'transparent',
        borderRadius: 28,
        boxShadow: 'none',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'auto'
      }}>
        {/* Main Bookmark Toggle */}
        <button
          onClick={() => {
            toggleBookmarkMode();
            useBookStore.setState({ isPostitMenuOpen: false });
            setIsToolsOpen(false);
          }}
          title={isBookmarkMode ? 'Deactivate Bookmarks Mode' : 'Activate Bookmarks Mode'}
          style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: isBookmarkMode ? '#906E50' : '#F0EAE0',
            color: isBookmarkMode ? '#FFFFFF' : '#5E6056',
            border: '2px solid rgba(38, 34, 33, 0.8)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'none',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            if (!isBookmarkMode) e.currentTarget.style.background = '#a89f94';
          }}
          onMouseLeave={e => {
            if (!isBookmarkMode) e.currentTarget.style.background = '#F0EAE0';
          }}
        >
          <BookMarked size={18} />
        </button>

        {/* Sub-menu Tools for Bookmarks */}
        <div style={{
          display: 'flex', flexDirection: 'row-reverse', gap: 8,

          // Animation Logic
          maxWidth: isBookmarkMode ? '300px' : '0',
          opacity: isBookmarkMode ? 1 : 0,
          marginRight: isBookmarkMode ? 8 : 0,
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
          pointerEvents: isBookmarkMode ? 'auto' : 'none',
        }}>
          {[
            { id: 'orange', color: '#f59e42', hoverColor: '#d98734', title: 'Orange Bookmark' },
            { id: 'green', color: '#49e372', hoverColor: '#3bc25e', title: 'Green Bookmark' },
            { id: 'blue', color: '#49a5e3', hoverColor: '#3b8dc4', title: 'Blue Bookmark' },
            { id: 'pink', color: '#e3499e', hoverColor: '#c73887', title: 'Pink Bookmark' },
          ].map((tool) => {
            const isActive = bookmarkColor === tool.color;
            return (
              <button
                key={tool.id}
                onClick={() => setBookmarkColor(tool.color)}
                title={tool.title}
                style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: tool.color,
                  border: `3px solid ${isActive ? '#906E50' : '#F0EAE0'}`,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s, border-color 0.2s',
                  boxShadow: 'none',
                  padding: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = tool.hoverColor;
                  if (!isActive) e.currentTarget.style.borderColor = '#a89f94';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = tool.color;
                  if (!isActive) e.currentTarget.style.borderColor = '#F0EAE0';
                }}
                onMouseDown={e => {
                  e.currentTarget.style.borderColor = '#906E50';
                }}
                onMouseUp={e => {
                  if (!isActive) e.currentTarget.style.borderColor = '#a89f94';
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Post-it Menu Section */}
      <div style={{
        position: 'fixed', top: 317, right: 24, height: 56, zIndex: 200,
        display: 'flex', flexDirection: 'row-reverse', alignItems: 'center',
        padding: '0 8px',
        background: useBookStore(state => state.isPostitMenuOpen) ? 'rgba(50, 40, 35, 0.9)' : 'transparent',
        borderRadius: 28, transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'auto'
      }}>
        {/* Main Postit Menu Toggle */}
        <button
          onClick={() => {
            useBookStore.getState().togglePostitMode();
            setIsToolsOpen(false); // Close Text tools menu if open
          }}
          title="Add Sticky Note"
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: useBookStore(state => state.isPostitMode) ? '#906E50' : '#F0EAE0',
            border: '2px solid rgba(38, 34, 33, 0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => {
            if (!useBookStore.getState().isPostitMode) e.currentTarget.style.background = '#a89f94';
          }}
          onMouseLeave={e => {
            if (!useBookStore.getState().isPostitMode) e.currentTarget.style.background = '#F0EAE0';
          }}
        >
          <StickyNote size={20} color={useBookStore(state => state.isPostitMode) ? '#FFFFFF' : '#5E6056'} />
        </button>

        {/* Sub-menu Tools for Postit */}
        <div style={{
          display: 'flex', flexDirection: 'row-reverse', gap: 8,
          maxWidth: useBookStore(state => state.isPostitMenuOpen) ? '300px' : '0',
          opacity: useBookStore(state => state.isPostitMenuOpen) ? 1 : 0,
          marginRight: useBookStore(state => state.isPostitMenuOpen) ? 8 : 0,
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
          pointerEvents: useBookStore(state => state.isPostitMenuOpen) ? 'auto' : 'none',
        }}>
          {/* Cut/Paste Tool */}
          <button
            onClick={() => {
              const state = useBookStore.getState();
              if (state.cutImage) {
                state.togglePasteMode();
              } else {
                state.toggleCutMode();
              }
            }}
            title={useBookStore(state => state.cutImage) ? "Paste Cutout" : "Cut"}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: useBookStore(state => state.isCutMode || state.isPasteMode) ? '#906E50' : 'transparent',
              color: useBookStore(state => state.isCutMode || state.isPasteMode) ? '#F0EAE0' : '#C6C1B9',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (!useBookStore.getState().isCutMode && !useBookStore.getState().isPasteMode) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
            onMouseLeave={e => { if (!useBookStore.getState().isCutMode && !useBookStore.getState().isPasteMode) e.currentTarget.style.background = 'transparent'; }}
          >
            {useBookStore(state => state.cutImage) ? <ClipboardPaste size={18} /> : <Scissors size={18} />}
          </button>
        </div>
      </div>

      {/* Highlighter Sub-menu — independent fixed pill, matches bookmark bar design */}
      {/* Appears to the LEFT of the tools column when highlight mode is active     */}
      <div style={{
        position: 'fixed',
        top: 424,
        right: 88,
        height: 40,
        zIndex: 200,
        display: 'flex', flexDirection: 'row-reverse', alignItems: 'center',
        padding: '0 8px',
        background: (isHighlightMode && isToolsOpen) ? 'rgba(50, 40, 35, 0.9)' : 'transparent',
        borderRadius: 20,
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: (isHighlightMode && isToolsOpen) ? 'auto' : 'none',
        opacity: (isHighlightMode && isToolsOpen) ? 1 : 0,
      }}>
        {/* Horizontal Sub-menu: Animated container for smooth slide effect */}
        <div style={{
          display: 'flex', flexDirection: 'row-reverse', alignItems: 'center',
          pointerEvents: (isHighlightMode && isToolsOpen) ? 'auto' : 'none',
        }}>
          {/* 1. The Trigger button (<) — shrinks when palette opens */}
          <div style={{
            maxWidth: (!isHighlighterColorMenuOpen && isHighlightMode && isToolsOpen) ? '40px' : '0',
            opacity: (!isHighlighterColorMenuOpen && isHighlightMode && isToolsOpen) ? 1 : 0,
            overflow: 'hidden',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            display: 'flex', alignItems: 'center'
          }}>
            <button
              onClick={toggleHighlighterColorMenu}
              title="Color Palette"
              style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: 'transparent', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#C6C1B9', transition: 'background 0.2s',
                marginRight: 8,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <ChevronLeft size={14} />
            </button>
          </div>

          {/* 2. The Color Palette — expands when active */}
          <div style={{
            display: 'flex', flexDirection: 'row-reverse', gap: 8, alignItems: 'center',
            maxWidth: (isHighlighterColorMenuOpen && isHighlightMode && isToolsOpen) ? '400px' : '0',
            opacity: (isHighlighterColorMenuOpen && isHighlightMode && isToolsOpen) ? 1 : 0,
            marginRight: (isHighlighterColorMenuOpen && isHighlightMode && isToolsOpen) ? 8 : 0,
            overflow: 'hidden',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {[
              { id: 'yellow',  effective: '#ffea0875', preview: '#ffea087a', display: '#ffea08', title: 'Yellow' },
              { id: 'green',   effective: '#009d1575', preview: '#00741970', display: '#66BB6A', title: 'Green' },
              { id: 'cyan',    effective: '#0091ff70', preview: '#0091ff70', display: '#29B6F6', title: 'Cyan' },
              { id: 'magenta', effective: '#ff00886e', preview: '#ff00886e', display: '#EC407A', title: 'Magenta' },
            ].map((tool) => {
              const isActive = highlightColor === tool.effective;
              return (
                <button
                  key={tool.id}
                  onClick={() => setHighlightColors(tool.effective, tool.preview)}
                  title={tool.title}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: tool.display,
                    border: `2px solid ${isActive ? '#906E50' : 'rgba(255,255,255,0.2)'}`,
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: isActive ? '0 0 8px rgba(0,0,0,0.4)' : 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.8)';
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                  }}
                />
              );
            })}

            {/* Right Arrow to close the palette */}
            <button
              onClick={toggleHighlighterColorMenu}
              title="Close palette"
              style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: 'transparent', color: '#8A7F78',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Style Sub-menu (for Draw, Square, Compass) */}
      {(() => {
        const anyShapeMode = isDrawMode || isSquareMode || isCompassMode;
        if (!anyShapeMode) return null;

        // Calculate dynamic position based on active tool
        let pillTop = 472; // Draw
        if (isSquareMode) pillTop = 520;
        if (isCompassMode) pillTop = 568;

        return (
          <>
            <div style={{
              position: 'fixed',
              top: pillTop,
              right: 88,
              height: 40,
              zIndex: 200,
              display: 'flex', flexDirection: 'row-reverse', alignItems: 'center',
              padding: '0 8px',
              background: (anyShapeMode && isToolsOpen) ? 'rgba(50, 40, 35, 0.9)' : 'transparent',
              borderRadius: 20,
              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: (anyShapeMode && isToolsOpen) ? 'auto' : 'none',
              opacity: (anyShapeMode && isToolsOpen) ? 1 : 0,
            }}>
              <div style={{ display: 'flex', flexDirection: 'row-reverse', alignItems: 'center',
                pointerEvents: (anyShapeMode && isToolsOpen) ? 'auto' : 'none' }}>

                {/* Trigger < button */}
                <div style={{
                  maxWidth: (!isDrawColorMenuOpen && isToolsOpen) ? '40px' : '0',
                  opacity: (!isDrawColorMenuOpen && isToolsOpen) ? 1 : 0,
                  overflow: 'hidden',
                  transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex', alignItems: 'center'
                }}>
                  <button onClick={toggleDrawColorMenu} title="Color Palette"
                    style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#C6C1B9', transition: 'background 0.2s', marginRight: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <ChevronLeft size={14} />
                  </button>
                </div>

                {/* Color Palette — 4 opaque colors */}
                <div style={{
                  display: 'flex', flexDirection: 'row-reverse', gap: 8, alignItems: 'center',
                  maxWidth: (isDrawColorMenuOpen && isToolsOpen) ? '400px' : '0',
                  opacity: (isDrawColorMenuOpen && isToolsOpen) ? 1 : 0,
                  marginRight: (isDrawColorMenuOpen && isToolsOpen) ? 8 : 0,
                  overflow: 'hidden',
                  transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                }}>
                  {[
                    { id: 'yellow',  color: '#ffea08', display: '#ffea08', title: 'Yellow' },
                    { id: 'green',   color: '#00943b', display: '#00943b', title: 'Green' },
                    { id: 'cyan',    color: '#3b62ff', display: '#3b62ff', title: 'Cyan' },
                    { id: 'magenta', color: '#de0038', display: '#de0038', title: 'Magenta' },
                  ].map((tool) => {
                    const isActive = drawColor === tool.color;
                    return (
                      <button key={tool.id} onClick={() => setDrawColor(tool.color)} title={tool.title}
                        style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          backgroundColor: tool.display,
                          border: `2px solid ${isActive ? '#906E50' : 'rgba(255,255,255,0.2)'}`,
                          cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: isActive ? '0 0 8px rgba(0,0,0,0.4)' : 'none',
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.8)'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                      />
                    );
                  })}
                  <button onClick={toggleDrawColorMenu} title="Close palette"
                    style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: 'transparent', color: '#8A7F78', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Thickness Slider — appears below the active color palette */}
            <div style={{
              position: 'fixed',
              top: pillTop + 45,
              right: 88,
              width: 178,
              zIndex: 200,
              display: 'flex', alignItems: 'center',
              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: (anyShapeMode && isDrawColorMenuOpen && isToolsOpen) ? 'auto' : 'none',
              opacity: (anyShapeMode && isDrawColorMenuOpen && isToolsOpen) ? 1 : 0,
              transform: (anyShapeMode && isDrawColorMenuOpen && isToolsOpen) ? 'translateX(0)' : 'translateX(10px)',
            }}>
              <input
                type="range"
                min="0.001"
                max="0.06"
                step="0.001"
                value={drawWidth}
                onChange={(e) => setDrawWidth(parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', appearance: 'none', background: 'transparent' }}
              />
            </div>
          </>
        );
      })()}

      {/* Tools Section */}
      <div style={{
        position: 'fixed', top: 368,
        right: 24,
        width: 56,
        zIndex: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '8px 0',
        background: isToolsOpen ? 'rgba(50, 40, 35, 0.9)' : 'transparent',
        borderRadius: 28,
        boxShadow: 'none',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'auto'
      }}>
        {/* Main Text Select Toggle */}
        <button
          onClick={() => {
            setIsToolsOpen(!isToolsOpen);
            toggleTextSelectMode();
            useBookStore.setState({ isPostitMenuOpen: false }); // Close Postit menu if open
          }}
          title={isTextSelectMode ? "Deactivate Selection" : "Activate Selection"}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: (isToolsOpen || isTextSelectMode) ? '#906E50' : '#F0EAE0',
            border: '2px solid rgba(38, 34, 33, 0.8)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'none',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            if (!isToolsOpen && !isTextSelectMode) e.currentTarget.style.background = '#a89f94';
          }}
          onMouseLeave={e => {
            if (!isToolsOpen && !isTextSelectMode) e.currentTarget.style.background = '#F0EAE0';
          }}
        >
          <TextCursor size={20} color={(isToolsOpen || isTextSelectMode) ? '#F0EAE0' : '#5E6056'} />
        </button>

        {/* Sub-menu Tools */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          maxHeight: isToolsOpen ? '300px' : '0',
          opacity: isToolsOpen ? 1 : 0,
          marginTop: isToolsOpen ? 8 : 0,
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
          pointerEvents: isToolsOpen ? 'auto' : 'none',
        }}>
          {[
            { id: 'highlighter', icon: Highlighter, title: 'Highlighter', action: toggleHighlightMode, active: isHighlightMode },
            { id: 'draw', icon: Pencil, title: 'Draw', action: toggleDrawMode, active: isDrawMode },
            { id: 'square', icon: Square, title: 'Square', action: toggleSquareMode, active: isSquareMode },
            { id: 'compass', icon: DraftingCompass, title: 'Compass', action: toggleCompassMode, active: isCompassMode },
            { id: 'eraser', icon: Eraser, title: 'Eraser', action: toggleEraserMode, active: isEraserMode },
          ].map((tool) => {
            const isActive = tool.active !== undefined ? tool.active : activeTool === tool.id;
            const handleClick = tool.action ? tool.action : () => setActiveTool(isActive ? null : tool.id);
            const ToolIcon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={handleClick}
                title={tool.title}
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: isActive ? '#906E50' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <ToolIcon size={20} color={isActive ? '#F0EAE0' : '#C6C1B9'} />
              </button>
            );
          })}
        </div>
      </div>

      <div
        onMouseEnter={() => setPillHovered(true)}
        onMouseLeave={() => setPillHovered(false)}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, // extend to bottom 0
          height: 120, // fixed height for the hot zone
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
          paddingBottom: 22,
          gap: 12,
          pointerEvents: (isTextSelectMode || isCutMode) ? 'none' : 'auto', // active hot zone
        }}
      >

        <div
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%',
            opacity: (isTextSelectMode || isCutMode) ? 0 : 1, transition: 'opacity 0.3s ease',
            pointerEvents: (isTextSelectMode || isCutMode) ? 'none' : 'auto'
          }}
        >
          {/* Scrubber Slider */}
          <div style={{
            width: '30%', minWidth: 200, maxWidth: 600,
            opacity: pillHovered ? 1 : 0.4, transform: pillHovered ? 'translateY(0)' : 'translateY(10px)',
            transition: 'all 0.4s ease',
          }}>
            <input
              type="range"
              min={0}
              max={totalSpreads}
              step={1}
              value={currentSpreadIndex}
              onChange={(e) => goToSpread(parseInt(e.target.value, 10))}
              style={{ width: '100%', cursor: 'pointer', appearance: 'none', background: 'transparent' }}
            />
          </div>

          {/* Main Pill */}
          <div
            style={{
              display: 'inline-flex', alignItems: 'center',
              background: '#2C2826',
              borderRadius: 9999,
              boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
              overflow: 'hidden',
              opacity: pillHovered ? 1 : 0.4,
              transition: 'opacity 0.5s ease',
            }}
          >
            {/* Left button */}
            <button
              onClick={prevSpread}
              disabled={atStart}
              style={btnStyle(atStart)}
            >
              <ArrowLeft size={18} />
            </button>

            <div style={{ width: 1, height: 20, background: '#4A4440', flexShrink: 0 }} />

            {/* Page label / Input */}
            <div
              style={{
                display: 'flex', alignItems: 'baseline', gap: 6,
                padding: '0 20px', minWidth: 110, justifyContent: 'center',
                cursor: 'text'
              }}
              onClick={() => {
                if (!isEditingPage) {
                  setEditValue(numericLabel.toString());
                  setIsEditingPage(true);
                }
              }}
            >
              {isEditingPage ? (
                <form onSubmit={handlePageSubmit}>
                  <input
                    autoFocus
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handlePageSubmit}
                    style={{
                      background: 'transparent', border: 'none', outline: 'none',
                      color: '#C6C1B9', fontFamily: 'Georgia, serif', fontSize: 14,
                      width: 40, textAlign: 'center'
                    }}
                  />
                </form>
              ) : (
                <span style={{
                  fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 500, color: '#C6C1B9',
                  userSelect: 'none'
                }}>
                  {label}
                </span>
              )}

              {sub && (
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#8A7F78', userSelect: 'none' }}>
                  {sub}
                </span>
              )}
            </div>

            <div style={{ width: 1, height: 20, background: '#4A4440', flexShrink: 0 }} />

            {/* Right button */}
            <button
              onClick={nextSpread}
              disabled={atEnd}
              style={btnStyle(atEnd)}
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
      {/* Help Modal */}
      {isHelpOpen && (
        <div
          data-no-pan="true"
          onWheel={(e) => e.stopPropagation()}
          style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(28, 26, 25, 0.8)', backdropFilter: 'blur(8px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto'
        }}>
          <div style={{
            background: '#F0EAE0', padding: '32px 40px', borderRadius: 24,
            width: '95%', maxWidth: 660, minHeight: '660px',
            color: '#3A3633', fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#2C2826' }}>Reader Tutorial</h2>
                <button
                  onClick={() => setIsHelpOpen(false)}
                  style={{ 
                    background: 'transparent', border: 'none', cursor: 'pointer', color: '#5E6056',
                    transition: 'color 0.2s, transform 0.2s', padding: 4, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#E53935'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#5E6056'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <X size={20} />
                </button>
              </div>
              
              <p style={{ fontSize: 14, lineHeight: 1.4, marginBottom: 16, color: '#5E6056' }}>
                Welcome to Zen 3D Web Reader! Drag pages with your left-click to turn them, or <strong>right-click and drag to pan/move the view</strong>. Here's a quick guide to understanding the toolbar features:
              </p>

              {/* Scrollable list of instructions to keep it very neat */}
              <div className="help-tutorial-list" data-no-pan="true" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '310px', overflowY: 'auto', paddingRight: 8 }}>
                
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, flexShrink: 0, background: '#906E50', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TextCursor size={16} color="#F0EAE0" />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: 14 }}>Text Selection</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#5E6056' }}>Click and drag over text on the page to copy it. Page turning and dragging are disabled while this mode is active.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, flexShrink: 0, background: '#906E50', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Highlighter size={16} color="#F0EAE0" />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: 14 }}>Highlighter</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#5E6056' }}>Highlight text directly on the page. Use the dot next to it to change the marker color.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, flexShrink: 0, background: '#906E50', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Pencil size={14} color="#F0EAE0" />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: 14 }}>Pencil & Geometry Tools</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#5E6056' }}>Freehand draw using the pencil, or use the Square / Compass tools to draw perfect shapes.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, flexShrink: 0, background: '#906E50', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Scissors size={16} color="#F0EAE0" />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: 14 }}>Cut Tool</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#5E6056' }}>Drag a rectangle over the page to "cut" an image from it. This image is stored in your clipboard.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, flexShrink: 0, background: '#906E50', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ClipboardPaste size={16} color="#F0EAE0" />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: 14 }}>Paste Tool</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#5E6056' }}>Click anywhere on the book to paste your previously cut image as a floating label.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, flexShrink: 0, background: '#906E50', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookMarked size={16} color="#F0EAE0" />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: 14 }}>Bookmarks</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#5E6056' }}>Place color-coded bookmarks on page edges to organize sections. You can filter and choose which pages to display using the sidebar.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, flexShrink: 0, background: '#906E50', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <StickyNote size={16} color="#F0EAE0" />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: 14 }}>Sticky Notes</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#5E6056' }}>Place editable 3D notes anywhere. You can write on notes, drag them, and rotate them freely.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, flexShrink: 0, background: '#906E50', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Download size={16} color="#F0EAE0" />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: 14 }}>Export & Compatibility</h3>
                    <p style={{ margin: 0, fontSize: 13, color: '#5E6056' }}>Download your annotated PDF. Standard elements (highlights, draws) show up in any PDF viewer. Dynamic tools (notes, bookmarks, image cutouts) are saved in a hidden file embedded in the PDF, restoring perfectly when re-imported here.</p>
                  </div>
                </div>

              </div>
            </div>

            {/* First Separator Line (borderTop) & Quality Slider */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#2C2826' }}>
                    PDF Rendering Quality
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#906E50', background: 'rgba(144, 110, 80, 0.1)', padding: '2px 10px', borderRadius: 12 }}>
                    {getQualityText(localQuality)}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#8A7F78', lineHeight: 1.35 }}>
                  Adjust the sharpness of PDF text and images on 3D pages. Higher values improve readability when zooming but increase memory and CPU usage.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#8A7F78', fontWeight: 500 }}>Low</span>
                  <input
                    type="range"
                    min="1.0"
                    max="4.0"
                    step="0.5"
                    value={localQuality}
                    onChange={handleQualityChange}
                    onPointerUp={handleQualityRelease}
                    style={{ flex: 1, cursor: 'pointer', appearance: 'none', background: 'transparent' }}
                  />
                  <span style={{ fontSize: 12, color: '#8A7F78', fontWeight: 500 }}>Max</span>
                </div>
              </div>
            </div>

            {/* Second Separator Line & Got it Button */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.1)', textAlign: 'center' }}>
              <button 
                onClick={() => setIsHelpOpen(false)}
                style={{ 
                  background: '#2C2826', color: '#F0EAE0', border: 'none', padding: '10px 32px', borderRadius: 30, 
                  fontSize: 14, cursor: 'pointer', fontWeight: 500, transition: 'background 0.2s, transform 0.2s' 
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#4A4340'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2C2826'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Confirmation Modal */}
      {isDownloadModalOpen && (
        <div
          data-no-pan="true"
          onWheel={(e) => e.stopPropagation()}
          style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(28, 26, 25, 0.8)', backdropFilter: 'blur(8px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto'
        }}>
          <div style={{
            background: '#F0EAE0', padding: '32px 40px', borderRadius: 24,
            width: '95%', maxWidth: 520,
            color: '#3A3633', fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
            display: 'flex', flexDirection: 'column',
            gap: 20
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#2C2826', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Download size={22} color="#906E50" />
                  Export & Compatibility
                </h2>
                <button
                  onClick={() => setIsDownloadModalOpen(false)}
                  style={{ 
                    background: 'transparent', border: 'none', cursor: 'pointer', color: '#5E6056',
                    transition: 'color 0.2s, transform 0.2s', padding: 4, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#E53935'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#5E6056'; e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <X size={20} />
                </button>
              </div>
              
              <p style={{ fontSize: 14, lineHeight: 1.5, color: '#5E6056', margin: '12px 0 0 0' }}>
                Download your annotated PDF. Standard elements (highlights, draws) show up in any PDF viewer. Dynamic tools (notes, bookmarks, image cutouts) are saved in a hidden file embedded in the PDF, restoring perfectly when re-imported here.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 16 }}>
              <button 
                onClick={() => setIsDownloadModalOpen(false)}
                style={{ 
                  background: 'transparent', color: '#5E6056', border: '1px solid rgba(94, 96, 86, 0.4)', padding: '10px 24px', borderRadius: 30, 
                  fontSize: 14, cursor: 'pointer', fontWeight: 500, transition: 'background 0.2s, color 0.2s' 
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(94, 96, 86, 0.08)'; e.currentTarget.style.color = '#2C2826'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#5E6056'; }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setIsDownloadModalOpen(false);
                  handleExport();
                }}
                style={{ 
                  background: '#2C2826', color: '#F0EAE0', border: 'none', padding: '10px 32px', borderRadius: 30, 
                  fontSize: 14, cursor: 'pointer', fontWeight: 500, transition: 'background 0.2s, transform 0.2s' 
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#4A4340'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2C2826'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
