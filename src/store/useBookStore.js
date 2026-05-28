import { create } from 'zustand';

// Pre-defined elegant combinations of Cover & Text color using the muted boho palette
const colorPool = [
  // Original 10
  { cover: "#F2E9E4", text: "#4A4E69" },
  { cover: "#D1BBAA", text: "#22223B" },
  { cover: "#22223B", text: "#C9ADA7" },
  { cover: "#5E6056", text: "#E2D1C3" },
  { cover: "#4A4E69", text: "#F2E9E4" },
  { cover: "#8E9775", text: "#22223B" },
  { cover: "#906E50", text: "#F2E9E4" },
  { cover: "#C9ADA7", text: "#4A4E69" },
  { cover: "#9A8C98", text: "#22223B" },
  { cover: "#6D5959", text: "#E2D1C3" },
  // 15 New Premium Additions
  { cover: "#2D4238", text: "#E8D8B0" }, // Deep Forest & Pale Gold
  { cover: "#DCA74B", text: "#2A2A2A" }, // Mustard & Charcoal
  { cover: "#B85C38", text: "#F3EFE0" }, // Burnt Orange & Ivory
  { cover: "#5C6B73", text: "#E0E0E0" }, // Slate Grey & Warm White
  { cover: "#C87965", text: "#F4F1DE" }, // Terracotta & Soft Sand
  { cover: "#A5B5C1", text: "#1D2D44" }, // Dusty Blue & Navy
  { cover: "#3E3636", text: "#D6CFC7" }, // Dark Mocha & Oat
  { cover: "#6B705C", text: "#FBF8CC" }, // Olive Drab & Alabaster
  { cover: "#4A6FA5", text: "#F1F2F6" }, // Muted Teal & Off-White
  { cover: "#523A4A", text: "#D9D9D9" }, // Plum & Light Grey
  { cover: "#C2D5C4", text: "#1B2A22" }, // Pale Mint & Dark Pine
  { cover: "#9E4723", text: "#F5F5DC" }, // Rust & Cream
  { cover: "#263238", text: "#CFD8DC" }, // Deep Indigo & Silver
  { cover: "#BCAAA4", text: "#3E2723" }, // Warm Taupe & Espresso
  { cover: "#EED7C5", text: "#4A2521" }  // Champagne & Deep Burgundy
];


