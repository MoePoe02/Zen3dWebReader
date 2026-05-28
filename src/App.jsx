import useBookStore from './store/useBookStore';
import Dropzone from './components/Dropzone';
import Theatre from './components/Theatre';
import HUD from './components/HUD';
import TextSelectionOverlay from './components/book/TextSelectionOverlay';
import ThumbnailSidebar from './components/ThumbnailSidebar';
import CutOverlay from './components/CutOverlay';
import { useEffect } from 'react';

function App() {
  const appState = useBookStore(state => state.appState);

  useEffect(() => {
    let lastMouseX = window.innerWidth / 2;
    const handleMouseMove = (e) => {
      lastMouseX = e.clientX;
      // Any real mouse movement means we're not in touch mode
      if (useBookStore.getState().isTouchDevice) {
        useBookStore.getState().setIsTouchDevice(false);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Detect touch usage
    const handleTouchStart = () => {
      if (!useBookStore.getState().isTouchDevice) {
        useBookStore.getState().setIsTouchDevice(true);
      }
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });

    const handlePaste = (e) => {
      const state = useBookStore.getState();
      if (state.appState !== 'THEATRE') return;
      
      const items = e.clipboardData.items;
      let imageFile = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          imageFile = items[i].getAsFile();
          break;
        }
      }
      
      if (imageFile) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageSrc = event.target.result;
          const img = new Image();
          img.onload = () => {
            const aspectRatio = img.width / img.height;
            const state = useBookStore.getState();
            state.setCutImage({ src: imageSrc, aspectRatio });
            if (!state.isCutMode && !state.isPasteMode) {
              state.togglePasteMode();
            }
          };
          img.src = imageSrc;
        };
        reader.readAsDataURL(imageFile);
      }
    };

    const handleWheelZoom = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    const handleTouchZoom = (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('wheel', handleWheelZoom, { passive: false });
    window.addEventListener('touchmove', handleTouchZoom, { passive: false });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('wheel', handleWheelZoom);
      window.removeEventListener('touchmove', handleTouchZoom);
    };
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#e0dfcc] relative">
      {appState !== 'THEATRE' && (
        <div className={`absolute top-0 left-0 w-full h-full transition-opacity duration-700 ${appState === 'LOADING' ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          <Dropzone />
          {appState === 'LOADING' && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[#4A4E69] text-xl font-serif animate-pulse">
              Parsing PDF...
            </div>
          )}
        </div>
      )}
      
      {appState === 'THEATRE' && (
        <div className="absolute top-0 left-0 w-full h-full" onContextMenu={(e) => e.preventDefault()}>
          {/* 3D canvas layer */}
          <Theatre />
          {/* Thumbnail sidebar — collapsible left panel */}
          <ThumbnailSidebar />
          {/* Overlay for text selection (DOM layer above canvas) */}
          <TextSelectionOverlay />
          {/* Overlay for cutting (snipping tool) */}
          <CutOverlay />
          {/* HUD overlay — sits above everything via z-index */}
          <div className="absolute inset-0" style={{ zIndex: 200, pointerEvents: 'none' }}>
            <HUD />
          </div>
          {/* Branding — top left, above sidebar */}
          <span style={{
            position: 'fixed', top: 30, left: 32, zIndex: 220,
            color: '#B8AFA6', fontFamily: 'monospace', fontSize: 11,
            letterSpacing: '0.18em', textTransform: 'uppercase',
            pointerEvents: 'none', userSelect: 'none',
          }}>
            Zen 3D Web Reader
          </span>
        </div>
      )}
    </div>
  );
}

export default App;
