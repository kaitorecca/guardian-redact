import { useEffect } from 'react'
import { AudioEditor } from './AudioEditor'
import { AudioPIISidebar } from './AudioPIISidebar'
import useAudioStore from '../store/audioStore'

interface AudioProcessingScreenProps {
  onBack: () => void
}

export function AudioProcessingScreen({ onBack }: AudioProcessingScreenProps) {
  const { 
    selectedAudioFile,
    setAudioUrl
  } = useAudioStore()

  useEffect(() => {
    if (selectedAudioFile) {
      // Create URL for the audio file
      const url = URL.createObjectURL(selectedAudioFile)
      setAudioUrl(url)

      // Cleanup function
      return () => {
        URL.revokeObjectURL(url)
      }
    }
  }, [selectedAudioFile, setAudioUrl])

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        <AudioEditor onBack={onBack} />
      </div>
      
      {/* PII Sidebar */}
      <AudioPIISidebar />
    </div>
  )
}