const useBookStore = create((set, get) => ({
  appState: 'DROPZONE',
  pdfDocument: null,
  pdfBytes: null,         // raw ArrayBuffer of the original PDF for export
  totalPages: 0,
  totalSpreads: 0,
  aspectRatio: 0.707,
  currentSpreadIndex: 0,
  isFlipping: false,
  useNativeCover: false,  // when true: use PDF page 1/last as cover/back-cover
  bookColor: colorPool[0].cover,
  textColor: colorPool[0].text,
  fileName: '',
  cameraZoom: null,
  cameraPosition: { x: 0, y: 0 },
  pdfQuality: 2.0,
  setPdfQuality: (quality) => set({ pdfQuality: quality }),
  focusCameraTrigger: 0,
  triggerFocusCamera: () => set(state => ({ focusCameraTrigger: state.focusCameraTrigger + 1 })),
  zoomInTrigger: 0,
  triggerZoomIn: () => set(state => ({ zoomInTrigger: state.zoomInTrigger + 1 })),
  zoomOutTrigger: 0,
  triggerZoomOut: () => set(state => ({ zoomOutTrigger: state.zoomOutTrigger + 1 })),
  filteredPages: null,
  setFilteredPages: (pages) => set(state => {
    let interiorCount;
    if (pages) {
      if (state.useNativeCover) {
        interiorCount = pages.filter(p => p > 1 && p < state.totalPages).length;
      } else {
        interiorCount = pages.length;
      }
    } else {
      if (state.useNativeCover) {
        interiorCount = Math.max(0, state.totalPages - 2);
      } else {
        interiorCount = state.totalPages;
      }
    }
    const newTotalSpreads = 1 + Math.ceil(interiorCount / 2) + 1;
    const newIndex = Math.min(state.currentSpreadIndex, newTotalSpreads);
    
    return { 
      filteredPages: pages, 
      totalSpreads: newTotalSpreads,
      currentSpreadIndex: newIndex
    };
  }),
  past: [],
  future: [],
  saveHistory: () => set(state => {
    const currentState = {
      currentSpreadIndex: state.currentSpreadIndex,
      draws: state.draws,
      highlights: state.highlights,
      bookmarks: state.bookmarks,
      postits: state.postits,
      imageTags: state.imageTags
    };
    return {
      past: [...state.past, currentState],
      future: []
    };
  }),

  undo: () => set(state => {
    if (state.past.length === 0) return {};
    const previousState = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, -1);
    const currentState = {
      currentSpreadIndex: state.currentSpreadIndex,
      draws: state.draws,
      highlights: state.highlights,
      bookmarks: state.bookmarks,
      postits: state.postits,
      imageTags: state.imageTags
    };
    const newDocDraws = { ...state.documentDraws, [state.fileName]: previousState.draws };
    const newDocHighlights = { ...state.documentHighlights, [state.fileName]: previousState.highlights };
    const newDocBookmarks = { ...state.documentBookmarks, [state.fileName]: previousState.bookmarks };
    const newDocPostits = { ...state.documentPostits, [state.fileName]: previousState.postits };
    const newDocImageTags = { ...state.documentImageTags, [state.fileName]: previousState.imageTags };
    return { 
      ...previousState, 
      documentDraws: newDocDraws, 
      documentHighlights: newDocHighlights, 
      documentBookmarks: newDocBookmarks,
      documentPostits: newDocPostits,
      documentImageTags: newDocImageTags,
      past: newPast, 
      future: [currentState, ...state.future] 
    };
  }),

  redo: () => set(state => {
    if (state.future.length === 0) return {};
    const nextState = state.future[0];
    const newFuture = state.future.slice(1);
    const currentState = {
      currentSpreadIndex: state.currentSpreadIndex,
      draws: state.draws,
      highlights: state.highlights,
      bookmarks: state.bookmarks,
      postits: state.postits,
      imageTags: state.imageTags
    };
    const newDocDraws = { ...state.documentDraws, [state.fileName]: nextState.draws };
    const newDocHighlights = { ...state.documentHighlights, [state.fileName]: nextState.highlights };
    const newDocBookmarks = { ...state.documentBookmarks, [state.fileName]: nextState.bookmarks };
    const newDocPostits = { ...state.documentPostits, [state.fileName]: nextState.postits };
    const newDocImageTags = { ...state.documentImageTags, [state.fileName]: nextState.imageTags };
    return { 
      ...nextState, 
      documentDraws: newDocDraws, 
      documentHighlights: newDocHighlights, 
      documentBookmarks: newDocBookmarks,
      documentPostits: newDocPostits,
      documentImageTags: newDocImageTags,
      past: [...state.past, currentState], 
      future: newFuture 
    };
  }),

  isHighlightMode: false,
  highlights: [], // Current document's highlights: [{ id, page, ranges: [Range] }]
  documentHighlights: {}, // Saves highlights per fileName

  setCameraZoom: (z) => set({ cameraZoom: z }),
  setCameraPosition: (pos) => set({ cameraPosition: pos }),

  startLoading: () => set({ appState: 'LOADING' }),

  loadPdf: (pdfDoc, totalPages, fileName, aspectRatio = 0.707, pdfBytes = null, zenState = null) => {
    // Default mode is Generated Cover (useNativeCover: false)
    const interior = Math.ceil(totalPages / 2);
    const totalSpreads = 1 + interior + 1;
    
    const theme = colorPool[Math.floor(Math.random() * colorPool.length)];
    
    const { documentBookmarks } = get();

    // If a zenState was embedded in the PDF, use it (highest priority).
    // Otherwise fall back to locally-persisted data.
    const restoredBookmarks = zenState?.bookmarks ?? (documentBookmarks?.[fileName] ?? []);
    const restoredHighlights = zenState?.highlights ?? (get().documentHighlights[fileName] || []);
    const restoredDraws = zenState?.draws ?? (get().documentDraws[fileName] || []);
    const restoredPostits = zenState?.postits ?? (get().documentPostits[fileName] || []);
    const restoredImageTags = zenState?.imageTags ?? (get().documentImageTags[fileName] || []);

    set({
      appState: 'THEATRE',
      pdfDocument: pdfDoc,
      pdfBytes,
      totalPages,
      totalSpreads,
      fileName,
      aspectRatio,
      currentSpreadIndex: 0,
      isFlipping: false,
      useNativeCover: false, 
      pdfQuality: 2.0,
      bookColor: theme.cover,
      textColor: theme.text,
      bookmarks: restoredBookmarks,
      highlights: restoredHighlights,
      highlightColor: '#ffea0875',
      highlightPreviewColor: '#ffea087a',
      isTextSelectMode: false,
      isHighlightMode: false,
      isEraserMode: false,
      isHighlighterColorMenuOpen: false,
      draws: restoredDraws,
      drawColor: '#ffea08',
      isDrawMode: false,
      isDrawColorMenuOpen: false,
      isSquareMode: false,
      isCompassMode: false,
      isPostitMode: false,
      postits: restoredPostits,
      imageTags: restoredImageTags,
      filteredPages: null,
      past: [],
      future: []
    });
  },

  closePdf: () => set({
    appState: 'DROPZONE',
    pdfDocument: null,
    totalPages: 0,
    totalSpreads: 0,
    currentSpreadIndex: 0,
    isFlipping: false,
    fileName: '',
    bookmarks: [],
    isTextSelectMode: false // Reset mode on close
  }),

  // Lock called by Sheet when a flip animation begins (increments counter)
  startFlip: () => set(state => ({ flippingCount: (state.flippingCount || 0) + 1, isFlipping: true })),

  // Unlock called by Sheet when a flip animation completes (decrements counter)
  endFlip: () => set(state => {
    const nextCount = Math.max(0, (state.flippingCount || 0) - 1);
    return { flippingCount: nextCount, isFlipping: nextCount > 0 };
  }),

  // Toggle native PDF cover on/off and recalculate spreads
  toggleNativeCover: () => set(state => {
    const nextNative = !state.useNativeCover;
    let interiorCount;
    if (state.filteredPages) {
      if (nextNative) {
        interiorCount = state.filteredPages.filter(p => p > 1 && p < state.totalPages).length;
      } else {
        interiorCount = state.filteredPages.length;
      }
    } else {
      if (nextNative) {
        interiorCount = Math.max(0, state.totalPages - 2);
      } else {
        interiorCount = state.totalPages;
      }
    }
    const newTotalSpreads = 1 + Math.ceil(interiorCount / 2) + 1;
    const newIndex = Math.min(state.currentSpreadIndex, newTotalSpreads);

    return { 
      useNativeCover: nextNative,
      totalSpreads: newTotalSpreads,
      currentSpreadIndex: newIndex
    };
  }),

  nextSpread: () => {
    const { currentSpreadIndex, totalSpreads, isTextSelectMode, saveHistory } = get();
    if (isTextSelectMode) return;
    if (currentSpreadIndex < totalSpreads) {
      saveHistory();
      set({ currentSpreadIndex: currentSpreadIndex + 1 });
    }
  },

  prevSpread: () => {
    const { currentSpreadIndex, isTextSelectMode, saveHistory } = get();
    if (isTextSelectMode) return;
    if (currentSpreadIndex > 0) {
      saveHistory();
      set({ currentSpreadIndex: currentSpreadIndex - 1 });
    }
  },

  goToSpread: (index) => {
    const { totalSpreads, isTextSelectMode, currentSpreadIndex, saveHistory } = get();
    if (isTextSelectMode) return;
    const clamped = Math.max(0, Math.min(index, totalSpreads));
    if (clamped !== currentSpreadIndex) {
      saveHistory();
      set({ currentSpreadIndex: clamped });
    }
  },

  // Helper to map a 1-based page number to a spread index
  //
  // useNativeCover=false layout: sheet i → front=2i-1 (right), back=2i (left at spread i+1)
  //   → For page P: targetIndex = Math.floor(P/2) + 1
  //
  // useNativeCover=true layout: sheet i → front=2i (right at spread i), back=2i+1 (left at spread i+1)
  //   → For page P: targetIndex = Math.ceil(P/2)
  //
  goToPage: (pageNumber) => {
    const { totalPages, useNativeCover, totalSpreads, isTextSelectMode, currentSpreadIndex, saveHistory } = get();
    if (isTextSelectMode) return;
    const page = Math.max(1, Math.min(pageNumber, totalPages));
    
    // Page 1 is always the cover (spread 0), regardless of native-cover mode.
    // In native-cover mode page 1 is the exterior of the first sheet (spread 0).
    // In generated-cover mode page 1 is the first interior page shown at spread 1,
    // BUT the thumbnail sidebar shows it as the very first selectable page so we
    // want clicking it to always feel like "go to beginning" → spread 0.
    let targetIndex;
    if (page === 1) {
      targetIndex = 0; // always go to cover spread
    } else if (page === totalPages && useNativeCover) {
      targetIndex = totalSpreads; // last page = back cover spread
    } else {
      targetIndex = useNativeCover
        ? Math.ceil(page / 2)
        : Math.floor(page / 2) + 1;
    }
    
    const clamped = Math.max(0, Math.min(targetIndex, totalSpreads));
    if (clamped !== currentSpreadIndex) {
      saveHistory();
      set({ currentSpreadIndex: clamped });
    }
  },

  // ─── Text Selection Mode ──────────────────────────────────────────────────
  isTextSelectMode: false,
  toggleTextSelectMode: () => set(state => {
    const nextMode = !state.isTextSelectMode;
    return { 
      isTextSelectMode: nextMode,
      isBookmarkMode: nextMode ? false : state.isBookmarkMode,
      isHighlightMode: nextMode ? state.isHighlightMode : false,
      isDrawMode: nextMode ? state.isDrawMode : false,
      isSquareMode: nextMode ? state.isSquareMode : false,
      isCompassMode: nextMode ? state.isCompassMode : false,
      isPostitMode: false,
      isCutMode: false,
      isPasteMode: false,
      isPostitMenuOpen: false,
      isHighlighterColorMenuOpen: false,
      isDrawColorMenuOpen: false
    };
  }),

  // ─── Bookmark System ────────────────────────────────────────────────────────
  isBookmarkMode: false,
  bookmarkColor: '#f59e42',
  bookmarks: [], // Current document's bookmarks
  documentBookmarks: {}, // Saves bookmarks per fileName: { 'doc.pdf': [...] }

  toggleBookmarkMode: () => set(state => {
    const nextMode = !state.isBookmarkMode;
    return {
      isBookmarkMode: nextMode,
      isTextSelectMode: nextMode ? false : state.isTextSelectMode,
      isHighlightMode: false,
      isDrawMode: false,
      isSquareMode: false,
      isCompassMode: false,
      isEraserMode: false,
      isPostitMode: false,
      isCutMode: false,
      isPasteMode: false,
      isPostitMenuOpen: false,
      isHighlighterColorMenuOpen: false,
      isDrawColorMenuOpen: false
    };
  }),

  isEraserMode: false,
  toggleEraserMode: () => set(state => {
    const nextMode = !state.isEraserMode;
    return {
      isEraserMode: nextMode,
      isHighlightMode: false,
      isDrawMode: false,
      isSquareMode: false,
      isCompassMode: false,
      isPostitMode: false,
      isCutMode: false,
      isPasteMode: false,
      isPostitMenuOpen: false,
      isTextSelectMode: nextMode ? true : state.isTextSelectMode,
      isHighlighterColorMenuOpen: false,
      isDrawColorMenuOpen: false
    };
  }),

  toggleHighlightMode: () => set(state => {
    const nextMode = !state.isHighlightMode;
    return {
      isHighlightMode: nextMode,
      isEraserMode: false,
      isDrawMode: false,
      isSquareMode: false,
      isCompassMode: false,
      isPostitMode: false,
      isCutMode: false,
      isPasteMode: false,
      isPostitMenuOpen: false,
      isTextSelectMode: nextMode ? true : state.isTextSelectMode,
      isBookmarkMode: false,
      isHighlighterColorMenuOpen: false
    };
  }),

  // ─── Draw System ──────────────────────────────────────────────────────────
  draws: [],
  documentDraws: {},
  drawColor: '#ffea08',
  drawWidth: 0.005,
  isDrawMode: false,
  isDrawColorMenuOpen: false,

  toggleDrawMode: () => set(state => {
    const nextMode = !state.isDrawMode;
    return {
      isDrawMode: nextMode,
      isHighlightMode: false,
      isSquareMode: false,
      isCompassMode: false,
      isEraserMode: false,
      isPostitMode: false,
      isCutMode: false,
      isPasteMode: false,
      isPostitMenuOpen: false,
      isTextSelectMode: nextMode ? true : state.isTextSelectMode,
      isDrawColorMenuOpen: false
    };
  }),

  toggleSquareMode: () => set(state => {
    const nextMode = !state.isSquareMode;
    return {
      isSquareMode: nextMode,
      isDrawMode: false,
      isHighlightMode: false,
      isCompassMode: false,
      isEraserMode: false,
      isPostitMode: false,
      isCutMode: false,
      isPasteMode: false,
      isPostitMenuOpen: false,
      isTextSelectMode: nextMode ? true : state.isTextSelectMode,
      isDrawColorMenuOpen: false
    };
  }),

  toggleCompassMode: () => set(state => {
    const nextMode = !state.isCompassMode;
    return {
      isCompassMode: nextMode,
      isDrawMode: false,
      isHighlightMode: false,
      isSquareMode: false,
      isEraserMode: false,
      isPostitMode: false,
      isCutMode: false,
      isPasteMode: false,
      isPostitMenuOpen: false,
      isTextSelectMode: nextMode ? true : state.isTextSelectMode,
      isDrawColorMenuOpen: false
    };
  }),

  setDrawColor: (color) => set({ drawColor: color }),
  setDrawWidth: (width) => set({ drawWidth: width }),
  toggleDrawColorMenu: () => set(state => ({ isDrawColorMenuOpen: !state.isDrawColorMenuOpen })),

  addDraw: (pageNumber, stroke) => {
    get().saveHistory();
    set(state => {
      const { fileName, draws, documentDraws } = state;
      const newDraw = {
        id: `dr-${Date.now()}-${Math.random()}`,
        pageNumber,
        type: stroke.type || 'stroke',
        color: stroke.color || state.drawColor,
        width: stroke.width || state.drawWidth,
        points: stroke.points
      };
      const newDraws = [...draws, newDraw];
      return {
        draws: newDraws,
        documentDraws: { ...documentDraws, [fileName]: newDraws }
      };
    });
  },

  // Removes a draw stroke/shape if the (x,y) click hits it
  removeDrawAt: (pageNumber, x, y) => set(state => {
    const { fileName, draws, documentDraws } = state;
    const t = 0.02; // Tolerance for lines

    const toRemove = draws.find(d => {
      if (d.pageNumber !== pageNumber || !d.points || d.points.length < 1) return false;
      
      if (d.type === 'rect') {
        const p1 = d.points[0];
        const p2 = d.points[d.points.length - 1];
        const minX = Math.min(p1.x, p2.x) - t;
        const maxX = Math.max(p1.x, p2.x) + t;
        const minY = Math.min(p1.y, p2.y) - t;
        const maxY = Math.max(p1.y, p2.y) + t;
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
      }
      
      if (d.type === 'ellipse') {
        const p1 = d.points[0];
        const p2 = d.points[d.points.length - 1];
        const centerX = (p1.x + p2.x) / 2;
        const centerY = (p1.y + p2.y) / 2;
        const radiusX = Math.abs(p2.x - p1.x) / 2 + t;
        const radiusY = Math.abs(p2.y - p1.y) / 2 + t;
        if (radiusX <= 0 || radiusY <= 0) return false;
        
        // Ellipse equation: (x-h)^2/a^2 + (y-k)^2/b^2 <= 1
        const dx = x - centerX;
        const dy = y - centerY;
        return (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY) <= 1;
      }
      
      return d.points.some(p => {
        const dx = p.x - x;
        const dy = p.y - y;
        return Math.sqrt(dx*dx + dy*dy) < t;
      });
    });

    if (!toRemove) return {};

    const currentState = {
      currentSpreadIndex: state.currentSpreadIndex,
      draws: state.draws,
      highlights: state.highlights,
      bookmarks: state.bookmarks,
      postits: state.postits,
      imageTags: state.imageTags
    };
    const newDraws = draws.filter(d => d.id !== toRemove.id);
    return {
      past: [...state.past, currentState],
      future: [],
      draws: newDraws,
      documentDraws: { ...documentDraws, [fileName]: newDraws }
    };
  }),

  highlightColor: '#ffea0875',
  highlightPreviewColor: '#ffea087a',
  isHighlighterColorMenuOpen: false,
  setHighlightColors: (effective, preview) => set({ 
    highlightColor: effective,
    highlightPreviewColor: preview 
  }),
  toggleHighlighterColorMenu: () => set(state => ({ isHighlighterColorMenuOpen: !state.isHighlighterColorMenuOpen })),

  // Adds a highlight for a specific page. 
  addHighlight: (pageNumber, rects, color, type = 'rects', points = []) => {
    get().saveHistory();
    set(state => {
      const { fileName, highlights, documentHighlights } = state;
      const newHighlight = {
        id: `hl-${Date.now()}-${Math.random()}`,
        pageNumber,
        rects,
        points,
        type,
        color: color || state.highlightColor
      };
      const newHighlights = [...highlights, newHighlight];
      return {
        highlights: newHighlights,
        documentHighlights: { ...documentHighlights, [fileName]: newHighlights }
      };
    });
  },

  removeLastHighlight: () => set(state => {
    const { fileName, highlights, documentHighlights } = state;
    if (highlights.length === 0) return {};
    const currentState = {
      currentSpreadIndex: state.currentSpreadIndex,
      draws: state.draws,
      highlights: state.highlights,
      bookmarks: state.bookmarks,
      postits: state.postits,
      imageTags: state.imageTags
    };
    const newHighlights = highlights.slice(0, -1);
    return {
      past: [...state.past, currentState],
      future: [],
      highlights: newHighlights,
      documentHighlights: { ...documentHighlights, [fileName]: newHighlights }
    };
  }),

  // Removes a highlight if the (x,y) coordinates (0-1) hit any of its rects
  removeHighlightAt: (pageNumber, x, y) => set(state => {
    const { fileName, highlights, documentHighlights } = state;
    
    // Tolerance to make hit-testing easier (approx 5 pixels in 0-1 range)
    const t = 0.005; 

    const toRemove = highlights.find(h => {
      if (h.pageNumber !== pageNumber) return false;
      return h.rects.some(r => 
        x >= (r.x - t) && x <= (r.x + r.w + t) &&
        y >= (r.y - t) && y <= (r.y + r.h + t)
      );
    });

    if (!toRemove) return {};

    const currentState = {
      currentSpreadIndex: state.currentSpreadIndex,
      draws: state.draws,
      highlights: state.highlights,
      bookmarks: state.bookmarks,
      postits: state.postits,
      imageTags: state.imageTags
    };
    const newHighlights = highlights.filter(h => h.id !== toRemove.id);
    return {
      past: [...state.past, currentState],
      future: [],
      highlights: newHighlights,
      documentHighlights: { ...documentHighlights, [fileName]: newHighlights }
    };
  }),
  
  setBookmarkColor: (color) => set({ bookmarkColor: color }),

  toggleBookmark: (pageNumber, position, edge) => {
    get().saveHistory();
    const { bookmarks, bookmarkColor, fileName, documentBookmarks } = get();
    // Check if a bookmark already exists near this position on the same page & edge
    const threshold = 0.025;
    const existing = bookmarks.find(
      b => b.pageNumber === pageNumber && b.edge === edge && Math.abs(b.position - position) < threshold
    );
    
    let newBookmarks;
    if (existing) {
      // Remove it
      newBookmarks = bookmarks.filter(b => b.id !== existing.id);
    } else {
      // Add new bookmark
      const id = `bm-${pageNumber}-${edge}-${Date.now()}`;
      newBookmarks = [...bookmarks, { id, pageNumber, position, edge, color: bookmarkColor }];
    }

    set({ 
      bookmarks: newBookmarks,
      documentBookmarks: { ...documentBookmarks, [fileName]: newBookmarks }
    });
  },

  getBookmarksForPage: (pageNumber) => {
    return get().bookmarks.filter(b => b.pageNumber === pageNumber);
  },

  // ─── Post-it System ────────────────────────────────────────────────────────
  isEditingPostit: false,
  setEditingPostit: (val) => set({ isEditingPostit: val }),
  isRotatingPostit: false,
  setRotatingPostit: (rotating) => set({ isRotatingPostit: rotating }),

  isDraggingPostit: false,
  setDraggingPostit: (dragging) => set({ isDraggingPostit: dragging }),

  isHoveringInteractive: false,
  setHoveringInteractive: (hovering) => set({ isHoveringInteractive: hovering }),

  // ─── Touch / Input-type detection ─────────────────────────────────────────
  isTouchDevice: false,
  setIsTouchDevice: (val) => set({ isTouchDevice: val }),

  isPostitMode: false,
  isPostitMenuOpen: false,
  togglePostitMenu: () => set(state => {
    const nextOpen = !state.isPostitMenuOpen;
    return {
      isPostitMenuOpen: nextOpen,
      isPostitMode: nextOpen,
      isCutMode: false,
      isPasteMode: false
    };
  }),
  
  isCutMode: false,
  toggleCutMode: () => set(state => {
    const nextMode = !state.isCutMode;
    return {
      isCutMode: nextMode,
      isPasteMode: false,
      isPostitMode: nextMode ? false : true,
      isPostitMenuOpen: true,
      isTextSelectMode: false,
      isHighlightMode: false,
      isDrawMode: false,
      isSquareMode: false,
      isCompassMode: false,
      isEraserMode: false,
      isBookmarkMode: false
    };
  }),
  
  isPasteMode: false,
  togglePasteMode: () => set(state => {
    const nextMode = !state.isPasteMode;
    return {
      isPasteMode: nextMode,
      isCutMode: false,
      isPostitMode: nextMode ? false : true,
      isPostitMenuOpen: true,
      isTextSelectMode: false,
      isHighlightMode: false,
      isDrawMode: false,
      isSquareMode: false,
      isCompassMode: false,
      isEraserMode: false,
      isBookmarkMode: false
    };
  }),
  
  cutImage: null,
  setCutImage: (image) => set({ cutImage: image }),
  
  postits: [], // { id, pageNumber, x, y, text, isFrontFace }
  documentPostits: {},

  togglePostitMode: () => set(state => {
    const nextMode = !state.isPostitMode;
    return {
      isPostitMode: nextMode,
      isCutMode: false,
      isPasteMode: false,
      isPostitMenuOpen: nextMode,
      isTextSelectMode: false,
      isHighlightMode: false,
      isDrawMode: false,
      isSquareMode: false,
      isCompassMode: false,
      isEraserMode: false,
      isBookmarkMode: false,
      isHighlighterColorMenuOpen: false,
      isDrawColorMenuOpen: false
    };
  }),

  addPostit: (pageNumber, x, y, isFrontFace) => {
    get().saveHistory();
    set(state => {
      const id = `postit-${Date.now()}-${Math.random()}`;
      const newPostits = [...state.postits, { id, pageNumber, x, y, isFrontFace, text: '', tilt: 0 }];
      return {
        postits: newPostits,
        documentPostits: { ...state.documentPostits, [state.fileName]: newPostits }
      };
    });
  },

  updatePostitText: (id, text) => {
    set(state => {
      const newPostits = state.postits.map(p => p.id === id ? { ...p, text } : p);
      return {
        postits: newPostits,
        documentPostits: { ...state.documentPostits, [state.fileName]: newPostits }
      };
    });
  },
  
  updatePostitTilt: (id, tilt) => {
    set(state => {
      const newPostits = state.postits.map(p => p.id === id ? { ...p, tilt } : p);
      return {
        postits: newPostits,
        documentPostits: { ...state.documentPostits, [state.fileName]: newPostits }
      };
    });
  },

  updatePostitPosition: (id, x, y) => {
    set(state => {
      const newPostits = state.postits.map(p => p.id === id ? { ...p, x, y } : p);
      return {
        postits: newPostits,
        documentPostits: { ...state.documentPostits, [state.fileName]: newPostits }
      };
    });
  },

  removePostit: (id) => {
    get().saveHistory();
    set(state => {
      const newPostits = state.postits.filter(p => p.id !== id);
      return {
        postits: newPostits,
        documentPostits: { ...state.documentPostits, [state.fileName]: newPostits }
      };
    });
  },

  // ─── Image Tag System ──────────────────────────────────────────────────────
  isDraggingImageTag: false,
  setDraggingImageTag: (val) => set({ isDraggingImageTag: val }),
  imageTags: [], // { id, pageNumber, x, y, imageSrc, isFrontFace, aspectRatio, scaleX, scaleY, tilt }
  documentImageTags: {},

  addImageTag: (pageNumber, x, y, isFrontFace, imageSrc, aspectRatio = 1, scale = 1) => {
    get().saveHistory();
    set(state => {
      const id = `imgtag-${Date.now()}-${Math.random()}`;
      const newTags = [...state.imageTags, { id, pageNumber, x, y, isFrontFace, imageSrc, aspectRatio, scaleX: scale, scaleY: scale, tilt: 0 }];
      return {
        imageTags: newTags,
        documentImageTags: { ...state.documentImageTags, [state.fileName]: newTags }
      };
    });
  },

  updateImageTagPosition: (id, x, y) => {
    set(state => {
      const newTags = state.imageTags.map(t => t.id === id ? { ...t, x, y } : t);
      return {
        imageTags: newTags,
        documentImageTags: { ...state.documentImageTags, [state.fileName]: newTags }
      };
    });
  },

  updateImageTagTransform: (id, tilt, scaleX, scaleY) => {
    set(state => {
      const newTags = state.imageTags.map(t => t.id === id ? { ...t, tilt, scaleX, scaleY } : t);
      return {
        imageTags: newTags,
        documentImageTags: { ...state.documentImageTags, [state.fileName]: newTags }
      };
    });
  },

  updateImageTagTransformAndPosition: (id, x, y, tilt, scaleX, scaleY) => {
    set(state => {
      const newTags = state.imageTags.map(t => t.id === id ? { ...t, x, y, tilt, scaleX, scaleY } : t);
      return {
        imageTags: newTags,
        documentImageTags: { ...state.documentImageTags, [state.fileName]: newTags }
      };
    });
  },

  removeImageTag: (id) => {
    get().saveHistory();
    set(state => {
      const newTags = state.imageTags.filter(t => t.id !== id);
      return {
        imageTags: newTags,
        documentImageTags: { ...state.documentImageTags, [state.fileName]: newTags }
      };
    });
  },
}));

export default useBookStore;
