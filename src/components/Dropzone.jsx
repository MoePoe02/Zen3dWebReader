import { useState, useRef } from 'react';
import { UploadCloud } from 'lucide-react';
import useBookStore from '../store/useBookStore';
import { loadPdfDocument, clearTextureCache } from '../utils/pdfEngine';
import { extractZenState } from '../utils/pdfExporter';

export default function Dropzone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMSG, setErrorMSG] = useState('');
  
  const startLoading = useBookStore(state => state.startLoading);
  const loadPdf = useBookStore(state => state.loadPdf);
  const fileInputRef = useRef(null);

  const handleFileProcess = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setErrorMSG('Please provide a valid .pdf file.');
      return;
    }
    setErrorMSG('');
    clearTextureCache();
    startLoading();
    
    try {
      // Keep the raw bytes for export (pdf-lib needs them to build the output)
      const pdfBytes = await file.arrayBuffer();

      // Load the PDF with pdfjs (used for rendering)
      const pdfDoc = await loadPdfDocument(file);

      // Extract the aspect ratio from the first page
      const firstPage = await pdfDoc.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1.0 });
      const aspectRatio = viewport.width / viewport.height;
      firstPage.cleanup();

      // Check for an embedded Zen Reader state (pdfjs reads /EmbeddedFiles natively)
      const zenState = await extractZenState(pdfDoc);
      if (zenState) {
        console.log('[Dropzone] Restoring', zenState.postits?.length ?? 0, 'postits,', zenState.bookmarks?.length ?? 0, 'bookmarks.');
      }

      loadPdf(pdfDoc, pdfDoc.numPages, file.name, aspectRatio, pdfBytes, zenState);
    } catch (error) {
      console.error("PDF Parsing error:", error);
      setErrorMSG('Failed to parse PDF.');
      useBookStore.getState().closePdf();
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const clickInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-screen bg-[#FFFFFF] transition-opacity duration-500">
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        onClick={clickInput}
        className={`flex flex-col items-center justify-center w-[80vw] h-[60vh] max-w-2xl border-4 border-dashed rounded-3xl cursor-pointer transition-colors duration-300
          ${isDragOver ? 'border-[#5E6056] bg-[#F0EAE0]' : 'border-[#D1BBAA] bg-[#FAFAFA] hover:bg-[#F0EAE0]'}
        `}
      >
        <UploadCloud size={64} className="text-[#9A8C98] mb-6" />
        <h2 className="text-3xl font-serif text-[#4A4E69] mb-4 text-center px-4">
          Drop your PDF here to begin
        </h2>
        <p className="text-[#7D7C7A] text-lg font-sans">
          Or click to browse your files
        </p>
        
        {errorMSG && <p className="mt-6 text-red-500 font-medium">{errorMSG}</p>}
        
        <input 
          type="file" 
          accept="application/pdf"
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileProcess(e.target.files[0]);
            }
          }}
        />
      </div>
      <div className="mt-12 text-[#A89F91] text-sm max-w-md text-center">
        Processed locally. No servers. Supports rich 2K textures with anisotropic filtering.
      </div>
    </div>
  );
}
