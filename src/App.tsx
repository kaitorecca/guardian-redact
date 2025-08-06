import { useState } from 'react'
import useAppStore from './store/appStore'
import useAudioStore from './store/audioStore'
import { HomeScreen } from './components/HomeScreen'
import FileUploadScreen from './components/FileUploadScreen'
import ProcessingScreen from './components/ProcessingScreen'
import AIInitializationScreen from './components/AIInitializationScreen'
import { AudioUploadScreen } from './components/AudioUploadScreen'
import { AudioProcessingScreen } from './components/AudioProcessingScreen'
import './globals.css'

type AppMode = 'home' | 'document' | 'audio'

function App() {
  const { selectedFile } = useAppStore()
  const { selectedAudioFile } = useAudioStore()
  const [appMode, setAppMode] = useState<AppMode>('home')
  const [isAIInitialized, setIsAIInitialized] = useState(false)

  const handleAIInitComplete = () => {
    setIsAIInitialized(true)
  }

  const handleModeSelect = (mode: 'document' | 'audio') => {
    setAppMode(mode)
  }

  const handleBackToHome = () => {
    setAppMode('home')
    // Reset stores
    useAppStore.getState().reset()
    useAudioStore.getState().reset()
  }

  const renderScreen = () => {
    // Step 1: AI Initialization (first time only)
    if (!isAIInitialized) {
      return <AIInitializationScreen onComplete={handleAIInitComplete} />
    }

    // Step 2: Mode selection or processing
    switch (appMode) {
      case 'home':
        return <HomeScreen onSelectMode={handleModeSelect} />
      
      case 'document':
        if (!selectedFile) {
          return <FileUploadScreen 
            onBack={handleBackToHome} 
          />
        }
        return <ProcessingScreen onBack={handleBackToHome} />
      
      case 'audio':
        if (!selectedAudioFile) {
          return <AudioUploadScreen 
            onFileSelect={(file) => useAudioStore.getState().setSelectedAudioFile(file)} 
            onBack={handleBackToHome} 
          />
        }
        return <AudioProcessingScreen onBack={handleBackToHome} />
      
      default:
        return <HomeScreen onSelectMode={handleModeSelect} />
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {renderScreen()}
    </div>
  )
}

export default App
