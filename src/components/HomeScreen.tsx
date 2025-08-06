import { FileText, Mic } from 'lucide-react'
import { Button } from './ui/button'

interface HomeScreenProps {
  onSelectMode: (mode: 'document' | 'audio') => void
}

export function HomeScreen({ onSelectMode }: HomeScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full text-center">
        {/* Logo and Title */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Guardian Redact
          </h1>
          <p className="text-xl text-gray-600">
            Your Private, Offline Redaction Suite
          </p>
        </div>

        {/* Subtitle */}
        <div className="mb-16">
          <h2 className="text-2xl text-gray-700 mb-8">
            Choose a tool to get started:
          </h2>
        </div>

        {/* Mode Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Document Redaction Card */}
          <div 
            className="bg-white rounded-xl shadow-lg p-8 cursor-pointer hover:shadow-xl transition-shadow border-2 border-transparent hover:border-blue-200"
            onClick={() => onSelectMode('document')}
          >
            <div className="flex flex-col items-center">
              <div className="bg-blue-100 rounded-full p-6 mb-6">
                <FileText className="w-12 h-12 text-blue-600" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                Redact a Document
              </h3>
              <p className="text-gray-600 text-center leading-relaxed">
                Analyze PDFs, automatically identify and redact sensitive information. Support multilanguage documents.
              </p>
              <Button 
                className="mt-6 w-full"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectMode('document')
                }}
              >
                Start Document Redaction
              </Button>
            </div>
          </div>

          {/* Audio Redaction Card */}
          <div 
            className="bg-white rounded-xl shadow-lg p-8 cursor-pointer hover:shadow-xl transition-shadow border-2 border-transparent hover:border-green-200"
            onClick={() => onSelectMode('audio')}
          >
            <div className="flex flex-col items-center">
              <div className="bg-green-100 rounded-full p-6 mb-6">
                <Mic className="w-12 h-12 text-green-600" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                Redact an Audio File
              </h3>
              <p className="text-gray-600 text-center leading-relaxed">
                Transcribe and analyze MP3 files. 
                Silence or Beep sections containing sensitive information.
              </p>
              <Button 
                className="mt-6 w-full bg-green-600 hover:bg-green-700"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectMode('audio')
                }}
              >
                Start Audio Redaction
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-sm text-gray-500">
          <p>All processing happens locally on your device. Your files never leave your computer.</p>
        </div>
      </div>
    </div>
  )
}
