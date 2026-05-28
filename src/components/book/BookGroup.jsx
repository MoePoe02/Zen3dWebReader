import { useRef, useEffect, useMemo } from 'react';
import gsap from 'gsap';
import useBookStore from '../../store/useBookStore';
import Sheet from './Sheet';

export default function BookGroup() {
  const totalSpreads        = useBookStore(state => state.totalSpreads);
  const totalPages          = useBookStore(state => state.totalPages);
  const currentSpreadIndex  = useBookStore(state => state.currentSpreadIndex);
  const aspectRatio         = useBookStore(state => state.aspectRatio) || 0.707;
  const useNativeCover      = useBookStore(state => state.useNativeCover);
  const sheetWidth          = 4.24 * aspectRatio;
  const groupRef            = useRef();

  // Center the book depending on which side it's closed/open
  useEffect(() => {
    let targetX = 0;
    if (currentSpreadIndex === 0) targetX = -(sheetWidth / 2);
    else if (currentSpreadIndex === totalSpreads) targetX = (sheetWidth / 2);

    if (groupRef.current) {
      gsap.to(groupRef.current.position, { x: targetX, duration: 1.0, ease: 'power2.inOut' });
    }
  }, [currentSpreadIndex, totalSpreads, sheetWidth]);

  const filteredPages       = useBookStore(state => state.filteredPages);

  const interiorPages = useMemo(() => {
    if (filteredPages) {
      if (useNativeCover) return filteredPages.filter(p => p > 1 && p < totalPages).sort((a,b) => a - b);
      return [...filteredPages].sort((a,b) => a - b);
    } else {
      if (useNativeCover) return Array.from({ length: Math.max(0, totalPages - 2) }, (_, i) => i + 2);
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
  }, [filteredPages, totalPages, useNativeCover]);

  const sheets = Array.from({ length: totalSpreads }).map((_, i) => {
    const isCover     = i === 0;
    const isBackCover = i === totalSpreads - 1;

    let front = null, back = null;

    if (isCover && useNativeCover) {
      // Cover EXTERIOR (mat-4) = page 1
      back = 1;

    } else if (isBackCover && useNativeCover) {
      // Back cover EXTERIOR (mat-5) = totalPages
      back = totalPages;

    } else if (!isCover && !isBackCover) {
      const interiorIndex = i - 1; // since i=0 is the cover
      front = interiorPages[interiorIndex * 2] || null;
      back  = interiorPages[interiorIndex * 2 + 1] || null;
    }

    return { index: i, isCover, isBackCover, pdfFrontPageNum: front, pdfBackPageNum: back, useNativeCover };
  });

  return (
    <group ref={groupRef} position={[-(sheetWidth / 2), 0, 0]}>
      {sheets.map(s => (
        <Sheet
          key={s.index}
          index={s.index}
          isCover={s.isCover}
          isBackCover={s.isBackCover}
          pdfFrontPageNum={s.pdfFrontPageNum}
          pdfBackPageNum={s.pdfBackPageNum}
          useNativeCover={s.useNativeCover}
        />
      ))}
    </group>
  );
}
