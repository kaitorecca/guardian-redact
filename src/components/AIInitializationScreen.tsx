import React, { useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Brain, Download, CheckCircle, AlertCircle } from 'lucide-react'

interface InitializationStatus {
  status: string // "initializing", "downloading_model", "ready", "error"
  message: string
}

interface AIInitializationScreenProps {
  onComplete: () => void
}

const AIInitializationScreen: React.FC<AIInitializationScreenProps> = ({ onComplete }) => {
  const [status, setStatus] = useState<InitializationStatus | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initializeAI = async () => {
    try {
      setIsInitializing(true)
      setError(null)
      setStatus({ status: 'initializing', message: 'Starting AI engine...' })

      const result = await invoke<InitializationStatus>('initialize_ai_engine')
      setStatus(result)

      if (result.status === 'ready') {
        setTimeout(() => {
          onComplete()
        }, 2000)
      } else if (result.status === 'error') {
        setError(result.message)
      }
    } catch (err) {
      console.error('AI initialization error:', err)
      setError(`Failed to initialize AI engine: ${err}`)
    } finally {
      setIsInitializing(false)
    }
  }

  const getStatusIcon = () => {
    switch (status?.status) {
      case 'initializing':
        return <Brain className="w-6 h-6 animate-pulse text-blue-500" />
      case 'downloading_model':
        return <Download className="w-6 h-6 animate-bounce text-orange-500" />
      case 'ready':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-500" />
      default:
        return <Brain className="w-6 h-6 text-gray-400" />
    }
  }

  const getProgressValue = () => {
    switch (status?.status) {
      case 'initializing':
        return 25
      case 'downloading_model':
        return 75
      case 'ready':
        return 100
      case 'error':
        return 0
      default:
        return 0
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-2xl">Guardian Redact</CardTitle>
          <p className="text-muted-foreground">AI-Powered Document Protection with Gemma 3n</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {!status && !error && (
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                Click the button below to initialize the AI engine with Gemma 3n and Ollama. This may take a few minutes on first run.
              </p>
              <Button 
                onClick={initializeAI} 
                disabled={isInitializing}
                className="w-full"
              >
                <Brain className="w-4 h-4 mr-2" />
                Initialize AI Engine
              </Button>
            </div>
          )}

          {status && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="font-medium mb-2">{status.message}</p>
                <Progress value={getProgressValue()} className="mb-4" />
                
                {status.status === 'downloading_model' && (
                  <p className="text-sm text-muted-foreground">
                    Downloading Gemma 3n model... This may take several minutes depending on your internet connection.
                  </p>
                )}
                
                {status.status === 'ready' && (
                  <p className="text-sm text-green-600">
                    ✅ AI engine with Gemma 3n is ready! Launching application...
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="space-y-4">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-red-600 font-medium mb-2">Initialization Failed</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button 
                  onClick={() => {
                    setError(null)
                    setStatus(null)
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {status?.status === 'initializing' && (
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AIInitializationScreen
