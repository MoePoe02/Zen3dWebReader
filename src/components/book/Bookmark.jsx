import { useMemo, useState } from 'react';
import * as THREE from 'three';
import useBookStore from '../../store/useBookStore';

/**
 * Teardrop / Post-it bookmark that attaches to the edge of a page.
 * 
 * Shape: Horizontal teardrop — a 45° triangle from the page edge inward,
 * and a rounded rectangle extending ~0.15 units outward from the edge.
 * 
 * Props:
 *   - position: [x, y, z] in local sheet space
 *   - edge: 'top' | 'bottom' | 'right' | 'left'
 *   - color: hex color string (default #f59e42)
 *   - onClick: click handler
 *   - flipNormal: true when the bookmark is on the back face of a page
 */
export default function Bookmark({ id, position, edge = 'right', color = '#f59e42', onClick, flipNormal = false, isActive = false, isGhost = false }) {
  const [hovered, setHovered] = useState(false);
  const isBookmarkMode = useBookStore(state => state.isBookmarkMode);

  const timestampStr = id ? id.split('-')[3] : '0';
  const baseOrder = parseInt(timestampStr, 10) || 0;
  const t = isGhost ? 1 : ((baseOrder % 10000000000) / 10000000000);
  const polyFactor = isActive ? (-11.1 - t) : (hovered ? -3 : (-1.1 - t));

  // Geometry dimensions
  const tDepth = 0.24;
  const tLength = 0.30;
  const hH = 0.12;

  const { triangleShape, tabShape } = useMemo(() => {
    const tShape = new THREE.Shape();
    tShape.moveTo(0, 0);
    tShape.lineTo(tDepth, hH);
    tShape.lineTo(tDepth, -hH);
    tShape.lineTo(0, 0);

    const rbShape = new THREE.Shape();
    rbShape.moveTo(tDepth, hH);
    rbShape.lineTo(tDepth + tLength, hH);
    rbShape.absarc(tDepth + tLength, 0, hH, Math.PI / 2, -Math.PI / 2, true);
    rbShape.lineTo(tDepth, -hH);
    rbShape.lineTo(tDepth, hH);

    return { triangleShape: tShape, tabShape: rbShape };
  }, []);

  const rotation = useMemo(() => {
    let base = [0, 0, 0];
    switch (edge) {
      case 'right':  base = [0, 0, 0]; break;
      case 'left':   base = [0, 0, Math.PI]; break;
      case 'top':    base = [0, 0, Math.PI / 2]; break;
      case 'bottom': base = [0, 0, -Math.PI / 2]; break;
    }
    // If it's a back bookmark, flip around X to face -Z.
    // For top/bottom edges we also need to compensate the Z rotation inversion
    // caused by the X flip, otherwise they point in the wrong direction.
    if (flipNormal) {
      base[0] = Math.PI;
      if (edge === 'top')    base[2] = -Math.PI / 2;
      if (edge === 'bottom') base[2] =  Math.PI / 2;
    }
    return base;
  }, [edge, flipNormal]);

  // Base display color computation
  const displayColor = useMemo(() => {
    if (isGhost) {
      const c = new THREE.Color(color);
      const hsl = {};
      c.getHSL(hsl);
      c.setHSL(hsl.h, hsl.s * 0.3, hsl.l); // desaturated
      return c.getStyle();
    }
    if (isBookmarkMode && hovered) {
      return '#ff4444'; // Delete indicator
    }
    return color;
  }, [color, isGhost, isBookmarkMode, hovered]);
  
  // Back face color (darker version of displayColor to simulate shadow/backside)
  const backColor = useMemo(() => {
    return new THREE.Color(displayColor).multiplyScalar(0.7).getStyle();
  }, [displayColor]);

  const matProps = {
    roughness: 0.6,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: polyFactor,
    polygonOffsetUnits: polyFactor,
    transparent: true,
    opacity: isGhost ? 0.6 : 1.0,
  };

  const frontMatProps = {
    ...matProps,
    color: displayColor,
    emissive: displayColor,
    emissiveIntensity: hovered && !isGhost ? 0.45 : (isGhost ? 0.2 : 0),
  };

  const backMatProps = {
    ...matProps,
    color: backColor,
    emissive: backColor,
    emissiveIntensity: hovered && !isGhost ? 0.2 : (isGhost ? 0.1 : 0),
  };

  // ─── Hover Scale with Anchor Compensation ──────────────────────────────────
  // When scaling, the bookmark grows from its local origin (the triangle tip at x=0).
  // For front-facing bookmarks this is fine — they grow outward from the page edge.
  // For back-facing (flipNormal) bookmarks, scaling in the flipped coordinate system
  // would cause the bookmark to float away from the page surface.
  //
  // Solution: apply the same 1.15 scale to ALL bookmarks on hover, but for flipNormal
  // bookmarks we add a small position offset to the inner group that compensates for
  // the growth in the direction that would cause separation. This effectively anchors
  // the scale toward the page edge.
  const scaleFactor = 1.15;
  const scaleActive = hovered;

  // Compute anchor-compensation offset to keep the bookmark properly anchored to the page edge (x = tDepth) when hovering.
  // Because scaling by 1.15 from origin (x=0, which is the internal tip of the triangle) 
  // pushes the entire geometry outwards, we need to pull it back by the exact amount it grew 
  // at the page edge boundary, both for front and back facing bookmarks.
  const hoverOffset = useMemo(() => {
    return [tDepth * (1 - scaleFactor), 0, 0];
  }, []);

  // The actual scale vector (uniform XY, Z=1 to not extrude into the page)
  const scaleVec = scaleActive ? [scaleFactor, scaleFactor, 1] : [1, 1, 1];

  return (
    <group 
      position={position} 
      rotation={rotation} 
      onClick={!isGhost ? (e) => { e.stopPropagation(); onClick?.(); } : undefined}
      onPointerOver={!isGhost ? (e) => { 
        e.stopPropagation(); 
        setHovered(true);
        document.body.style.cursor = 'pointer';
      } : undefined}
      onPointerOut={!isGhost ? () => { 
        setHovered(false);
        document.body.style.cursor = '';
      } : undefined}
    >
      {/* Inner group: applies hover scale + anchor offset for both front and back bookmarks */}
      <group scale={scaleVec} position={scaleActive ? hoverOffset : [0, 0, 0]}>
        {/* Front Face (Side A) */}
        <mesh>
          <shapeGeometry args={[triangleShape]} />
          <meshStandardMaterial {...frontMatProps} side={THREE.FrontSide} />
        </mesh>
        <mesh>
          <shapeGeometry args={[tabShape]} />
          <meshStandardMaterial {...frontMatProps} side={THREE.FrontSide} />
        </mesh>

        {/* Back Face (Side B) */}
        <mesh>
          <shapeGeometry args={[triangleShape]} />
          <meshStandardMaterial {...backMatProps} side={THREE.BackSide} />
        </mesh>
        <mesh>
          <shapeGeometry args={[tabShape]} />
          <meshStandardMaterial {...backMatProps} side={THREE.BackSide} />
        </mesh>
      </group>
    </group>
  );
}

