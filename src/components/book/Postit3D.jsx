import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import useBookStore from '../../store/useBookStore';

export default function Postit3D({ postit, sheetWidth, sheetHeight, flipNormal, isActiveSpread, isGhost = false, isFlippingSheet = false }) {
  const meshRef = useRef();
  const removePostit = useBookStore(state => state.removePostit);
  const updatePostitText = useBookStore(state => state.updatePostitText);
  const updatePostitTilt = useBookStore(state => state.updatePostitTilt);
  const updatePostitPosition = useBookStore(state => state.updatePostitPosition);
  const saveHistory = useBookStore(state => state.saveHistory);
  const setEditingPostit = useBookStore(state => state.setEditingPostit);
  const setRotatingPostit = useBookStore(state => state.setRotatingPostit);
  const setDraggingPostit = useBookStore(state => state.setDraggingPostit);
  const setHoveringInteractive = useBookStore(state => state.setHoveringInteractive);
  const isTouchDevice = useBookStore(state => state.isTouchDevice);

  const textareaRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [isSticky, setIsSticky] = useState(false); // Touch: stays active until click outside
  const isActiveRef = useRef(false); // Tracks if this postit is the "focused" one for sticky
  const [isEditing, setIsEditing] = useState(false);
  const [isFrontVisible, setIsFrontVisible] = useState(true);
  const [isRotating, setIsRotating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const lastX = useRef(0);
  const lastY = useRef(0);

  const hoverTimeoutRef = useRef(null);
  const meshGroupRef = useRef(null); // Ref to the outer <group> for outside-click detection

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

  // Global listener: deactivate sticky when user taps/clicks outside the postit
  useEffect(() => {
    if (!isSticky) return;
    const handleOutsideClick = (e) => {
      // pointerdown that is NOT on this component deactivates sticky
      // We use a small timeout to let the current event fully propagate first
      setTimeout(() => {
        if (!isActiveRef.current) {
          setIsSticky(false);
          setHoveringInteractive(false);
        }
      }, 0);
      // Reset the flag — the pointerdown on THIS mesh sets it back to true before the timeout runs
      isActiveRef.current = false;
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isSticky, setHoveringInteractive]);

  // Clear sticky when editing ends (user tapped outside the postit body)
  useEffect(() => {
    if (!isEditing) {
      // Keep sticky so the controls stay visible for a moment after editing
    }
  }, [isEditing]);

  // Clear sticky when postit goes to back-face
  useEffect(() => {
    if (!isFrontVisible) {
      setIsSticky(false);
      isActiveRef.current = false;
    }
  }, [isFrontVisible]);

  // Local state buffer for 60fps smooth interactions without global re-renders
  const [localPostit, setLocalPostit] = useState({ x: postit.x, y: postit.y, tilt: postit.tilt || 0 });
  const localPostitRef = useRef(localPostit);

  useEffect(() => {
    if (isDragging || isRotating) return;
    const newPostit = { x: postit.x, y: postit.y, tilt: postit.tilt || 0 };
    setLocalPostit(newPostit);
    localPostitRef.current = newPostit;
  }, [postit.x, postit.y, postit.tilt, isDragging, isRotating]);

  const [blink, setBlink] = useState(true);

  // Auto-edit newly created empty postits
  useEffect(() => {
    if (isGhost) return;
    if (postit.text === '') {
      setIsEditing(true);
    }
  }, [postit.text, isGhost]);

  // Aggressive Autofocus & Caret Blinking
  useEffect(() => {
    if (isGhost) return;
    if (isEditing) {
      // Aggressive focus loop strictly beats WebGL capture
      let attempts = 0;
      const focusInterval = setInterval(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          clearInterval(focusInterval);
        }
        if (attempts++ > 10) clearInterval(focusInterval);
      }, 50);

      // Canvas blink trigger
      const blinkInterval = setInterval(() => setBlink(b => !b), 500);

      return () => {
        clearInterval(focusInterval);
        clearInterval(blinkInterval);
      };
    }
  }, [isEditing]);

  // Position Calculation
  const w = 0.85;
  const h = 0.85;
  const thickness = 0.002;

  // Calculate exact position on the sheet's surface
  const posX = (localPostit.x * sheetWidth) - (sheetWidth / 2);
  const posY = (sheetHeight / 2) - (localPostit.y * sheetHeight);

  const timestampStr = postit && postit.id ? postit.id.split('-')[1] : '0';
  const baseOrder = parseInt(timestampStr, 10) || 0;
  const t = isGhost ? 1 : ((baseOrder % 10000000000) / 10000000000);
  const polyFactor = isFlippingSheet ? (-11.1 - t) : (hovered ? -3 : (-1.1 - t));
  const posZ = flipNormal ? -0.0075 : 0.0075;

  // Keep global lock perfectly synchronized with local state 
  useEffect(() => {
    if (isGhost) return;
    setEditingPostit(isEditing);
    // Cleanup ensures if Postit unmounts while editing, the lock breaks open
    return () => {
      if (isEditing) setEditingPostit(false);
    };
  }, [isEditing, setEditingPostit, isGhost]);

  // Organic tilt from local buffer
  const tilt = localPostit.tilt;

  // Culling Geometry - disable interactions when viewed from the back
  useFrame(({ camera }) => {
    if (!meshRef.current) return;
    // Local front face is always +Z.
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(meshRef.current.matrixWorld);
    const viewVector = new THREE.Vector3().subVectors(camera.position, meshRef.current.getWorldPosition(new THREE.Vector3()));

    // Front is visible if dot product is positive
    const visible = normal.dot(viewVector) > 0;
    if (visible !== isFrontVisible) {
      setIsFrontVisible(visible);
      if (!visible) {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        setHovered(false); // Clear hover if rotated away
        if (isEditing) {
          setIsEditing(false); // Close edit mode naturally
        }
      }
    }
  });

  // Dynamic Texture Generation (Baking)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Ensure transparent layers blend correctly
    ctx.clearRect(0, 0, 512, 512);

    // Solid Background (Warm Vibrant Yellow)
    ctx.fillStyle = '#FFEB3B';
    ctx.fillRect(0, 0, 512, 512);

    // Notepad horizontal lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 90; i < 512; i += 50) {
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
    }
    ctx.stroke();

    // Folded Corner (Bottom Right)
    ctx.fillStyle = '#FBC02D'; // Darker folded shadow
    ctx.beginPath();
    ctx.moveTo(512, 450);
    ctx.lineTo(450, 512);
    ctx.lineTo(512, 512);
    ctx.fill();

    // Text rendering with wrapping
    if (postit.text || isEditing) {
      ctx.fillStyle = '#0a0a0a'; // Solid readable dark
      ctx.font = 'bold 78px "Caveat", cursive, sans-serif';
      ctx.textBaseline = 'top';

      const textToDraw = postit.text + (isEditing && blink ? '|' : '');
      const rawLines = textToDraw.split('\n');
      let textY = 45;
      const maxWidth = 450;

      const MAX_TEXT_Y = 440; // Avoid bottom edge / folded corner

      for (let rawLine of rawLines) {
        if (textY > MAX_TEXT_Y) break;

        if (rawLine === '') {
          textY += 70;
          continue;
        }

        const words = rawLine.split(' ');
        let currentLine = '';

        for (let i = 0; i < words.length; i++) {
          if (textY > MAX_TEXT_Y) break;

          let testLine = currentLine + words[i] + ' ';

          if (ctx.measureText(testLine).width <= maxWidth) {
            currentLine = testLine;
          } else {
            // Word doesn't fit on the current line perfectly.
            if (currentLine.trim().length > 0 && ctx.measureText(words[i] + ' ').width <= maxWidth) {
              // The word itself fits cleanly on the NEXT line. standard line-wrap.
              ctx.fillText(currentLine.trim(), 20, textY);
              currentLine = words[i] + ' ';
              textY += 70;
            } else {
              // The word is MASSIVE. We must hyphenate it character by character.
              let wordChars = words[i].split('');
              while (wordChars.length > 0) {
                if (textY > MAX_TEXT_Y) break;

                let tempLine = currentLine;
                let j = 0;

                while (j < wordChars.length && ctx.measureText(tempLine + wordChars[j] + '-').width <= maxWidth) {
                  tempLine += wordChars[j];
                  j++;
                }

                // If it couldn't even fit 1 char because the line is already full, break early.
                if (j === 0 && currentLine.trim().length > 0) {
                  ctx.fillText(currentLine.trim(), 20, textY);
                  currentLine = '';
                  textY += 70;
                  continue;
                }

                if (j === 0) {
                  tempLine += wordChars[0];
                  j++;
                }

                if (j < wordChars.length) {
                  ctx.fillText(tempLine + '-', 20, textY);
                  currentLine = '';
                  textY += 70;
                  wordChars = wordChars.slice(j);
                } else {
                  currentLine = tempLine + ' ';
                  wordChars = [];
                }
              }
            }
          }
        }
        if (textY <= MAX_TEXT_Y && currentLine.trim().length > 0) {
          ctx.fillText(currentLine.trim(), 20, textY);
          textY += 70;
        }
      }
    } else if (!isEditing && !postit.text) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.font = 'bold 76px "Caveat", cursive, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText('Write your note...', 20, 45);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [postit.text, hovered, isEditing, blink]);

  // Clean up texture
  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  // Texture for the separate Close Button
  const closeButtonTex = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Fill to radius 256 – covers full circleGeometry UV extent (no white ring)
    ctx.beginPath();
    ctx.arc(256, 256, 256, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Inset border: arc 236 + lineWidth 40 → outer edge at 256
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

    // Fill to radius 256 – no white ring at geometry edge
    ctx.beginPath();
    ctx.arc(256, 256, 256, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Inset border: arc 236 + lineWidth 40 → outer edge at 256
    ctx.beginPath();
    ctx.arc(256, 256, 236, 0, Math.PI * 2);
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 40;
    ctx.stroke();

    // rotate-cw icon (Lucide Path2D, scaled from 24x24)
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

  useEffect(() => {
    return () => rotateButtonTex.dispose();
  }, [rotateButtonTex]);

  // Handle Interactions
  const handlePointerOver = (e) => {
    if (!isActiveSpread || !isFrontVisible || isGhost) return;
    e.stopPropagation();
    handleHoverStart();
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e) => {
    if (!isActiveSpread || !isFrontVisible || isGhost) return;
    e.stopPropagation();
    handleHoverEnd();
    document.body.style.cursor = '';
  };

  const handleClick = (e) => {
    if (!isActiveSpread || !isFrontVisible || isGhost || e.delta > 5) return;
    e.stopPropagation();

    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Touch mode: first tap activates sticky (shows controls); second tap enters edit
    if (isTouchDevice && !isSticky && !isEditing) {
      setIsSticky(true);
      isActiveRef.current = true;
      setHoveringInteractive(true);
      return;
    }

    setIsEditing(true);
    setHovered(false); // Pause x-ray while editing
    if (!isTouchDevice) setHoveringInteractive(false);
    setTimeout(() => {
      if (textareaRef.current) textareaRef.current.focus();
    }, 50);
  };

  const handlePointerDown = (e) => {
    if (!isActiveSpread || !isFrontVisible || isGhost) return;
    e.stopPropagation();
    // Mark this postit as the active one (prevents outside-click handler from clearing sticky)
    isActiveRef.current = true;

    if (e.button === 0) { // Left click
      setIsDragging(true);
      setDraggingPostit(true);
      lastX.current = e.clientX;
      lastY.current = e.clientY;
      saveHistory(); 
      document.body.style.cursor = 'grabbing';
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    removePostit(postit.id);
    document.body.style.cursor = '';
  };

  const handleContextMenu = (e) => {
    if (!isActiveSpread || !isFrontVisible || isGhost) return;
    e.nativeEvent.preventDefault(); // Stop browser menu
    e.stopPropagation();

    setIsRotating(true);
    setRotatingPostit(true);
    lastX.current = e.clientX;
    saveHistory(); // Save state before rotating
    document.body.style.cursor = 'grabbing';
  };

  useEffect(() => {
    if (!isRotating) return;

    const handlePointerMove = (e) => {
      const deltaX = e.clientX - lastX.current;
      lastX.current = e.clientX;

      // Sensitivity factor
      const newTilt = localPostitRef.current.tilt + (deltaX * 0.005);
      
      const newLocal = { ...localPostitRef.current, tilt: newTilt };
      setLocalPostit(newLocal);
      localPostitRef.current = newLocal;
    };

    const handlePointerUp = () => {
      setIsRotating(false);
      setRotatingPostit(false);
      document.body.style.cursor = 'default';
      updatePostitTilt(postit.id, localPostitRef.current.tilt);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setRotatingPostit(false);
    };
  }, [isRotating, tilt, postit.id, updatePostitTilt, setRotatingPostit]);

  // Drag logic
  useEffect(() => {
    if (!isDragging || isEditing) return;

    const handlePointerMove = (e) => {
      const deltaX = e.clientX - lastX.current;
      const deltaY = e.clientY - lastY.current;
      lastX.current = e.clientX;
      lastY.current = e.clientY;

      const sensitivity = 0.0015;
      const newX = localPostitRef.current.x + (deltaX * sensitivity * (flipNormal ? -1 : 1));
      const newY = localPostitRef.current.y + (deltaY * sensitivity);

      const minX = 0.465 / sheetWidth;
      const maxX = 1.5;
      const minY = -0.5;
      const maxY = 1.5;

      const clampedX = Math.max(minX, Math.min(maxX, newX));
      const clampedY = Math.max(minY, Math.min(maxY, newY));

      const newLocal = { ...localPostitRef.current, x: clampedX, y: clampedY };
      setLocalPostit(newLocal);
      localPostitRef.current = newLocal;
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setDraggingPostit(false);
      document.body.style.cursor = 'default';
      updatePostitPosition(postit.id, localPostitRef.current.x, localPostitRef.current.y);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setDraggingPostit(false);
    };
  }, [isDragging, isEditing, postit.x, postit.y, postit.id, updatePostitPosition, flipNormal, setDraggingPostit, sheetWidth]);

  return (
    <group position={[posX, posY, posZ]} rotation={[0, flipNormal ? Math.PI : 0, 0]}>
      {/* Physical Box */}
      <mesh
        ref={meshRef}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerDown={handlePointerDown}
        onPointerUp={e => e.stopPropagation()}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
        // Small tilt for realism
        rotation={[0, 0, tilt]}
      >
        <boxGeometry args={[0.89, 0.89, 0.002]} />

        {/* Edges & Back Material */}
        <meshStandardMaterial attach="material-0" color="#FBC02D" transparent={true} opacity={isGhost ? 0.6 : (((hovered || isSticky) && !isEditing && !isRotating) ? 0.35 : 1)} polygonOffset={true} polygonOffsetFactor={polyFactor} polygonOffsetUnits={polyFactor} />
        <meshStandardMaterial attach="material-1" color="#FBC02D" transparent={true} opacity={isGhost ? 0.6 : (((hovered || isSticky) && !isEditing && !isRotating) ? 0.35 : 1)} polygonOffset={true} polygonOffsetFactor={polyFactor} polygonOffsetUnits={polyFactor} />
        <meshStandardMaterial attach="material-2" color="#FBC02D" transparent={true} opacity={isGhost ? 0.6 : (((hovered || isSticky) && !isEditing && !isRotating) ? 0.35 : 1)} polygonOffset={true} polygonOffsetFactor={polyFactor} polygonOffsetUnits={polyFactor} />
        <meshStandardMaterial attach="material-3" color="#FBC02D" transparent={true} opacity={isGhost ? 0.6 : (((hovered || isSticky) && !isEditing && !isRotating) ? 0.35 : 1)} polygonOffset={true} polygonOffsetFactor={polyFactor} polygonOffsetUnits={polyFactor} />

        {/* Front Textured Material */}
        <meshStandardMaterial
          attach="material-4"
          map={texture}
          roughness={0.8}
          transparent={true}
          opacity={isGhost ? 0.6 : (((hovered || isSticky) && !isEditing && !isRotating) ? 0.35 : 1)}
          depthWrite={true}
          side={THREE.FrontSide}
          polygonOffset={true}
          polygonOffsetFactor={polyFactor}
          polygonOffsetUnits={polyFactor}
        />

        {/* Solid Back face (darker unused side) */}
        <meshStandardMaterial
          attach="material-5"
          color="#E4D232"
          roughness={0.9}
          transparent={true}
          opacity={isGhost ? 0.6 : (((hovered || isSticky) && !isEditing && !isRotating) ? 0.35 : 1)}
          depthWrite={true}
          side={THREE.FrontSide}
          polygonOffset={true}
          polygonOffsetFactor={polyFactor}
          polygonOffsetUnits={polyFactor}
        />
      </mesh>

      {/* Separate Opaque Close Button (Large Hitbox) */}
      {(hovered || isSticky || isEditing) && !isGhost && (
        <group>
          {/* Close Button (Top Right) */}
          <group position={[0.56, 0.56, 0.02]}>
            {/* Visual Circle */}
            <mesh renderOrder={999}>
              <circleGeometry args={[0.08, 32]} />
              <meshBasicMaterial
                map={closeButtonTex}
                transparent={false}
                depthTest={true}
                depthWrite={true}
              />
            </mesh>

            {/* Invisible massive Box Hitbox */}
            <mesh
              renderOrder={1000}
              onPointerDown={(e) => { e.stopPropagation(); isActiveRef.current = true; }}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                removePostit(postit.id);
                document.body.style.cursor = 'default';
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                handleHoverStart();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                handleHoverEnd();
                document.body.style.cursor = '';
              }}
            >
              <boxGeometry args={[0.45, 0.45, 0.2]} />
              <meshBasicMaterial transparent={true} opacity={0} depthTest={false} />
            </mesh>
          </group>

          {/* Rotate Button (Bottom Left) */}
          <group position={[-0.56, -0.56, 0.02]}>
            <mesh renderOrder={999}>
              <circleGeometry args={[0.08, 32]} />
              <meshBasicMaterial map={rotateButtonTex} depthTest={true} transparent={true} />
            </mesh>
            <mesh
              renderOrder={1000}
              onPointerDown={e => {
                e.stopPropagation();
                isActiveRef.current = true;
                setIsRotating(true); setRotatingPostit(true);
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
        </group>
      )}

      {/* HTML Edit Overlay */}
      {!isGhost && isEditing && isFrontVisible && (
        <Html
          transform
          scale={0.0017}
          position={[0, 0, thickness / 2 + 0.002]}
          zIndexRange={[100, 0]}
        >
          <div
            className="postit-editing-overlay"
            onPointerDown={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            style={{
              width: '500px',
              height: '500px',
              display: 'flex',
              flexDirection: 'column',
              background: 'transparent', // Let the 3D texture show through!
            }}
          >
            <textarea
              ref={textareaRef}
              autoFocus
              value={postit.text}
              onContextMenu={e => e.stopPropagation()}
              onChange={e => {
                updatePostitText(postit.id, e.target.value);
              }}
              onBlur={(e) => {
                setIsEditing(false);
              }}
              placeholder="Write your note here..."
              style={{
                width: '100%',
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '45px 25px 25px 20px',
                fontFamily: '"Caveat", cursive, sans-serif',
                fontSize: '78px',
                fontWeight: 'bold',
                lineHeight: '70px',
                color: 'transparent',
                caretColor: 'transparent', // Fully hidden native HTML caret
                resize: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </Html>
      )}
    </group>
  );
}
