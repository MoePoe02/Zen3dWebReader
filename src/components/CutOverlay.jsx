import React, { useState, useRef, useEffect } from 'react';
import useBookStore from '../store/useBookStore';

export default function CutOverlay() {
  const isCutMode = useBookStore(state => state.isCutMode);
  const toggleCutMode = useBookStore(state => state.toggleCutMode);
  const setCutImage = useBookStore(state => state.setCutImage);

  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });

  if (!isCutMode) return null;

  const handlePointerDown = (e) => {
    e.preventDefault();
    if (e.button !== 0) return; // Only left click
    setIsDrawing(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const endX = e.clientX;
    const endY = e.clientY;

    const rect = {
      x: Math.min(startPos.x, endX),
      y: Math.min(startPos.y, endY),
      width: Math.abs(endX - startPos.x),
      height: Math.abs(endY - startPos.y)
    };

    if (rect.width < 10 || rect.height < 10) {
      // Ignorar recortes muy pequeños
      toggleCutMode();
      return;
    }

    try {
      const webglCanvas = document.querySelector('canvas');
      if (!webglCanvas) throw new Error('No canvas found');

      // Obtener el DPR exacto que usa React Three Fiber (restringido a [1, 2])
      const canvasDpr = Math.min(2, window.devicePixelRatio || 1);

      const sx = Math.round(rect.x * canvasDpr);
      const sy = Math.round(rect.y * canvasDpr);
      const sw = Math.round(rect.width * canvasDpr);
      const sh = Math.round(rect.height * canvasDpr);

      const tempCanvas = document.createElement('canvas');
      // Forzar alta resolución extra (supersampling manual)
      const exportScale = 2; 
      tempCanvas.width = sw * exportScale;
      tempCanvas.height = sh * exportScale;
      
      const ctx = tempCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Cortar del canvas original y dibujar escalado
      ctx.drawImage(webglCanvas, sx, sy, sw, sh, 0, 0, tempCanvas.width, tempCanvas.height);
      
      const dataUrl = tempCanvas.toDataURL('image/png');
      const state = useBookStore.getState();
      const zoom = state.cameraZoom || 1;
      const initial3DWidth = rect.width / zoom;
      const aspect = rect.width / rect.height;

      setCutImage({ src: dataUrl, initial3DWidth, aspectRatio: aspect });
      
      // Salir del modo de corte y entrar a pegar automáticamente
      useBookStore.setState({ isCutMode: false, isPasteMode: true, isPostitMode: false });
      tempCanvas.toBlob(blob => {
        if (blob) {
          try {
            navigator.clipboard.write([
              new window.ClipboardItem({ 'image/png': blob })
            ]).catch(err => console.warn('Clipboard write failed', err));
          } catch(e) {
            console.warn('Clipboard API not supported');
          }
        }
      });
    } catch (err) {
      console.error('Error capturing screen:', err);
      useBookStore.setState({ isCutMode: false, isPostitMode: true });
    }
  };

  const x = Math.min(startPos.x, currentPos.x);
  const y = Math.min(startPos.y, currentPos.y);
  const width = Math.abs(currentPos.x - startPos.x);
  const height = Math.abs(currentPos.y - startPos.y);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100, // Debajo del HUD (200) pero encima del Canvas
        cursor: 'crosshair',
        background: 'rgba(0,0,0,0.1)'
      }}
    >
      {isDrawing && (
        <div
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: width,
            height: height,
            border: '2px dashed #906E50',
            backgroundColor: 'rgba(144, 110, 80, 0.2)',
            pointerEvents: 'none'
          }}
        />
      )}
    </div>
  );
}
