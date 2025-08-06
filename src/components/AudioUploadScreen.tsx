import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, ArrowLeft } from 'lucide-react'
import { Button } from './ui/button'

interface AudioUploadScreenProps {
  onFileSelect: (file: File) => void
  onBack: () => void
}

export function AudioUploadScreen({ onFileSelect, onBack }: AudioUploadScreenProps) {
  const [dragActive, setDragActive] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file && file.type.startsWith('audio/')) {
      onFileSelect(file)
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/mpeg': ['.mp3'],
      'audio/wav': ['.wav'],
      'audio/mp4': ['.m4a'],
      'audio/ogg': ['.ogg']
    },
    multiple: false,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col">
      {/* Header */}
      <div className="flex items-center p-6 bg-white shadow-sm">
        <Button
          variant="ghost"
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Button>
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Audio Redaction</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all duration-200
              ${isDragActive || dragActive
                ? 'border-green-500 bg-green-50 scale-105'
                : 'border-gray-300 bg-white hover:border-green-400 hover:bg-green-50'
              }
            `}
          >
            <input {...getInputProps()} />
            
            <div className="flex flex-col items-center">
              <div className={`
                rounded-full p-8 mb-6 transition-colors
                ${isDragActive || dragActive
                  ? 'bg-green-200'
                  : 'bg-green-100'
                }
              `}>
                <Upload className={`
                  w-16 h-16 transition-colors
                  ${isDragActive || dragActive
                    ? 'text-green-700'
                    : 'text-green-600'
                  }
                `} />
              </div>

              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                {isDragActive ? 'Drop your audio file here' : 'Upload your audio file'}
              </h2>

              <p className="text-gray-600 mb-8 text-lg">
                Drag & drop your MP3, WAV, or M4A file here
              </p>

              <div className="text-center">
                <p className="text-gray-500 mb-4">or</p>
                <Button size="lg" className="bg-green-600 hover:bg-green-700">
                  Browse Files
                </Button>
              </div>

              <div className="mt-8 text-sm text-gray-500">
                <p>Supported formats: MP3, WAV, M4A, OGG</p>
                <p className="mt-1">Maximum file size: 500MB</p>
              </div>
            </div>
          </div>

          {/* Features Preview */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-white rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 font-semibold">1</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Transcribe</h3>
              <p className="text-sm text-gray-600">
                AI transcribes your audio with precise word-level timestamps
              </p>
            </div>

            <div className="text-center p-6 bg-white rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-orange-600 font-semibold">2</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Analyze</h3>
              <p className="text-sm text-gray-600">
                Identify PII like names, addresses, phone numbers automatically
              </p>
            </div>

            <div className="text-center p-6 bg-white rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-green-600 font-semibold">3</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Redact</h3>
              <p className="text-sm text-gray-600">
                Silence, beep, or anonymize sensitive audio sections
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
