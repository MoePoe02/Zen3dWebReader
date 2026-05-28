import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useBookStore from '../../store/useBookStore';

export default function ImageTag3D({ tag, sheetWidth, sheetHeight, flipNormal, isActiveSpread, isFlippingSheet = false, isGhost = false }) {
  const meshRef = useRef();
  const removeImageTag = useBookStore(state => state.removeImageTag);
  const updateImageTagPosition = useBookStore(state => state.updateImageTagPosition);
  const updateImageTagTransform = useBookStore(state => state.updateImageTagTransform);
  const updateImageTagTransformAndPosition = useBookStore(state => state.updateImageTagTransformAndPosition);
  const saveHistory = useBookStore(state => state.saveHistory);
  const setDraggingImageTag = useBookStore(state => state.setDraggingImageTag);
  const setHoveringInteractive = useBookStore(state => state.setHoveringInteractive);
  const isTouchDevice = useBookStore(state => state.isTouchDevice);

  const [hovered, setHovered] = useState(false);
  const [isSticky, setIsSticky] = useState(false); // Touch: stays active until click outside
  const isActiveRef = useRef(false); // Tracks if this tag is the "focused" one for sticky
  const [isFrontVisible, setIsFrontVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isScaling, setIsScaling] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggingCorner, setDraggingCorner] = useState(null); // {dirX, dirY}

  const hoverTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleHoverStart = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHovered(true);
    setHoveringInteractive(true);
  };

  const handleHoverEnd = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHovered(false);
      // Only clear hoveringInteractive if not sticky
      if (!isActiveRef.current) setHoveringInteractive(false);
    }, 300);
  };

  // Global listener: deactivate sticky when user taps/clicks outside this tag
  useEffect(() => {
    if (!isSticky) return;
    const handleOutsideClick = () => {
      setTimeout(() => {
        if (!isActiveRef.current) {
          setIsSticky(false);
          setHoveringInteractive(false);
        }
      }, 0);
      isActiveRef.current = false;
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isSticky, setHoveringInteractive]);

  // Clear sticky when tag goes to back-face
  useEffect(() => {
    if (!isFrontVisible) {
      setIsSticky(false);
      isActiveRef.current = false;
    }
  }, [isFrontVisible]);
  
  // Local state buffer for 60fps smooth interactions without global re-renders
  const [localTag, setLocalTag] = useState({ x: tag.x, y: tag.y, scaleX: tag.scaleX || 1, scaleY: tag.scaleY || 1, tilt: tag.tilt || 0 });
  const localTagRef = useRef(localTag);

  useEffect(() => {
    if (isDragging || draggingCorner || isRotating || isScaling) return;
    const newTag = { x: tag.x, y: tag.y, scaleX: tag.scaleX || 1, scaleY: tag.scaleY || 1, tilt: tag.tilt || 0 };
    setLocalTag(newTag);
    localTagRef.current = newTag;
  }, [tag.x, tag.y, tag.scaleX, tag.scaleY, tag.tilt, isDragging, draggingCorner, isRotating, isScaling]);

  const lastX = useRef(0);
  const lastY = useRef(0);

  // Geometry dimensions preserving aspect ratio
  const baseSize = 1.2;
  let w = tag.aspectRatio > 1 ? baseSize : baseSize * tag.aspectRatio;
  let h = tag.aspectRatio > 1 ? baseSize / tag.aspectRatio : baseSize;

  // Ensure it's not larger than the sheet (with a 5% margin)
  const maxW = sheetWidth * 0.95;
  const maxH = sheetHeight * 0.95;
  if (w > maxW) {
    const scale = maxW / w;
    w *= scale;
    h *= scale;
  }
  if (h > maxH) {
    const scale = maxH / h;
    w *= scale;
    h *= scale;
  }

  // Current transform state from local buffer
  const scaleX = localTag.scaleX;
  const scaleY = localTag.scaleY;
  const tilt = localTag.tilt;

  const currentW = w * scaleX;
  const currentH = h * scaleY;

  // Exact position on sheet surface
  const posX = (localTag.x * sheetWidth) - (sheetWidth / 2);
  const posY = (sheetHeight / 2) - (localTag.y * sheetHeight);

  // Polygon offset and Z calculation
  const timestampStr = tag && tag.id ? tag.id.split('-')[1] : '0';
  const baseOrder = parseInt(timestampStr, 10) || 0;
  const t = ((baseOrder % 10000000000) / 10000000000);
  const polyFactor = isFlippingSheet ? (-11.5 - t) : (hovered ? -3.5 : (-1.5 - t));
  const posZ = flipNormal ? -0.0076 : 0.0076; // Slightly above Post-its

  // Visibility culling
  useFrame(({ camera }) => {
    if (!meshRef.current) return;
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(meshRef.current.matrixWorld);
    const viewVector = new THREE.Vector3().subVectors(camera.position, meshRef.current.getWorldPosition(new THREE.Vector3()));
    const visible = normal.dot(viewVector) > 0;
    if (visible !== isFrontVisible) {
      setIsFrontVisible(visible);
      if (!visible) {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        setHovered(false);
      }
    }
  });

  // Dynamic texture loading
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(tag.imageSrc);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    return tex;
  }, [tag.imageSrc]);

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  // Texture for the separate Close Button
  const closeButtonTex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Fill to radius 256 so it covers the full circleGeometry UV extent (no white ring)
    ctx.beginPath();
    ctx.arc(256, 256, 256, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Inset border: arc at 236 + lineWidth 40 â†’ outer edge at radius 256
    ctx.beginPath();
    ctx.arc(256, 256, 236, 0, Math.PI * 2);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 40;
    ctx.stroke();

    // Brown X
    ctx.beginPath();
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 60;
    ctx.lineCap = 'round';
    const margin = 165;
    ctx.beginPath();
    ctx.moveTo(margin, margin);
    ctx.lineTo(512 - margin, 512 - margin);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(512 - margin, margin);
    ctx.lineTo(margin, 512 - margin);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }, []);

  useEffect(() => {
    return () => closeButtonTex.dispose();
  }, [closeButtonTex]);

  const rotateButtonTex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Fill to radius 256 so no white ring at geometry edge
    ctx.beginPath();
    ctx.arc(256, 256, 256, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Inset border: outer edge at radius 256
    ctx.beginPath();
    ctx.arc(256, 256, 236, 0, Math.PI * 2);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 40;
    ctx.stroke();

    // rotate-cw icon (Lucide 24x24 â†’ scaled)
    const s = 14.5;
    const ox = 256 - 12 * s;
    const oy = 256 - 12 * s;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 48 / s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D('M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8'));
    ctx.stroke(new Path2D('M21 3v5h-5'));
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
    return tex;
  }, []);
  
  const scaleButtonTex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Fill to radius 256 so no white ring at geometry edge
    ctx.beginPath();
    ctx.arc(256, 256, 256, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Inset border: outer edge at radius 256
    ctx.beginPath();
    ctx.arc(256, 256, 236, 0, Math.PI * 2);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 40;
    ctx.stroke();

    // move-diagonal-2 icon (Lucide 24x24, slightly smaller scale)
    const s = 11.5;
    const ox = 256 - 12 * s;
    const oy = 256 - 12 * s;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 48 / s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Rotate 90Â° around icon center (12,12) in icon-space
    ctx.translate(12, 12);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-12, -12);
    ctx.stroke(new Path2D('M15 3h6v6'));
    ctx.stroke(new Path2D('M10 14 21 3'));
    ctx.stroke(new Path2D('M3 15v6h6'));
    ctx.stroke(new Path2D('M3 21 14 10'));
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
    return tex;
  }, []);

  const cornerButtonTex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.arc(256, 256, 256, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(256, 256, 229, 0, Math.PI * 2);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 53;
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
    return tex;
  }, []);

  useEffect(() => {
    return () => { rotateButtonTex.dispose(); scaleButtonTex.dispose(); cornerButtonTex.dispose(); };
  }, [rotateButtonTex, scaleButtonTex, cornerButtonTex]);

  // Handle Interactions
  const handlePointerOver = (e) => {
    if (!isActiveSpread || !isFrontVisible || isGhost) return;
    e.stopPropagation();
    handleHoverStart();
  };

  const handlePointerOut = () => {
    if (isGhost) return;
    handleHoverEnd();
    document.body.style.cursor = '';
  };

  const handleContextMenu = (e) => {
    if (!isActiveSpread || !isFrontVisible) return;
    e.nativeEvent.preventDefault(); // Stop browser menu
    e.stopPropagation();
  };

  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (!isActiveSpread || !isFrontVisible) return;
    // Mark this tag as the active one (prevents outside-click from clearing sticky on same event)
    isActiveRef.current = true;

    // Touch mode: first tap activates sticky (shows controls); subsequent interaction works normally
    if (isTouchDevice && !isSticky && !isEditMode) {
      setIsSticky(true);
      setHoveringInteractive(true);
      return;
    }

    if (e.button === 0 && !isEditMode) {
      setIsDragging(true);
      setDraggingImageTag(true);
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      saveHistory(); 
      document.body.style.cursor = 'grabbing';
    }
  };

  // Drag logic
  useEffect(() => {
    if (!isDragging || isEditMode) return;

    const handlePointerMove = (e) => {
      const deltaX = e.clientX - lastX.current;
      const deltaY = e.clientY - lastY.current;
      lastX.current = e.clientX;
      lastY.current = e.clientY;

      const sensitivity = 0.0015;
      const newX = localTagRef.current.x + (deltaX * sensitivity * (flipNormal ? -1 : 1));
      const newY = localTagRef.current.y + (deltaY * sensitivity);

      const minX = (currentW / 2 + 0.02) / sheetWidth;
      const maxX = 1.5;
      const minY = -0.5;
      const maxY = 1.5;

      const clampedX = Math.max(minX, Math.min(maxX, newX));
      const clampedY = Math.max(minY, Math.min(maxY, newY));

      const newLocal = { ...localTagRef.current, x: clampedX, y: clampedY };
      setLocalTag(newLocal);
      localTagRef.current = newLocal;
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setDraggingImageTag(false);
      document.body.style.cursor = 'default';
      updateImageTagPosition(tag.id, localTagRef.current.x, localTagRef.current.y);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setDraggingImageTag(false);
    };
  }, [isDragging, tag.x, tag.y, tag.id, updateImageTagPosition, flipNormal, setDraggingImageTag, currentW]);

  // Rotate Logic
  useEffect(() => {
    if (!isRotating) return;
    const handleMove = (e) => {
      const deltaX = e.clientX - lastX.current;
      lastX.current = e.clientX;
      const newTilt = localTagRef.current.tilt - (deltaX * 0.01);
      
      const newLocal = { ...localTagRef.current, tilt: newTilt };
      setLocalTag(newLocal);
      localTagRef.current = newLocal;
    };
    const handleUp = () => { 
      setIsRotating(false); 
      setDraggingImageTag(false); 
      document.body.style.cursor = 'default'; 
      updateImageTagTransform(tag.id, localTagRef.current.tilt, localTagRef.current.scaleX, localTagRef.current.scaleY);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => { 
      window.removeEventListener('pointermove', handleMove); 
      window.removeEventListener('pointerup', handleUp); 
      setDraggingImageTag(false);
    };
  }, [isRotating, tag.id, updateImageTagTransform, setDraggingImageTag]);

  // Scale Logic (Legacy, hidden when in Edit Mode but kept for safety)
  useEffect(() => {
    if (!isScaling) return;
    const handleMove = (e) => {
      const deltaX = e.clientX - lastX.current;
      const deltaY = e.clientY - lastY.current;
      lastX.current = e.clientX;
      lastY.current = e.clientY;

      const sensitivity = 0.003;
      let newScaleX = scaleX + (deltaX * sensitivity);
      let newScaleY = scaleY + (deltaY * sensitivity);
      
      newScaleX = Math.max(0.1, newScaleX);
      newScaleY = Math.max(0.1, newScaleY);

      updateImageTagTransform(tag.id, tilt, newScaleX, newScaleY);
    };
    const handleUp = () => { setIsScaling(false); setDraggingImageTag(false); document.body.style.cursor = 'default'; };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp); };
  }, [isScaling, tilt, scaleX, scaleY, tag.id, updateImageTagTransform, setDraggingImageTag]);

  // Pivot Corner Scale Logic
  useEffect(() => {
    if (!draggingCorner) return;

    const handleMove = (e) => {
      const deltaX = e.clientX - lastX.current;
      const deltaY = e.clientY - lastY.current;
      lastX.current = e.clientX;
      lastY.current = e.clientY;

      const { dirX, dirY } = draggingCorner;
      const sensitivity = 0.004;

      const dx_visual = deltaX * sensitivity;
      const dy_visual = -deltaY * sensitivity;

      const signX = flipNormal ? -1 : 1;

      const tiltNow = localTagRef.current.tilt;
      const dx_tilted = dx_visual * Math.cos(-tiltNow) - dy_visual * Math.sin(-tiltNow);
      const dy_tilted = dx_visual * Math.sin(-tiltNow) + dy_visual * Math.cos(-tiltNow);

      // Always use the ref (never stale, updated every event)
      const curW = w * localTagRef.current.scaleX;
      const curH = h * localTagRef.current.scaleY;

      const dw = dx_tilted * dirX;
      const dh = dy_tilted * dirY;

      const W_applied = Math.max(0.1, curW + dw);
      const H_applied = Math.max(0.1, curH + dh);

      const applied_dw = W_applied - curW;
      const applied_dh = H_applied - curH;

      const shift_tilted_x = (applied_dw * dirX) / 2;
      const shift_tilted_y = (applied_dh * dirY) / 2;

      const shift_visual_x = shift_tilted_x * Math.cos(tiltNow) - shift_tilted_y * Math.sin(tiltNow);
      const shift_visual_y = shift_tilted_x * Math.sin(tiltNow) + shift_tilted_y * Math.cos(tiltNow);

      const shift_tag_x = (shift_visual_x * signX) / sheetWidth;
      const shift_tag_y = -shift_visual_y / sheetHeight;

      const newTagX = localTagRef.current.x + shift_tag_x;
      const newTagY = localTagRef.current.y + shift_tag_y;

      const minX_clamp = (W_applied / 2 + 0.02) / sheetWidth;
      const clampedX = Math.max(minX_clamp, newTagX);

      const newScaleX = W_applied / w;
      const newScaleY = H_applied / h;

      const newLocal = { ...localTagRef.current, x: clampedX, y: newTagY, scaleX: newScaleX, scaleY: newScaleY };
      setLocalTag(newLocal);
      localTagRef.current = newLocal;
    };

    const handleUp = () => {
      setDraggingCorner(null);
      setDraggingImageTag(false);
      document.body.style.cursor = 'default';
      updateImageTagTransformAndPosition(tag.id, localTagRef.current.x, localTagRef.current.y, localTagRef.current.tilt, localTagRef.current.scaleX, localTagRef.current.scaleY);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => { window.removeEventListener('pointermove', handleMove); window.removeEventListener('pointerup', handleUp); };
  // currentW/currentH removed: now read from localTagRef.current directly (always fresh)
  }, [draggingCorner, tag.id, flipNormal, sheetWidth, sheetHeight, w, h, updateImageTagTransformAndPosition, setDraggingImageTag]);


  const renderCorner = (dirX, dirY) => {
    const localX = dirX * (currentW / 2);
    const localY = dirY * (currentH / 2);
    let cursor = 'nwse-resize';
    if ((dirX > 0 && dirY > 0) || (dirX < 0 && dirY < 0)) cursor = 'nesw-resize';
    if (tilt !== 0) cursor = 'crosshair';

    return (
      <group position={[localX, localY, 0.02]} key={`corner-${dirX}-${dirY}`}>
        <mesh renderOrder={999}>
          <circleGeometry args={[0.06, 32]} />
          <meshBasicMaterial map={cornerButtonTex} depthTest={true} transparent={true} />
        </mesh>
        <mesh
          renderOrder={1000}
          onPointerDown={e => {
            e.stopPropagation();
            setDraggingCorner({ dirX, dirY });
            setDraggingImageTag(true);
            lastX.current = e.clientX; lastY.current = e.clientY;
            document.body.style.cursor = cursor;
            saveHistory();
          }}
          onPointerUp={e => e.stopPropagation()}
          onContextMenu={e => { e.nativeEvent.preventDefault(); e.stopPropagation(); }}
          onPointerOver={(e) => { e.stopPropagation(); handleHoverStart(); document.body.style.cursor = cursor; }}
          onPointerOut={() => { handleHoverEnd(); document.body.style.cursor = ''; }}
        >
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshBasicMaterial transparent={true} opacity={0} depthTest={false} />
        </mesh>
      </group>
    );
  };

  return (
    <group position={[posX, posY, posZ]} rotation={[0, flipNormal ? Math.PI : 0, tilt]}>
      {/* Physical Box */}
      <mesh
        ref={meshRef}
        scale={[scaleX, scaleY, 1]}
        onPointerOver={isGhost ? undefined : handlePointerOver}
        onPointerOut={isGhost ? undefined : handlePointerOut}
        onPointerDown={isGhost ? undefined : handlePointerDown}
        onPointerUp={isGhost ? undefined : e => e.stopPropagation()}
        onContextMenu={isGhost ? undefined : handleContextMenu}
        onClick={isGhost ? undefined : e => {
          e.stopPropagation();
          if (isEditMode) setIsEditMode(false);
        }}
      >
        <boxGeometry args={[w, h, 0.002]} />

        {/* White Edge Materials */}
        <meshStandardMaterial attach="material-0" color="#FFFFFF" transparent={true} opacity={isGhost ? 0.4 : ((hovered || isSticky) && !isEditMode ? 0.6 : 1)} polygonOffset={true} polygonOffsetFactor={polyFactor} polygonOffsetUnits={polyFactor} />
        <meshStandardMaterial attach="material-1" color="#FFFFFF" transparent={true} opacity={isGhost ? 0.4 : ((hovered || isSticky) && !isEditMode ? 0.6 : 1)} polygonOffset={true} polygonOffsetFactor={polyFactor} polygonOffsetUnits={polyFactor} />
        <meshStandardMaterial attach="material-2" color="#FFFFFF" transparent={true} opacity={isGhost ? 0.4 : ((hovered || isSticky) && !isEditMode ? 0.6 : 1)} polygonOffset={true} polygonOffsetFactor={polyFactor} polygonOffsetUnits={polyFactor} />
        <meshStandardMaterial attach="material-3" color="#FFFFFF" transparent={true} opacity={isGhost ? 0.4 : ((hovered || isSticky) && !isEditMode ? 0.6 : 1)} polygonOffset={true} polygonOffsetFactor={polyFactor} polygonOffsetUnits={polyFactor} />

        {/* Front Image Material */}
        <meshBasicMaterial
          attach="material-4"
          map={texture}
          transparent={true}
          opacity={isGhost ? 0.4 : ((hovered || isSticky) && !isEditMode ? 0.6 : 1)}
          depthWrite={true}
          side={THREE.FrontSide}
          polygonOffset={true}
          polygonOffsetFactor={polyFactor}
          polygonOffsetUnits={polyFactor}
        />

        {/* Solid Back face */}
        <meshStandardMaterial
          attach="material-5"
          color="#FAFAFA"
          roughness={0.9}
          transparent={true}
          opacity={isGhost ? 0.4 : ((hovered || isSticky) && !isEditMode ? 0.6 : 1)}
          depthWrite={true}
          side={THREE.FrontSide}
          polygonOffset={true}
          polygonOffsetFactor={polyFactor}
          polygonOffsetUnits={polyFactor}
        />
      </mesh>

      {/* Edit Mode Handles (4 Corners) */}
      {!isGhost && (isEditMode || draggingCorner) && (
        <group>
          {renderCorner(-1, 1)}  {/* TL */}
          {renderCorner(1, 1)}   {/* TR */}
          {renderCorner(-1, -1)} {/* BL */}
          {renderCorner(1, -1)}  {/* BR */}
        </group>
      )}

      {/* Normal Handles Group */}
      {!isGhost && !isEditMode && !draggingCorner && (hovered || isSticky || isRotating || isScaling) && (
        <group>
          {/* Close Button (Top Right) */}
          <group position={[((currentW / 2) + 0.12), (currentH / 2) + 0.12, 0.02]}>
            <mesh renderOrder={999}>
              <circleGeometry args={[0.08, 32]} />
              <meshBasicMaterial map={closeButtonTex} depthTest={true} transparent={true} />
            </mesh>
            <mesh
              renderOrder={1000}
              onPointerDown={e => { e.stopPropagation(); isActiveRef.current = true; }}
              onPointerUp={e => e.stopPropagation()}
              onContextMenu={e => { e.nativeEvent.preventDefault(); e.stopPropagation(); }}
              onClick={(e) => {
                e.stopPropagation();
                removeImageTag(tag.id);
                document.body.style.cursor = 'default';
              }}
              onPointerOver={(e) => { e.stopPropagation(); handleHoverStart(); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { handleHoverEnd(); document.body.style.cursor = ''; }}
            >
              <boxGeometry args={[0.45, 0.45, 0.2]} />
              <meshBasicMaterial transparent={true} opacity={0} depthTest={false} />
            </mesh>
          </group>

          {/* Rotate Button (Bottom Left) */}
          <group position={[-((currentW / 2) + 0.12), -((currentH / 2) + 0.12), 0.02]}>
            <mesh renderOrder={999}>
              <circleGeometry args={[0.08, 32]} />
              <meshBasicMaterial map={rotateButtonTex} depthTest={true} transparent={true} />
            </mesh>
            <mesh
              renderOrder={1000}
              onPointerDown={e => {
                e.stopPropagation();
                isActiveRef.current = true;
                setIsRotating(true); setDraggingImageTag(true);
                useBookStore.setState({ isPostitMenuOpen: false, isPostitMode: false, isPasteMode: false, isCutMode: false, isBookmarkMode: false });
                lastX.current = e.clientX; document.body.style.cursor = 'ew-resize';
                saveHistory();
              }}
              onPointerUp={e => e.stopPropagation()}
              onContextMenu={e => { e.nativeEvent.preventDefault(); e.stopPropagation(); }}
              onPointerOver={(e) => { e.stopPropagation(); handleHoverStart(); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { handleHoverEnd(); document.body.style.cursor = ''; }}
            >
              <boxGeometry args={[0.45, 0.45, 0.2]} />
              <meshBasicMaterial transparent={true} opacity={0} depthTest={false} />
            </mesh>
          </group>

          {/* Scale Toggle Button (Bottom Right) */}
          <group position={[((currentW / 2) + 0.12), -((currentH / 2) + 0.12), 0.02]}>
            <mesh renderOrder={999}>
              <circleGeometry args={[0.08, 32]} />
              <meshBasicMaterial map={scaleButtonTex} depthTest={true} transparent={true} />
            </mesh>
            <mesh
              renderOrder={1000}
              onPointerDown={e => { e.stopPropagation(); isActiveRef.current = true; }}
              onPointerUp={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation();
                setIsEditMode(true);
                useBookStore.setState({ isPostitMenuOpen: false, isPostitMode: false, isPasteMode: false, isCutMode: false, isBookmarkMode: false });
                document.body.style.cursor = 'default';
              }}
              onPointerUp={e => e.stopPropagation()}
              onContextMenu={e => { e.nativeEvent.preventDefault(); e.stopPropagation(); }}
              onPointerOver={(e) => { e.stopPropagation(); handleHoverStart(); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { handleHoverEnd(); document.body.style.cursor = ''; }}
            >
              <boxGeometry args={[0.45, 0.45, 0.2]} />
              <meshBasicMaterial transparent={true} opacity={0} depthTest={false} />
            </mesh>
          </group>
        </group>
      )}
    </group>
  );
}
