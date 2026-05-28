import { Canvas, useThree } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls } from '@react-three/drei';
import BookGroup from './book/BookGroup';
import useBookStore from '../store/useBookStore';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

// Sets the initial camera zoom to fit the book, without fighting 3D controls
function AdaptiveCamera({ controlsRef }) {
  const { camera, size } = useThree();
  const focusCameraTrigger = useBookStore(state => state.focusCameraTrigger);
  const zoomInTrigger = useBookStore(state => state.zoomInTrigger);
  const zoomOutTrigger = useBookStore(state => state.zoomOutTrigger);
  const setCameraZoom = useBookStore(state => state.setCameraZoom);

  useEffect(() => {
    // Only set initial zoom if we don't have one or if screen height changed
    const targetZoom = (size.height * 0.85) / 4.24;

    gsap.to(camera, {
      zoom: targetZoom,
      duration: 0.4,
      ease: 'power2.out',
      onUpdate: () => {
        camera.updateProjectionMatrix();
        setCameraZoom(camera.zoom);
      }
    });

    gsap.to(camera.position, {
      x: 0, y: 0,
      duration: 0.4,
      ease: 'power2.out',
      onUpdate: () => {
        useBookStore.getState().setCameraPosition({ x: camera.position.x, y: camera.position.y });
      }
    });
    if (controlsRef && controlsRef.current) {
      gsap.to(controlsRef.current.target, {
        x: 0, y: 0, z: 0,
        duration: 0.4,
        ease: 'power2.out',
      });
    }
  }, [size.height, camera, focusCameraTrigger, controlsRef]);

  useEffect(() => {
    if (zoomInTrigger === 0) return;
    const targetZoom = Math.min(camera.zoom * 1.2, 2500);
    gsap.to(camera, {
      zoom: targetZoom,
      duration: 0.25,
      ease: 'power2.out',
      onUpdate: () => {
        camera.updateProjectionMatrix();
        setCameraZoom(camera.zoom);
        if (controlsRef.current) controlsRef.current.update();
      }
    });
  }, [zoomInTrigger]);

  useEffect(() => {
    if (zoomOutTrigger === 0) return;
    const targetZoom = Math.max(camera.zoom / 1.2, 10);
    gsap.to(camera, {
      zoom: targetZoom,
      duration: 0.25,
      ease: 'power2.out',
      onUpdate: () => {
        camera.updateProjectionMatrix();
        setCameraZoom(camera.zoom);
        if (controlsRef.current) controlsRef.current.update();
      }
    });
  }, [zoomOutTrigger]);

  useEffect(() => {
    const handleWheel = (e) => {
      // 0. If the wheel originated inside a panel/modal, let the DOM element handle it.
      //    Elements opt-in by adding data-no-pan="true" to their container.
      if (e.target && e.target.closest && e.target.closest('[data-no-pan]')) {
        return;
      }

      // 1. If it's a pinch gesture (Ctrl key is true):
      //    We let OrbitControls handle it to zoom.
      if (e.ctrlKey) {
        return;
      }

      // Detect if the event is from a trackpad or a standard mouse wheel.
      // Standard mouse wheels scroll in discrete steps (usually multiples of 100 or 120).
      // Trackpads scroll in continuous, small, or fractional increments, often horizontally too.
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);
      const isTrackpad = (absX > 0) || (absY > 0 && absY < 50) || (absY % 100 !== 0 && absY % 120 !== 0);

      if (!isTrackpad) {
        // Standard mouse wheel: let it propagate to OrbitControls to zoom!
        return;
      }

      // 2. If it's a two-finger trackpad drag/scroll:
      //    We prevent page scrolling and block OrbitControls from zooming.
      e.preventDefault();
      e.stopPropagation();

      const scaleFactor = 1.0;
      const dx = (e.deltaX / camera.zoom) * scaleFactor;
      const dy = (e.deltaY / camera.zoom) * scaleFactor;

      camera.position.x += dx;
      camera.position.y -= dy;

      if (controlsRef.current) {
        controlsRef.current.target.x += dx;
        controlsRef.current.target.y -= dy;
        controlsRef.current.update();
      }

      // Update the camera position in the store so HUD knows where it is
      useBookStore.getState().setCameraPosition({
        x: camera.position.x,
        y: camera.position.y
      });
    };

    // Use capture phase so we intercept before OrbitControls
    const target = document.body;
    target.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      target.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, [camera, controlsRef]);

  return <OrthographicCamera makeDefault position={[0, 0, 10]} />;
}

export default function Theatre() {
  const controlsRef = useRef();
  const nextSpread = useBookStore(state => state.nextSpread);
  const prevSpread = useBookStore(state => state.prevSpread);
  const closePdf = useBookStore(state => state.closePdf);
  const isBookmarkMode = useBookStore(state => state.isBookmarkMode);
  const isTextSelectMode = useBookStore(state => state.isTextSelectMode);
  const isEditingPostit = useBookStore(state => state.isEditingPostit);

  // Global Keyboard listener (all queuing into targetSpreadIndex)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const state = useBookStore.getState();
      if (state.isTextSelectMode || state.isEditingPostit || state.isCutMode || state.isPasteMode) return; // Block keyboard navigation
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSpread();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSpread();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closePdf();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        state.triggerZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        state.triggerZoomOut();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSpread, prevSpread, closePdf, isTextSelectMode, isEditingPostit]);

  return (
    <Canvas
      dpr={[1, 2]}
      className={`w-full h-full ${isTextSelectMode ? 'cursor-text' : isBookmarkMode ? '' : 'cursor-grab active:cursor-grabbing'}`}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={['#CCC3BE']} />
      <AdaptiveCamera controlsRef={controlsRef} />
      <ambientLight intensity={2.5} color="#FFFFFF" />
      <directionalLight position={[0, 0, 10]} intensity={1.5} color="#FFFFFF" />
      <BookGroup />
      {/* Scroll wheel zoom and right-click pan */}
      <OrbitControls
        ref={controlsRef}
        domElement={document.body}
        enableRotate={false}
        enablePan={true}
        enableZoom={true}
        zoomSpeed={1.5}
        panSpeed={1.2}
        mouseButtons={{ LEFT: -1, MIDDLE: -1, RIGHT: 2 }}
        onChange={(e) => {
          useBookStore.getState().setCameraZoom(e.target.object.zoom);
          useBookStore.getState().setCameraPosition({
            x: e.target.object.position.x,
            y: e.target.object.position.y
          });
        }}
      />
    </Canvas>
  );
}
