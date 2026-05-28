import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import useBookStore from '../../store/useBookStore';
import { renderPageToTexture } from '../../utils/pdfEngine';
import Bookmark from './Bookmark';
import Postit3D from './Postit3D';
import ImageTag3D from './ImageTag3D';

export default function Sheet({
  index,
  pdfFrontPageNum,
  pdfBackPageNum,
  isCover = false,
  isBackCover = false,
  useNativeCover = false,
}) {
  const meshRef = useRef();
  const groupRef = useRef();
  const [isActive, setIsActive] = useState(false);

  const currentSpreadIndex = useBookStore(state => state.currentSpreadIndex);
  const pdfDocument = useBookStore(state => state.pdfDocument);
  const bookColor = useBookStore(state => state.bookColor);
  const nextSpread = useBookStore(state => state.nextSpread);
  const prevSpread = useBookStore(state => state.prevSpread);
  const startFlip = useBookStore(state => state.startFlip);
  const endFlip = useBookStore(state => state.endFlip);
  const isFlipping = useBookStore(state => state.isFlipping);
  const fileName = useBookStore(state => state.fileName);
  const textColor = useBookStore(state => state.textColor);
  const goToPage = useBookStore(state => state.goToPage);
  const aspectRatio = useBookStore(state => state.aspectRatio) || 0.707;
  const isBookmarkMode = useBookStore(state => state.isBookmarkMode);
  const isTextSelectMode = useBookStore(state => state.isTextSelectMode);
  const toggleBookmark = useBookStore(state => state.toggleBookmark);
  const bookmarks = useBookStore(state => state.bookmarks);
  const highlights = useBookStore(state => state.highlights);
  const draws = useBookStore(state => state.draws);
  const isPostitMode = useBookStore(state => state.isPostitMode);
  const isEditingPostit = useBookStore(state => state.isEditingPostit);
  const postits = useBookStore(state => state.postits);
  const addPostit = useBookStore(state => state.addPostit);
  const isRotatingPostit = useBookStore(state => state.isRotatingPostit);
  
  const imageTags = useBookStore(state => state.imageTags);
  const isDraggingImageTag = useBookStore(state => state.isDraggingImageTag);
  const isCutMode = useBookStore(state => state.isCutMode);
  const isPasteMode = useBookStore(state => state.isPasteMode);
  const cutImage = useBookStore(state => state.cutImage);
  const addImageTag = useBookStore(state => state.addImageTag);
  const isHoveringInteractive = useBookStore(state => state.isHoveringInteractive);
  const isDraggingPostit = useBookStore(state => state.isDraggingPostit);
  const pdfQuality = useBookStore(state => state.pdfQuality);

  // Derive only highlights specific to this sheet's pages — prevents ALL sheets
  // from re-rendering textures when any highlight anywhere changes.
  const frontPageHighlights = useMemo(
    () => highlights.filter(h => h.pageNumber === pdfFrontPageNum),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [highlights, pdfFrontPageNum]
  );
  const backPageHighlights = useMemo(
    () => highlights.filter(h => h.pageNumber === pdfBackPageNum),
    [highlights, pdfBackPageNum]
  );
  const frontPageDraws = useMemo(
    () => draws.filter(d => d.pageNumber === pdfFrontPageNum),
    [draws, pdfFrontPageNum]
  );
  const backPageDraws = useMemo(
    () => draws.filter(d => d.pageNumber === pdfBackPageNum),
    [draws, pdfBackPageNum]
  );

  const sheetWidth = 4.24 * aspectRatio;
  const sheetHeight = 4.24;

  // ─── PDF Page Textures ──────────────────────────────────────────────────────
  const [frontTex, setFrontTex] = useState(null);
  const [backTex, setBackTex] = useState(null);

  // PDF page textures — loaded for all sheets (including covers when native mode is ON)
  const isNear = Math.abs(currentSpreadIndex - index) <= 1;

  // True when this sheet is one of the two pages visible in the current spread.
  // Computed early so the loading effect can use it for dynamic quality selection.
  const isCurrentSpreadEarly = index === currentSpreadIndex || index === currentSpreadIndex - 1;

  // Track the quality at which each face was last loaded so we can skip redundant
  // re-renders and selectively upgrade when the sheet becomes the active spread.
  const loadedFrontQualityRef = useRef(null);
  const loadedBackQualityRef  = useRef(null);

  // Reset quality refs when the actual page numbers change (e.g. after a large jump).
  useEffect(() => {
    loadedFrontQualityRef.current = null;
  }, [pdfFrontPageNum]);
  useEffect(() => {
    loadedBackQualityRef.current = null;
  }, [pdfBackPageNum]);

  // When the user explicitly changes quality in the HUD, reset both refs so the
  // guard doesn't block re-renders (even when lowering quality).
  useEffect(() => {
    loadedFrontQualityRef.current = null;
    loadedBackQualityRef.current  = null;
  }, [pdfQuality]);

  useEffect(() => {
    const needsFront = pdfFrontPageNum && ((!isCover && !isBackCover) || useNativeCover);
    const needsBack = pdfBackPageNum && ((!isCover && !isBackCover) || useNativeCover);
    if (!pdfDocument || !isNear || (!needsFront && !needsBack)) return;
    let cancelled = false;

    // ── Strategy A: Dynamic Quality ───────────────────────────────────────────
    // Active spread → render at the user's chosen quality (high-res, sharp close-up).
    // Neighbouring/pre-loaded spreads → cap at 1.0 to save CPU and VRAM.
    // Once a page is at high-res, never downgrade it when flipping away.
    const targetQuality = isCurrentSpreadEarly ? pdfQuality : Math.min(1.0, pdfQuality);

    const load = async () => {
      if (needsFront) {
        // Skip if already loaded at the same or better quality.
        if (loadedFrontQualityRef.current !== null && loadedFrontQualityRef.current >= targetQuality) return;
        const tex = await renderPageToTexture(pdfDocument, pdfFrontPageNum, frontPageHighlights, frontPageDraws, targetQuality);
        if (!cancelled && tex) {
          setFrontTex(tex);
          loadedFrontQualityRef.current = targetQuality;
        }
      }
      if (needsBack) {
        if (loadedBackQualityRef.current !== null && loadedBackQualityRef.current >= targetQuality) return;
        const tex = await renderPageToTexture(pdfDocument, pdfBackPageNum, backPageHighlights, backPageDraws, targetQuality);
        if (!cancelled && tex) {
          setBackTex(tex);
          loadedBackQualityRef.current = targetQuality;
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isNear, isCurrentSpreadEarly, pdfDocument, pdfFrontPageNum, pdfBackPageNum, useNativeCover,
    frontPageHighlights, backPageHighlights, frontPageDraws, backPageDraws, pdfQuality]);

  // ─── Cover Textures ─────────────────────────────────────────────────────────
  const [coverTex, setCoverTex] = useState(null);
  const [backCoverTex, setBackCoverTex] = useState(null);

  // ── Random Cover Layout Properties ──
  const coverProps = useMemo(() => {
    const fonts = [
      'Agu Display', 'Anton SC', 'BBH Bartle', 'BBH Hegarty', 'Bona Nova SC',
      'Changa One', 'Danfo', 'Jaro', 'Jersey 20', 'Libertinus Keyboard',
      'Momo Trust Display', 'Montserrat Underline', 'New Amsterdam',
      'Playwrite AR Guides', 'Playwrite DE Grund', 'Playwrite ID', 'Poetsen One',
      'Protest Guerrilla', 'Rubik Doodle Shadow', 'Sedan SC', 'Sekuya',
      'Tac One', 'Tektur', 'Young Serif', 'Ysabeau SC'
    ];
    const aligns = ['left', 'center', 'right'];
    const vPos = ['top', 'center', 'bottom'];
    
    // Seed using the file name so the same file always gets the same random cover
    // A simple string hash to seed our random choices
    let hash = 0;
    for (let i = 0; i < fileName.length; i++) hash = Math.imul(31, hash) + fileName.charCodeAt(i) | 0;
    const random = () => {
      let t = hash += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    return {
      titleFont: fonts[Math.floor(random() * fonts.length)],
      titleAlign: aligns[Math.floor(random() * aligns.length)],
      titleVPos: vPos[Math.floor(random() * vPos.length)],
      footerAlign: aligns[Math.floor(random() * aligns.length)],
      footerIsAbove: random() > 0.5
    };
  }, [fileName]);

  useEffect(() => {
    if (!isCover) return;
    
    let isCancelled = false;
    let activeTex = null;

    const generate = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = Math.round(1024 / aspectRatio);
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = bookColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Await font load to avoid fallback font rendering
      try {
        await document.fonts.load(`52px "${coverProps.titleFont}"`);
      } catch (e) {}

      if (isCancelled) return;

      const displayTitle = fileName.replace('.pdf', '').substring(0, 150);
      ctx.fillStyle = textColor;
      ctx.textBaseline = 'top';
      ctx.font = `bold 64px "${coverProps.titleFont}", sans-serif`;

      const words = displayTitle.split(' ');
      let line = '';
      const lineHeight = 80;
      const maxWidth = canvas.width * 0.8;
      const lines = [];

      // Calculate wrapping
      for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
          lines.push(line.trim());
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());

      const totalTextHeight = lines.length * lineHeight;

      // Determine Title Y position
      let startY;
      if (coverProps.titleVPos === 'top') startY = canvas.height * 0.15;
      else if (coverProps.titleVPos === 'center') startY = (canvas.height - totalTextHeight) / 2;
      else startY = canvas.height * 0.85 - totalTextHeight;

      // Determine Title X position
      ctx.textAlign = coverProps.titleAlign;
      let x;
      if (coverProps.titleAlign === 'left') x = canvas.width * 0.1;
      else if (coverProps.titleAlign === 'center') x = canvas.width / 2;
      else x = canvas.width * 0.9;

      let currentY = startY;
      lines.forEach(l => {
        ctx.fillText(l, x, currentY);
        currentY += lineHeight;
      });

      // Footer: Zen 3D PDF Reader
      ctx.font = `36px "${coverProps.titleFont}", sans-serif`;
      ctx.textAlign = coverProps.footerAlign;
      
      let fx;
      if (coverProps.footerAlign === 'left') fx = canvas.width * 0.1;
      else if (coverProps.footerAlign === 'center') fx = canvas.width / 2;
      else fx = canvas.width * 0.9;
      
      let fy;
      if (coverProps.footerIsAbove) {
        fy = startY - 80;
        if (fy < 40) fy = 40; // clamp
      } else {
        fy = currentY + 40;
        if (fy > canvas.height - 80) fy = canvas.height - 80; // clamp
      }
      
      ctx.fillText('Zen 3D PDF Reader', fx, fy);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.anisotropy = 4;
      
      if (!isCancelled) {
        activeTex = tex;
        setCoverTex(tex);
      } else {
        tex.dispose();
      }
    };

    generate();

    return () => {
      isCancelled = true;
      if (activeTex) activeTex.dispose();
    };
  }, [isCover, bookColor, textColor, fileName, aspectRatio, coverProps]);

  useEffect(() => {
    if (!isBackCover) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.round(1024 / aspectRatio);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bookColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.anisotropy = 16;
    setBackCoverTex(tex);
    return () => tex.dispose();
  }, [isBackCover, bookColor, aspectRatio]);

  // ─── Rotation Animation ─────────────────────────────────────────────────────
  // Track whether this sheet itself is the one about to animate
  const prevSpreadRef = useRef(-1);

  useEffect(() => {
    if (!groupRef.current) return;

    const prevIndex = prevSpreadRef.current;
    if (prevIndex === currentSpreadIndex) return;
    prevSpreadRef.current = currentSpreadIndex;

    const targetRotation = index < currentSpreadIndex ? -Math.PI : 0;
    const delta = Math.abs(currentSpreadIndex - prevIndex);
    const isForward = currentSpreadIndex > prevIndex;

    // Check if this sheet is part of the current jump range
    const isInJumpRange = isForward
      ? (index >= prevIndex && index < currentSpreadIndex)
      : (index >= currentSpreadIndex && index < prevIndex);

    const THICKNESS = 0.016;
    const COVER_SPACING = 0.025;
    let targetZ = 0;

    if (index >= currentSpreadIndex) {
      targetZ = -(index - currentSpreadIndex) * THICKNESS;
      if (currentSpreadIndex === 0 && index !== 0) targetZ -= COVER_SPACING;
      if (isBackCover && index !== 0) targetZ -= COVER_SPACING;
    } else {
      targetZ = -(currentSpreadIndex - index) * THICKNESS;
      if (index === 0) targetZ -= COVER_SPACING;
      const totalSpreads = useBookStore.getState().totalSpreads;
      if (currentSpreadIndex === totalSpreads && !isBackCover) targetZ -= COVER_SPACING;
    }

    if (isInJumpRange) {
      // Speed up if we're jumping many pages
      const baseDuration = delta > 1 ? Math.max(0.3, 0.8 / Math.sqrt(delta)) : 0.8;

      // Calculate a slight stagger based on how many sheets are in the jump
      const relativePos = isForward ? (index - prevIndex) : (prevIndex - index);
      const staggerDelay = delta > 1 ? Math.min(relativePos * 0.04, 0.3) : 0;

      startFlip();
      gsap.to(groupRef.current.rotation, {
        y: targetRotation,
        duration: baseDuration,
        delay: staggerDelay,
        ease: 'power2.inOut',
        onStart: () => setIsActive(true),
        onComplete: () => {
          endFlip();
          setIsActive(false);
          if (groupRef.current) groupRef.current.renderOrder = 0;
        }
      });
      if (groupRef.current) groupRef.current.renderOrder = 100;

      gsap.to(groupRef.current.position, {
        z: targetZ,
        duration: baseDuration,
        delay: staggerDelay,
        ease: 'power2.inOut'
      });
    } else {
      // For sheets not flipping, just update their Z position instantly or very fast to maintain the stack
      gsap.to(groupRef.current.position, {
        z: targetZ,
        duration: 0.4,
        ease: 'power2.out'
      });
      // Ensure rotation is correct (in case they stayed behind)
      gsap.to(groupRef.current.rotation, {
        y: targetRotation,
        duration: 0.4,
        ease: 'power2.out'
      });
    }
  }, [currentSpreadIndex, index, isBackCover]);

  // ─── Anti Z-Fighting Arc ────────────────────────────────────────────────────
  // This pushes the page toward the camera during the flip to avoid Z-fighting
  // and physical intersection with the rest of the book stack.
  useFrame(() => {
    if (groupRef.current && meshRef.current) {
      const rotY = groupRef.current.rotation.y;
      const progress = Math.abs(rotY / Math.PI);

      // Set arc to 0 to keep the hinge perfectly connected to the spine ("trunk")
      // We rely on polygonOffset and renderOrder to prevent clipping instead.
      meshRef.current.position.z = 0;

      // Update renderOrder during drag
      if (isDragging.current) {
        groupRef.current.renderOrder = 100;
      } else if (!isFlipping) {
        groupRef.current.renderOrder = 0;
      }
    }
  });

  const [ghostBM, setGhostBM] = useState(null);
  const [ghostPostit, setGhostPostit] = useState(null);
  const bookmarkColor = useBookStore(state => state.bookmarkColor);

  useEffect(() => {
    if (ghostBM) {
      document.body.style.cursor = 'none';
    } else {
      document.body.style.cursor = '';
    }
    return () => { document.body.style.cursor = ''; };
  }, [ghostBM]);

  const getPostitPlacement = useCallback((point) => {
    const isFrontFace = point.z > 0;
    const pageNum = isFrontFace ? pdfFrontPageNum : pdfBackPageNum;
    if (!pageNum) return null;

    // Spine constraint: prevent postit from spilling across the center fold
    // Half-width is now 0.445 (for 0.89 total width) plus 0.02 cushion = 0.465
    const distanceFromSpine = point.x + (sheetWidth / 2);
    if (distanceFromSpine < 0.465) return null;

    let nx = (point.x + sheetWidth / 2) / sheetWidth;
    let ny = (sheetHeight / 2 - point.y) / sheetHeight;

    // Reject overlaps: Check if mouse is hovering over an existing post-it
    const w = 0.89; // Natural width
    const wNormX = w / sheetWidth;
    const hNormY = w / sheetHeight;

    const isOverlapping = postits.some(p =>
      p.pageNumber === pageNum &&
      Math.abs(p.x - nx) < wNormX &&
      Math.abs(p.y - ny) < hNormY
    );

    if (isOverlapping) return null;

    return { pageNum, x: nx, y: ny, isFrontFace };
  }, [pdfFrontPageNum, pdfBackPageNum, sheetWidth, sheetHeight, postits]);

  const getBookmarkPlacement = useCallback((point) => {
    const halfW = sheetWidth / 2;
    const halfH = sheetHeight / 2;

    // Determine which face was clicked (front = +Z, back = -Z)
    const isFrontFace = point.z > 0;
    const pageNum = isFrontFace ? pdfFrontPageNum : pdfBackPageNum;
    if (!pageNum) return null;

    // Determine which edge is closest
    const distRight = Math.abs(point.x - halfW);
    const distLeft = Math.abs(point.x + halfW);
    const distTop = Math.abs(point.y - halfH);
    const distBottom = Math.abs(point.y + halfH);

    const edgeThreshold = 0.4; // How close to the edge for a click to register
    const minDist = Math.min(distRight, distLeft, distTop, distBottom);
    if (minDist > edgeThreshold) return null; // Clicked too far from any edge

    let edge, positionFraction;
    if (minDist === distTop) {
      edge = 'top';
      positionFraction = (point.x + halfW) / sheetWidth;
    } else if (minDist === distBottom) {
      edge = 'bottom';
      positionFraction = (point.x + halfW) / sheetWidth;
    } else if (minDist === distRight) {
      edge = 'right';
      positionFraction = (point.y + halfH) / sheetHeight;
    } else {
      return null;
    }

    return { pageNum, position: positionFraction, edge, isFrontFace };
  }, [pdfFrontPageNum, pdfBackPageNum, sheetWidth, sheetHeight]);

  // ─── Interaction Click Logic ───────────────────────────────────────────────
  const handleSheetClick = useCallback((e) => {
    if (isCover || isBackCover) return;

    if (isBookmarkMode) {
      e.stopPropagation();
      const point = e.point.clone();
      meshRef.current.worldToLocal(point);

      const placement = getBookmarkPlacement(point);
      if (placement) {
        toggleBookmark(placement.pageNum, placement.position, placement.edge);
      }
    } else if (isPostitMode) {
      e.stopPropagation();
      const point = e.point.clone();
      meshRef.current.worldToLocal(point);

      const placement = getPostitPlacement(point);
      if (placement) {
        addPostit(placement.pageNum, placement.x, placement.y, placement.isFrontFace);
        setGhostPostit(null);
      }
    } else if (isPasteMode && cutImage) {
      e.stopPropagation();
      const point = e.point.clone();
      meshRef.current.worldToLocal(point);

      const placement = getPostitPlacement(point);
      if (placement) {
        const img = new window.Image();
        img.onload = () => {
          const aspect = img.width / img.height;
          let scale = 1;
          if (cutImage.initial3DWidth) {
            const baseSize = 1.2;
            const w = aspect > 1 ? baseSize : baseSize * aspect;
            scale = cutImage.initial3DWidth / w;
          }

          // Replicate width constraint logic to prevent placing past the spine
          const baseSize = 1.2;
          let imgW = aspect > 1 ? baseSize : baseSize * aspect;
          let imgH = aspect > 1 ? baseSize / aspect : baseSize;
          const maxW = sheetWidth * 0.95;
          const maxH = sheetHeight * 0.95;
          if (imgW > maxW) {
            const scaleFactor = maxW / imgW;
            imgW *= scaleFactor;
            imgH *= scaleFactor;
          }
          if (imgH > maxH) {
            const scaleFactor = maxH / imgH;
            imgW *= scaleFactor;
            imgH *= scaleFactor;
          }
          const currentW = imgW * scale;
          const minX = (currentW / 2 + 0.02) / sheetWidth;
          const clampedX = Math.max(minX, placement.x);

          addImageTag(placement.pageNum, clampedX, placement.y, placement.isFrontFace, cutImage.src, aspect, scale);
          useBookStore.setState({ isPasteMode: false, isPostitMode: true, cutImage: null });
        };
        img.src = cutImage.src;
        setGhostPostit(null);
      }
    }
  }, [isBookmarkMode, isPostitMode, isPasteMode, cutImage, isCover, isBackCover, getBookmarkPlacement, getPostitPlacement, toggleBookmark, addPostit, addImageTag]);

  // ─── Bookmark Rendering ────────────────────────────────────────────────────
  const frontBookmarks = useMemo(() => {
    if (!pdfFrontPageNum) return [];
    return bookmarks.filter(b => b.pageNumber === pdfFrontPageNum);
  }, [bookmarks, pdfFrontPageNum]);

  const backBookmarks = useMemo(() => {
    if (!pdfBackPageNum) return [];
    return bookmarks.filter(b => b.pageNumber === pdfBackPageNum);
  }, [bookmarks, pdfBackPageNum]);

  // ─── Postit Rendering ──────────────────────────────────────────────────────
  const frontPostits = useMemo(() => {
    if (!pdfFrontPageNum) return [];
    return postits.filter(p => p.pageNumber === pdfFrontPageNum);
  }, [postits, pdfFrontPageNum]);

  const backPostits = useMemo(() => {
    if (!pdfBackPageNum) return [];
    return postits.filter(p => p.pageNumber === pdfBackPageNum);
  }, [postits, pdfBackPageNum]);

  // ─── Image Tag Rendering ───────────────────────────────────────────────────
  const frontImageTags = useMemo(() => {
    if (!pdfFrontPageNum) return [];
    return imageTags.filter(t => t.pageNumber === pdfFrontPageNum);
  }, [imageTags, pdfFrontPageNum]);

  const backImageTags = useMemo(() => {
    if (!pdfBackPageNum) return [];
    return imageTags.filter(t => t.pageNumber === pdfBackPageNum);
  }, [imageTags, pdfBackPageNum]);

  // isCurrentSpreadEarly (defined above near the texture loading effect) is the
  // canonical version. Keep this alias for readability in the JSX below.
  const isCurrentSpread = isCurrentSpreadEarly;

  const getBookmarkPosition = (bm, isFront) => {
    const halfW = sheetWidth / 2;
    const halfH = sheetHeight / 2;
    // We use a static 0.0075 for all items. Sorting on the same face is now handled perfectly by polygonOffset
    const localZ = 0.0075;
    
    const zOffset = isFront ? localZ : -localZ;
    const inset = 0.24;

    switch (bm.edge) {
      case 'top':
        return [bm.position * sheetWidth - halfW, halfH - inset, zOffset];
      case 'bottom':
        return [bm.position * sheetWidth - halfW, -halfH + inset, zOffset];
      case 'right':
        return [halfW - inset, bm.position * sheetHeight - halfH, zOffset];
      case 'left':
        return [-halfW + inset, bm.position * sheetHeight - halfH, zOffset];
      default:
        return [0, 0, zOffset];
    }
  };

  // ─── Drag Logic ─────────────────────────────────────────────────────────────
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startRot = useRef(0);

  const onPointerDown = useCallback((e) => {
    if (isDraggingImageTag) return; // Block dragging if dragging image
    if (isPostitMode || isCutMode || isPasteMode) return; // Block dragging in tools mode
    if (isTextSelectMode) return; // Block dragging in Text Select mode
    if (isBookmarkMode) return;
    if (isFlipping) return;
    if (e.button !== 0) return;

    // ─── Flippable Guard ──────────────────────────────────────────────────────
    const canFlipLeft = index === currentSpreadIndex;
    const canFlipRight = index === currentSpreadIndex - 1;
    if (!canFlipLeft && !canFlipRight) return;

    // Stop any ongoing animation to prevent conflicts during manual drag
    if (groupRef.current) {
      gsap.killTweensOf(groupRef.current.rotation);
      gsap.killTweensOf(groupRef.current.position);
    }

    setIsActive(true);
    e.stopPropagation();
    isDragging.current = true;
    startX.current = e.clientX;
    let currentY = groupRef.current.rotation.y;
    if (Math.abs(currentY) < 0.2) currentY = 0;
    if (Math.abs(currentY + Math.PI) < 0.2) currentY = -Math.PI;
    groupRef.current.rotation.y = currentY;
    startX.current = e.clientX;
    startRot.current = currentY;
    e.target.setPointerCapture(e.pointerId);
  }, [isFlipping, isBookmarkMode, index, currentSpreadIndex, isTextSelectMode]);

  const onPointerMove = useCallback((e) => {
    if (isDragging.current) {
      e.stopPropagation();
      const deltaX = e.clientX - startX.current;

      // Sensitivity based on screen width
      const sensitivity = (Math.PI * 1.2) / window.innerWidth;
      let newRot = startRot.current + deltaX * sensitivity;

      // Hard clamp to prevent 'vuelve a girar' / disappearing bug
      newRot = Math.max(-Math.PI, Math.min(0, newRot));
      groupRef.current.rotation.y = newRot;
      return;
    }

    if (isBookmarkMode && !isCover && !isBackCover) {
      e.stopPropagation();
      const point = e.point.clone();
      meshRef.current.worldToLocal(point);
      setGhostBM(getBookmarkPlacement(point));
    } else if ((isPostitMode || isPasteMode) && !isCover && !isBackCover) {
      e.stopPropagation();
      const point = e.point.clone();
      meshRef.current.worldToLocal(point);
      setGhostPostit(getPostitPlacement(point));
    }
  }, [isBookmarkMode, isPostitMode, isPasteMode, isCover, isBackCover, getBookmarkPlacement, getPostitPlacement]);

  const onPointerOut = useCallback(() => {
    setGhostBM(null);
    setGhostPostit(null);
  }, []);

  const onPointerUp = useCallback((e) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setIsActive(false);
    e.stopPropagation();
    e.target.releasePointerCapture(e.pointerId);

    const threshold = -Math.PI / 2;
    const currentRot = groupRef.current.rotation.y;

    // Determine target based on the drag progress
    if (startRot.current >= -0.01) { // Was closed on the right
      if (currentRot < threshold) {
        // Successful flip left (forward)
        nextSpread();
      } else {
        // Snap back to right
        gsap.to(groupRef.current.rotation, { y: 0, duration: 0.4, ease: 'power2.out' });
      }
    } else { // Was closed on the left (flipped)
      if (currentRot > threshold) {
        // Successful flip right (backward)
        prevSpread();
      } else {
        // Snap back to left
        gsap.to(groupRef.current.rotation, { y: -Math.PI, duration: 0.4, ease: 'power2.out' });
      }
    }
  }, [nextSpread, prevSpread]);

  // ─── Materials ──────────────────────────────────────────────────────────────
  // Material-4 (+Z) is the face visible at rotation 0.
  // Material-5 (-Z) is the face visible at rotation -PI.
  // So:
  // Cover (Spread 0): Front face is Exterior, Back face is Interior.
  // Back Cover (Last Spread): Back face is Exterior, Front face is Interior.

  const frontMap = isCover
    ? (useNativeCover ? backTex : coverTex)  // Exterior
    : isBackCover
      ? null                                 // Interior
      : frontTex;

  const backMap = isCover
    ? null                                   // Interior
    : isBackCover
      ? (useNativeCover ? backTex : backCoverTex) // Exterior
      : backTex;

  const edgeMat = { color: 0xD1BBAA, roughness: 1 };
  const frontKey = `ft-${frontMap?.uuid ?? 'empty'}`;
  const backKey = `bt-${backMap?.uuid ?? 'empty'}`;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <mesh
        ref={meshRef}
        position={[sheetWidth / 2, 0, 0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={handleSheetClick}
      >
        <boxGeometry args={[sheetWidth, sheetHeight, (isCover || isBackCover) ? 0.05 : 0.014]} />
        <meshStandardMaterial attach="material-0" {...edgeMat} />
        <meshStandardMaterial attach="material-1" {...edgeMat} />
        <meshStandardMaterial attach="material-2" {...edgeMat} />
        <meshStandardMaterial attach="material-3" {...edgeMat} />
        <meshBasicMaterial
          key={frontKey}
          attach="material-4"
          color={isBackCover ? 0xF2E9E4 : 0xFFFFFF}
          map={frontMap ?? null}
          polygonOffset={isActive}
          polygonOffsetFactor={-10}
          polygonOffsetUnits={-10}
        />
        <meshBasicMaterial
          key={backKey}
          attach="material-5"
          color={isCover ? 0xF2E9E4 : 0xFFFFFF}
          map={backMap ?? null}
          polygonOffset={isActive}
          polygonOffsetFactor={-10}
          polygonOffsetUnits={-10}
        />

        {/* Front page bookmarks - now children of mesh to follow movement */}
        {frontBookmarks.map(bm => (
          <Bookmark
            key={bm.id}
            id={bm.id}
            position={getBookmarkPosition(bm, true)}
            edge={bm.edge}
            color={bm.color}
            flipNormal={false}
            isActive={isActive}
            onClick={() => {
              if (isBookmarkMode) {
                toggleBookmark(bm.pageNumber, bm.position, bm.edge);
              } else {
                goToPage(bm.pageNumber);
              }
            }}
          />
        ))}

        {/* Back page bookmarks - now children of mesh to follow movement */}
        {backBookmarks.map(bm => (
          <Bookmark
            key={bm.id}
            id={bm.id}
            position={getBookmarkPosition(bm, (isCover && useNativeCover) ? true : false)}
            edge={bm.edge}
            color={bm.color}
            flipNormal={(isCover && useNativeCover) ? false : true}
            isActive={isActive}
            onClick={() => {
              if (isBookmarkMode) {
                toggleBookmark(bm.pageNumber, bm.position, bm.edge);
              } else {
                goToPage(bm.pageNumber);
              }
            }}
          />
        ))}

        {/* Front Post-its */}
        {frontPostits.map(p => (
          <Postit3D
            key={p.id}
            postit={p}
            sheetWidth={sheetWidth}
            sheetHeight={sheetHeight}
            flipNormal={false}
            isActiveSpread={isCurrentSpread}
            isFlippingSheet={isActive}
          />
        ))}

        {/* Back Post-its */}
        {backPostits.map(p => (
          <Postit3D
            key={p.id}
            postit={p}
            sheetWidth={sheetWidth}
            sheetHeight={sheetHeight}
            flipNormal={(isCover && useNativeCover) ? false : true}
            isActiveSpread={isCurrentSpread}
            isFlippingSheet={isActive}
          />
        ))}

        {/* Front Image Tags */}
        {frontImageTags.map(tag => (
          <ImageTag3D
            key={tag.id}
            tag={tag}
            sheetWidth={sheetWidth}
            sheetHeight={sheetHeight}
            flipNormal={false}
            isActiveSpread={isCurrentSpread}
            isFlippingSheet={isActive}
          />
        ))}

        {/* Back Image Tags */}
        {backImageTags.map(tag => (
          <ImageTag3D
            key={tag.id}
            tag={tag}
            sheetWidth={sheetWidth}
            sheetHeight={sheetHeight}
            flipNormal={(isCover && useNativeCover) ? false : true}
            isActiveSpread={isCurrentSpread}
            isFlippingSheet={isActive}
          />
        ))}

        {/* Ghost visualizer for placing new bookmarks */}
        {isBookmarkMode && ghostBM && (
          <Bookmark
            key="ghost"
            id="ghost"
            position={getBookmarkPosition(ghostBM, ghostBM.isFrontFace)}
            edge={ghostBM.edge}
            color={bookmarkColor}
            flipNormal={!ghostBM.isFrontFace}
            isActive={isActive}
            isGhost={true}
          />
        )}

        {/* Ghost visualizer for placing new Postits */}
        {isPostitMode && ghostPostit && !isRotatingPostit && !isHoveringInteractive && !isDraggingPostit && !isDraggingImageTag && (
          <Postit3D
            key="ghost-postit"
            postit={{
              ...ghostPostit,
              text: 'Write your note...',
              id: 'ghost-1'
            }}
            sheetWidth={sheetWidth}
            sheetHeight={sheetHeight}
            flipNormal={!ghostPostit.isFrontFace}
            isActiveSpread={false}
            isGhost={true}
            isFlippingSheet={isActive}
          />
        )}

        {/* Ghost visualizer for pasting Images */}
        {isPasteMode && cutImage && ghostPostit && !isHoveringInteractive && !isDraggingImageTag && !isDraggingPostit && (() => {
          const aspect = cutImage.aspectRatio || 1;
          const baseSize = 1.2;
          let imgW = aspect > 1 ? baseSize : baseSize * aspect;
          let imgH = aspect > 1 ? baseSize / aspect : baseSize;
          const maxW = sheetWidth * 0.95;
          const maxH = sheetHeight * 0.95;
          if (imgW > maxW) {
            const scaleFactor = maxW / imgW;
            imgW *= scaleFactor;
            imgH *= scaleFactor;
          }
          if (imgH > maxH) {
            const scaleFactor = maxH / imgH;
            imgW *= scaleFactor;
            imgH *= scaleFactor;
          }
          const targetW = cutImage.initial3DWidth || imgW;
          const scale = targetW / imgW;
          const minX = (targetW / 2 + 0.02) / sheetWidth;
          const clampedX = Math.max(minX, ghostPostit.x);

          return (
            <ImageTag3D
              key="ghost-image"
              tag={{
                ...ghostPostit,
                x: clampedX,
                id: 'ghost-image',
                imageSrc: cutImage.src,
                aspectRatio: aspect,
                scaleX: scale,
                scaleY: scale,
                tilt: 0
              }}
              sheetWidth={sheetWidth}
              sheetHeight={sheetHeight}
              flipNormal={!ghostPostit.isFrontFace}
              isActiveSpread={false}
              isFlippingSheet={isActive}
              isGhost={true}
            />
          );
        })()}
      </mesh>
    </group>
  );
}
