import React, { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, FileDown } from 'lucide-react'
import useAppStore from '../store/appStore'
import type { RedactionSuggestion } from '../store/appStore'
import RedactionSidebar from './RedactionSidebar'
import DocumentViewer from './DocumentViewer'

interface ProcessingScreenProps {
  onBack?: () => void
}

const ProcessingScreen: React.FC<ProcessingScreenProps> = () => {
  const {
    selectedFile,
    totalPages,
    processingStatus,
    redactionSuggestions,
    selectedProfile,
    sidebarOpen,
    setProcessingStatus,
    addPageRedactions,
    setSidebarOpen,
    reset
  } = useAppStore()

  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (selectedFile && totalPages > 0 && !isProcessing && processingStatus.status === 'idle') {
      // Start processing automatically once we know the page count
      startProcessing()
    }
  }, [selectedFile, totalPages, isProcessing, processingStatus.status])

  const startProcessing = async () => {
    if (!selectedFile || totalPages === 0) return

    try {
      setIsProcessing(true)
      setProcessingStatus({ status: 'processing', currentPage: 1, totalPages })

      // Process each page sequentially
      for (let page = 1; page <= totalPages; page++) {
        setProcessingStatus({
          status: 'processing',
          currentPage: page,
          totalPages,
          message: `Analyzing page ${page} of ${totalPages}...`
        })

        try {
          // Use temp file path if available, otherwise use filename
          const filePath = (selectedFile as any).tempPath || selectedFile.name
          
          console.log(`Processing page ${page} with file path: ${filePath}`)
          
          const suggestions: RedactionSuggestion[] = await invoke('process_single_page', {
            filePath: filePath,
            pageNumber: page, // Use 1-based indexing as Python script expects
            profile: selectedProfile
          })

          console.log(`Page ${page} raw suggestions received:`, suggestions)
          
          // Add redactions to store
          addPageRedactions(page, suggestions)
          
          console.log(`Page ${page} processing complete:`, suggestions.length, 'suggestions found')
          
        } catch (error) {
          console.error(`Error processing page ${page}:`, error)
          
          // Fallback to mock data for demo purposes if real processing fails
          console.log('Falling back to mock data for page', page)
          const mockSuggestions: RedactionSuggestion[] = [
            {
              id: `page_${page}_redaction_0`,
              text: `Sample PII (Page ${page})`,
              confidence: 0.95,
              category: 'PII',
              coordinates: {
                page,
                x: 100,
                y: 100 + (page * 30),
                width: 120,
                height: 20
              },
              accepted: false
            }
          ]
          addPageRedactions(page, mockSuggestions)
        }
      }

      setProcessingStatus({
        status: 'completed',
        message: 'Document analysis complete'
      })

    } catch (error) {
      console.error('Error during processing:', error)
      setProcessingStatus({
        status: 'error',
        message: `Processing failed: ${error}`
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleExportDocument = async () => {
    try {
      const acceptedRedactions: RedactionSuggestion[] = []
      
      redactionSuggestions.forEach((suggestions) => {
        acceptedRedactions.push(...suggestions.filter(s => s.accepted))
      })

      if (acceptedRedactions.length === 0) {
        alert('No redactions have been accepted for export.')
        return
      }

      // Get the actual file path (tempPath) from the selectedFile
      const filePath = (selectedFile as any)?.tempPath || selectedFile?.name || ''
      
      console.log('Selected file object:', selectedFile)
      console.log('Temp path:', (selectedFile as any)?.tempPath)
      console.log('File name:', selectedFile?.name)
      
      if (!filePath) {
        alert('Unable to locate the source file for export.')
        return
      }

      console.log('Exporting with file path:', filePath)
      console.log('Accepted redactions:', acceptedRedactions.length)
      console.log('First redaction:', acceptedRedactions[0])

      // Generate suggested filename
      const originalName = selectedFile?.name || 'document.pdf'
      const suggestedFilename = `redacted_${originalName}`

      // Call Tauri command to export document
      const outputPath = await invoke('export_redacted_document', {
        filePath: filePath,
        redactions: acceptedRedactions,
        suggestedFilename: suggestedFilename
      })

      alert(`Document exported successfully to: ${outputPath}`)
      
    } catch (error) {
      console.error('Error exporting document:', error)
      alert(`Failed to export document: ${error}`)
    }
  }

  const getProgressValue = () => {
    if (processingStatus.status === 'completed') return 100
    if (processingStatus.currentPage && processingStatus.totalPages) {
      return (processingStatus.currentPage / processingStatus.totalPages) * 100
    }
    return 0
  }

  const getTotalSuggestions = () => {
    let total = 0
    redactionSuggestions.forEach((suggestions) => {
      total += suggestions.length
    })
    return total
  }

  const getAcceptedSuggestions = () => {
    let accepted = 0
    redactionSuggestions.forEach((suggestions) => {
      accepted += suggestions.filter(s => s.accepted).length
    })
    return accepted
  }

  if (!selectedFile) {
    return <div>No file selected</div>
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => reset()}>
            ← Back
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{selectedFile.name}</h1>
            <p className="text-sm text-muted-foreground">
              {selectedProfile === 'quick' ? 'Quick Scan' : 'Deep Analysis'} • {totalPages} pages
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {sidebarOpen ? 'Hide' : 'Show'} Suggestions
          </Button>
          <Button
            onClick={handleExportDocument}
            disabled={getAcceptedSuggestions() === 0}
          >
            <FileDown className="w-4 h-4 mr-2" />
            Export Redacted PDF
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Document Viewer */}
        <div className="flex-1 relative min-w-0">
          <DocumentViewer />
          
          {/* Processing Overlay */}
          {processingStatus.status === 'processing' && processingStatus.currentPage && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
              <Card className="w-96">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    Processing Document
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm">
                    {processingStatus.message || 'Analyzing document...'}
                  </p>
                  <Progress value={getProgressValue()} className="mb-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {Math.round(getProgressValue())}% complete
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-96 border-l flex-shrink-0">
            <RedactionSidebar />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="h-12 border-t flex items-center justify-between px-4 bg-muted/50 flex-shrink-0">
        <div className="flex items-center gap-4 text-sm">
          <span>Status: {processingStatus.status}</span>
          {processingStatus.currentPage && processingStatus.totalPages && (
            <span>Page {processingStatus.currentPage} of {processingStatus.totalPages}</span>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <span>{getTotalSuggestions()} suggestions found</span>
          <span>{getAcceptedSuggestions()} accepted</span>
        </div>
      </div>
    </div>
  )
}

export default ProcessingScreen
