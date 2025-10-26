import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

interface PDFViewerProps {
  documentId: string;
  userId: string;
  filename: string;
}

const PDFViewer = forwardRef(({ documentId, userId, filename }: PDFViewerProps, ref) => {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useImperativeHandle(ref, () => ({
    scrollToPage(pageNumber: number) {
      if (pageNumber >= 1 && pageNumber <= numPages && pageRefs.current[pageNumber - 1]) {
        pageRefs.current[pageNumber - 1]?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    },
  }));

  useEffect(() => {
    loadPDF();
  }, [documentId, userId, filename]);

  useEffect(() => {
    if (pdfDoc && numPages > 0) {
      calculateScaleAndRender();
    }
  }, [pdfDoc, numPages]);

  // Handle window resize to recalculate scale
  useEffect(() => {
    if (!pdfDoc) return;

    const handleResize = () => {
      calculateScaleAndRender();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pdfDoc, numPages]);

  const calculateScaleAndRender = async () => {
    if (!pdfDoc || !containerRef.current) return;

    try {
      // Get the first page to calculate dimensions
      const firstPage = await pdfDoc.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1 });
      
      // Calculate scale to fit container width with padding
      const containerWidth = containerRef.current.clientWidth;
      const padding = 32; // 16px on each side
      const availableWidth = containerWidth - padding;
      const calculatedScale = availableWidth / viewport.width;
      
      // Set the scale and render
      setScale(calculatedScale);
      
      // Small delay to ensure scale is set before rendering
      setTimeout(() => {
        renderAllPages(calculatedScale);
      }, 100);
    } catch (error) {
      console.error('Error calculating scale:', error);
      renderAllPages(1.5); // Fallback to default scale
    }
  };

  const loadPDF = async () => {
    try {
      setLoading(true);
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const objectKey = `${userId}/${documentId}/${filename}`;
      const minioUrl = `http://localhost:9000/textbook-pdfs/${objectKey}`;
      
      console.log('Loading PDF from:', minioUrl);
      
      const loadingTask = pdfjsLib.getDocument(minioUrl);
      const pdf = await loadingTask.promise;
      
      console.log(`PDF loaded: ${pdf.numPages} pages`);
      
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      pageRefs.current = new Array(pdf.numPages);
      setLoading(false);
    } catch (error) {
      console.error('Error loading PDF:', error);
      setLoading(false);
    }
  };

  const renderAllPages = async (renderScale?: number) => {
    if (!pdfDoc) return;

    const scaleToUse = renderScale || scale;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const canvas = pageRefs.current[pageNum - 1];
      if (!canvas) continue;

      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: scaleToUse, rotation: 0 });

        const context = canvas.getContext('2d');
        if (!context) continue;
        
        // Set canvas dimensions
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Fill with white background to prevent transparency issues
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        console.log(`Page ${pageNum} rendered at scale ${scaleToUse}`);
      } catch (error) {
        console.error(`Error rendering page ${pageNum}:`, error);
      }
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Loading PDF...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-gray-100 dark:bg-gray-900">
      {/* Scrollable container with all pages */}
      <div className="flex flex-col items-center py-4 space-y-4 w-full">
        {Array.from({ length: numPages }, (_, index) => (
          <div key={index} className="relative shadow-lg w-full flex justify-center">
            <canvas
              ref={(el) => (pageRefs.current[index] = el)}
              className="block max-w-full h-auto bg-white"
              style={{ display: 'block' }}
            />
            {/* Page number badge */}
            <div className="absolute top-2 right-2 bg-black dark:bg-white bg-opacity-70 dark:bg-opacity-70 text-white dark:text-black px-2 py-1 rounded text-xs font-medium">
              Page {index + 1} of {numPages}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

PDFViewer.displayName = 'PDFViewer';

export default PDFViewer;
