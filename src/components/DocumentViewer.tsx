import React, { useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown, ZoomIn, ZoomOut } from 'lucide-react'
import useAppStore from '../store/appStore'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'
import '../pdf-styles.css'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

// Stores dimensions of the rendered PDF page and its native size
interface RenderedPageSize {
  width: number;
  height: number;
  nativeWidth: number;
  nativeHeight: number;
}

const DocumentViewer: React.FC = () => {
  const { 
    selectedFile, 
    setTotalPages, 
    redactionSuggestions, 
    processingStatus,
    selectedRedaction,
    setSelectedRedaction 
  } = useAppStore()
  
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(0.8) // Start with smaller scale
  const [numPages, setNumPages] = useState<number | null>(null)
  // Track rendered page size to compute overlay positions after render
  const [renderedPageSize, setRenderedPageSize] = useState<RenderedPageSize | null>(null)

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    console.log('PDF loaded with', numPages, 'pages')
    setNumPages(numPages)
    setTotalPages(numPages)
  }, [setTotalPages])

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error)
  }
  
  // Callback fired when a page finishes rendering to capture its dimensions
  const onRenderSuccess = useCallback((page: any) => {
    console.log('onRenderSuccess called with page:', page)
    const pdfPageElement = document.querySelector('.react-pdf__Page') as HTMLElement | null
    const canvas = pdfPageElement?.querySelector('canvas') as HTMLCanvasElement | null
    if (canvas) {
      const renderedSize = {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        nativeWidth: page.originalWidth || page.width,  // Try to get original dimensions
        nativeHeight: page.originalHeight || page.height,
      }
      console.log('Page dimensions - rendered:', canvas.clientWidth, 'x', canvas.clientHeight)
      console.log('Page dimensions - native:', renderedSize.nativeWidth, 'x', renderedSize.nativeHeight)
      console.log('Current scale setting:', scale)
      setRenderedPageSize(renderedSize)
    } else {
      console.log('Could not find canvas element')
    }
  }, [scale])

  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= (numPages || 1)) {
      setCurrentPage(pageNumber)
      setSelectedRedaction(null) // Clear selection when changing pages
      setRenderedPageSize(null)   // Reset stored size on page change
    }
  }

  const zoomIn = () => {
    setRenderedPageSize(null)
    setScale(prev => Math.min(prev + 0.1, 2.0)) // Smaller increments
  }
  const zoomOut = () => {
    setRenderedPageSize(null)
    setScale(prev => Math.max(prev - 0.1, 0.3)) // Allow smaller minimum
  }

  const getCurrentPageRedactions = () => {
    const pageRedactions = redactionSuggestions.get(currentPage) || []
    return pageRedactions
  }

  const renderRedactionOverlays = () => {
    const pageRedactions = getCurrentPageRedactions()
    
    // Only render overlays if we have the rendered page dimensions
    if (!renderedPageSize) {
      return null
    }
    
    return pageRedactions.map(redaction => {
      const isSelected = selectedRedaction?.id === redaction.id
      const isAccepted = redaction.accepted
      
      // Use the actual page dimensions from the PDF instead of assuming US Letter
      // The renderedPageSize.nativeWidth/nativeHeight should be the true PDF dimensions
      const pdfNativeWidth = renderedPageSize.nativeWidth
      const pdfNativeHeight = renderedPageSize.nativeHeight
      
      // Calculate scaling factors based on rendered size vs actual PDF native size
      const scaleX = renderedPageSize.width / pdfNativeWidth
      const scaleY = renderedPageSize.height / pdfNativeHeight
      
      // Apply scaling directly - PyMuPDF coordinates should be in PDF native coordinate space
      const displayX = redaction.coordinates.x * scaleX  +16 // Add padding to avoid edge clipping
      const displayY = redaction.coordinates.y * scaleY + 16 // Add padding to avoid edge clipping
      const displayWidth = redaction.coordinates.width * scaleX
      const displayHeight = redaction.coordinates.height * scaleY
      
      return (
        <div
          key={redaction.id}
          className={`absolute cursor-pointer transition-all pointer-events-auto ${
            isSelected 
              ? 'border-2 border-blue-500 bg-blue-100/30 z-20' 
              : isAccepted 
                ? 'bg-black z-15' // Black-filled for accepted redactions to hide content
                : 'border-2 border-red-500 bg-red-100/30 hover:bg-red-100/50 z-10'
          }`}
          style={{
            left: displayX,
            top: displayY,
            width: displayWidth,
            height: displayHeight,
            transform: 'translateZ(0)' // GPU acceleration
          }}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedRedaction(redaction)
          }}
        >
          {/* Enhanced debugging with more details */}
          {isSelected && (
            <div className="absolute -top-20 left-0 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none z-30">
              <div>PDF: ({redaction.coordinates.x.toFixed(1)}, {redaction.coordinates.y.toFixed(1)})</div>
              <div>Native: {pdfNativeWidth.toFixed(0)}x{pdfNativeHeight.toFixed(0)}</div>
              <div>Rendered: {renderedPageSize.width.toFixed(0)}x{renderedPageSize.height.toFixed(0)}</div>
              <div>Scale: {scaleX.toFixed(3)}x, {scaleY.toFixed(3)}x</div>
              <div>Display: ({displayX.toFixed(1)}, {displayY.toFixed(1)})</div>
            </div>
          )}
        </div>
      )
    })
  }

  const isCurrentPageProcessing = () => {
    return processingStatus.status === 'processing' && 
           processingStatus.currentPage === currentPage
  }

  if (!selectedFile) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/50">
        <p className="text-muted-foreground">No document selected</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-muted/50">
      {/* Controls */}
      <div className="flex items-center justify-between p-4 bg-background border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {numPages || '?'}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= (numPages || 1)}
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Document Container - Better overflow handling and max width constraints */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="flex justify-center h-full overflow-auto">
          <div className="relative" style={{ maxWidth: '100%' }}>
            {selectedFile && (
              <Document
                file={selectedFile}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="w-[600px] h-[800px] bg-white border border-muted flex items-center justify-center">
                    <p className="text-muted-foreground">Loading PDF...</p>
                  </div>
                }
                className="max-w-full"
              >
              <Page
                pageNumber={currentPage}
                scale={scale}
                onRenderSuccess={onRenderSuccess}
                  loading={
                    <div className="w-[600px] h-[800px] bg-white border border-muted flex items-center justify-center">
                      <p className="text-muted-foreground">Loading page...</p>
                    </div>
                  }
                  className="border border-muted shadow-lg max-w-full"
                  // Remove the fixed width constraint that was causing layout issues
                />
              </Document>
            )}
            
            {/* Redaction Overlays */}
            {renderRedactionOverlays()}
            
            {/* Processing Overlay for Current Page */}
            {isCurrentPageProcessing() && (
              <div className="absolute inset-0 bg-blue-100/30 border-2 border-blue-500 flex items-center justify-center">
                <div className="bg-white p-4 rounded-lg shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Analyzing this page...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DocumentViewer
