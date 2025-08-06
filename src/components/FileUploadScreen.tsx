import React, { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { Upload, FileText, ArrowLeft } from 'lucide-react'
import useAppStore from '../store/appStore'
import { Button } from './ui/button'

interface FileUploadScreenProps {
  onBack?: () => void
}

const FileUploadScreen: React.FC<FileUploadScreenProps> = ({ onBack }) => {
  const { setSelectedFile, setDocumentUrl, setSelectedProfile, selectedProfile } = useAppStore()

  const handleFileSelect = useCallback(async (file: File) => {
    if (file && file.type === 'application/pdf') {
      try {
        // Save file to temporary location for processing
        const fileContent = await file.arrayBuffer()
        const uint8Array = new Uint8Array(fileContent)
        
        // Call Tauri command to save file temporarily
        const tempFilePath: string = await invoke('save_temp_file', {
          fileName: file.name,
          fileData: Array.from(uint8Array)
        })
        
        // Create a File object with the temp path stored as a property
        const fileWithPath = Object.assign(file, { tempPath: tempFilePath })
        setSelectedFile(fileWithPath)
        
        // Create URL for PDF viewing
        const fileUrl = URL.createObjectURL(file)
        setDocumentUrl(fileUrl)
        
        console.log('File saved to temp location:', tempFilePath)
      } catch (error) {
        console.error('Error saving file:', error)
        // Fallback to original behavior
        setSelectedFile(file)
        const fileUrl = URL.createObjectURL(file)
        setDocumentUrl(fileUrl)
      }
    } else {
      alert('Please select a PDF file.')
    }
  }, [setSelectedFile, setDocumentUrl])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }, [])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with optional back button */}
      {onBack && (
        <div className="flex items-center p-6 bg-white shadow-sm">
          <Button
            variant="ghost"
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Button>
        </div>
      )}
      
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full text-center">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold mb-4">Guardian Redact</h1>
            <p className="text-xl text-muted-foreground mb-2">
              Privacy-first document redaction powered by Gemma 3n AI
            </p>
            <p className="text-muted-foreground">
              Your documents never leave your device. All processing happens offline.
            </p>
          </div>

        {/* Profile Selection */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Choose Redaction Profile</h3>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setSelectedProfile('quick')}
              className={`p-4 border-2 rounded-lg transition-colors ${
                selectedProfile === 'quick'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="font-semibold mb-2">Quick Scan</div>
              <div className="text-sm text-muted-foreground">
                Fast analysis for common sensitive data
              </div>
            </button>
            <button
              onClick={() => setSelectedProfile('deep')}
              className={`p-4 border-2 rounded-lg transition-colors ${
                selectedProfile === 'deep' 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              <div className="font-semibold mb-2">🔍 Deep Analysis [Future] </div>
              <div className="text-sm text-muted-foreground">
                Comprehensive analysis using Advanced Gemma 3n Model (Future)
              </div>
            </button>
          </div>
        </div>

        {/* File Upload Area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-border rounded-lg p-12 hover:border-primary/50 transition-colors cursor-pointer"
        >
          <div className="flex flex-col items-center">
            <div className="p-4 bg-primary/10 rounded-full mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Upload PDF Document</h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop your PDF here, or click to browse
            </p>
            
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileInputChange}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 mr-2" />
              Choose PDF File
            </label>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium">100% Offline Processing</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Your document is processed entirely on your device using local AI models.
            No data is sent to external servers.
          </p>
        </div>
      </div>
      </div>
    </div>
  )
}

export default FileUploadScreen
