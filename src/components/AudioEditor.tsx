import { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/plugins/regions'
import { Play, Pause, Volume2, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { Slider } from './ui/slider'
import { Progress } from './ui/progress'
import useAudioStore from '../store/audioStore'
import { invoke } from '@tauri-apps/api/tauri'

interface AudioEditorProps {
  onBack: () => void
}

export function AudioEditor({ onBack }: AudioEditorProps) {
  const {
    selectedAudioFile,
    audioUrl,
    duration,
    currentTime,
    isPlaying,
    volume,
    selectedRegion,
    piiSuggestions,
    redactions,
    processingStatus,
    setDuration,
    setCurrentTime,
    setIsPlaying,
    setVolume,
    setSelectedRegion,
    setProcessingStatus,
    setTranscript,
    setFormattedTranscript,
    setPiiSuggestions,
    addRedaction
  } = useAudioStore()

  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const regionsRef = useRef<RegionsPlugin | null>(null)

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || !audioUrl) return

    // Create regions plugin
    const regions = RegionsPlugin.create()
    regionsRef.current = regions

    // Initialize WaveSurfer
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#4f46e5',
      progressColor: '#06b6d4',
      cursorColor: '#ef4444',
      barWidth: 2,
      barRadius: 3,
      height: 80,
      normalize: true,
      plugins: [regions]
    })

    wavesurferRef.current = wavesurfer

    // Load audio
    wavesurfer.load(audioUrl)

    // Event listeners
    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration())
      // Add initial regions after waveform is ready
      addRegionsToWaveform()
    })

    wavesurfer.on('audioprocess', (time) => {
      setCurrentTime(time)
    })

    wavesurfer.on('play', () => {
      setIsPlaying(true)
    })

    wavesurfer.on('pause', () => {
      setIsPlaying(false)
    })

    // Region selection
    let isSelecting = false
    let selectionStart = 0

    wavesurfer.on('interaction', (time) => {
      if (!isSelecting) {
        isSelecting = true
        selectionStart = time
        // Clear existing selection
        regions.clearRegions()
        setSelectedRegion(null)
        // Re-add PII and redaction regions
        addRegionsToWaveform()
      }
    })

    wavesurfer.on('drag', (time) => {
      if (isSelecting && Math.abs(time - selectionStart) > 0.1) {
        // Clear existing regions
        regions.clearRegions()
        
        const start = Math.min(selectionStart, time)
        const end = Math.max(selectionStart, time)
        
        // Create selection region
        regions.addRegion({
          start,
          end,
          color: 'rgba(59, 130, 246, 0.3)',
          drag: true,
          resize: true
        })
        
        setSelectedRegion({ start, end })
        
        // Re-add PII and redaction regions
        addRegionsToWaveform()
      }
    })

    wavesurfer.on('click', () => {
      if (isSelecting) {
        isSelecting = false
      }
    })

    return () => {
      wavesurfer.destroy()
    }
  }, [audioUrl])

  // Separate effect to update regions when PII/redactions change
  useEffect(() => {
    if (wavesurferRef.current && regionsRef.current) {
      addRegionsToWaveform()
    }
  }, [piiSuggestions, redactions])

  const addRegionsToWaveform = () => {
    if (!regionsRef.current) return

    // Clear existing PII/redaction regions (but keep selection)
    const regions = regionsRef.current
    const allRegions = regions.getRegions()
    allRegions.forEach(region => {
      // Only clear non-selection regions (selection regions are blue)
      if (!region.color.includes('59, 130, 246')) {
        region.remove()
      }
    })

    // Add PII regions
    piiSuggestions.forEach((pii) => {
      if (pii.accepted) {
        regions.addRegion({
          start: pii.start_time,
          end: pii.end_time,
          color: `rgba(239, 68, 68, 0.4)`,
          drag: false,
          resize: false,
          content: pii.category
        })
      }
    })

    // Add redaction regions
    redactions.forEach((redaction) => {
      const colors = {
        silence: 'rgba(107, 114, 128, 0.6)',
        beep: 'rgba(245, 158, 11, 0.6)',
        anonymize: 'rgba(34, 197, 94, 0.6)'
      }
      
      regions.addRegion({
        start: redaction.start_time,
        end: redaction.end_time,
        color: colors[redaction.action],
        drag: false,
        resize: false,
        content: redaction.action
      })
    })
  }

  // Process audio when file is loaded
  useEffect(() => {
    if (selectedAudioFile && processingStatus.status === 'idle') {
      processAudioFile()
    }
  }, [selectedAudioFile])

  const processAudioFile = async () => {
    if (!selectedAudioFile) return

    try {
      setProcessingStatus({ 
        status: 'transcribing', 
        message: 'Hearing your audio now...', 
        progress: 10 
      })
      
      // Save audio file temporarily
      const audioPath = await invoke('save_temp_audio', {
        fileName: selectedAudioFile.name,
        fileData: Array.from(new Uint8Array(await selectedAudioFile.arrayBuffer()))
      })

      setProcessingStatus({ 
        status: 'transcribing', 
        message: 'Comprehending speech to discover some sensitive information (this may take a few minutes)...', 
        progress: 30 
      })

      // Process audio
      const result = await invoke('process_audio', { audioPath })
      
      setProcessingStatus({ 
        status: 'analyzing', 
        message: 'Analyzing the content for sensitive information...', 
        progress: 80 
      })
      
      const parsedResult = JSON.parse(result as string)

      setTranscript(parsedResult.transcript)
      setFormattedTranscript(parsedResult.formatted_transcript)
      
      // Convert PII suggestions to the correct format
      const piiSuggestions = parsedResult.pii_suggestions.map((pii: any) => ({
        id: crypto.randomUUID(),
        text: pii.text,
        category: pii.category,
        start_time: pii.start_time,
        end_time: pii.end_time,
        explanation: pii.explanation,
        confidence: pii.confidence || 0.8,
        accepted: false
      }))
      
      setPiiSuggestions(piiSuggestions)
      setProcessingStatus({ 
        status: 'completed', 
        message: `Found ${piiSuggestions.length} potential PII items`, 
        progress: 100 
      })
      
    } catch (error: any) {
      console.error('Error processing audio:', error)
      
      let errorMessage = 'Failed to process audio file'
      
      if (error.message && error.message.includes('ffmpeg')) {
        errorMessage = 'Audio processing failed: FFmpeg not found. Please restart the application.'
      } else if (error.message && error.message.includes('whisper')) {
        errorMessage = 'Speech transcription failed. Please check if the audio contains clear speech.'
      } else if (error.message && error.message.includes('AI') || error.message && error.message.includes('ollama')) {
        errorMessage = 'AI analysis failed. The transcription completed but PII analysis failed. Please try again.'
      } else if (error.toString().includes('Invalid audio format')) {
        errorMessage = 'Unsupported audio format. Please use MP3, WAV, or other common audio formats.'
      } else {
        errorMessage = `Processing failed during analysis phase: ${error.message || error.toString()}`
      }
      
      setProcessingStatus({ status: 'error', message: errorMessage })
    }
  }

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0]
    setVolume(newVolume)
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(newVolume)
    }
  }

  const handleSilenceSelection = () => {
    if (selectedRegion) {
      addRedaction({
        start_time: selectedRegion.start,
        end_time: selectedRegion.end,
        action: 'silence'
      })
      setSelectedRegion(null)
    }
  }

  const handleBeepSelection = () => {
    if (selectedRegion) {
      addRedaction({
        start_time: selectedRegion.start,
        end_time: selectedRegion.end,
        action: 'beep'
      })
      setSelectedRegion(null)
    }
  }

  const handleAnonymizeSelection = () => {
    if (selectedRegion) {
      addRedaction({
        start_time: selectedRegion.start,
        end_time: selectedRegion.end,
        action: 'anonymize'
      })
      setSelectedRegion(null)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleExport = async () => {
    if (!selectedAudioFile) return
    
    try {
      setProcessingStatus({ status: 'processing', message: 'Applying redactions and exporting...' })
      
      // Get the original file path (we need to save it temporarily first)
      const audioPath = await invoke('save_temp_audio', {
        fileName: selectedAudioFile.name,
        fileData: Array.from(new Uint8Array(await selectedAudioFile.arrayBuffer()))
      })
      
      // Prepare redactions data
      const redactionsJson = JSON.stringify(redactions)
      console.log('Exporting redactions:', redactions)
      console.log('Redactions JSON:', redactionsJson)
      
      // Create output filename
      const outputName = selectedAudioFile.name.replace(/\.[^/.]+$/, '_redacted.mp3')
      
      // Export redacted audio
      const outputPath = await invoke('export_redacted_audio', {
        originalPath: audioPath,
        redactions: redactionsJson,
        outputName
      })
      
      setProcessingStatus({ status: 'completed', message: `Audio exported to ${outputPath}` })
      
    } catch (error) {
      console.error('Export error:', error)
      setProcessingStatus({ status: 'error', message: 'Failed to export audio' })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      {/* Loading Overlay */}
      {(processingStatus.status === 'transcribing' || 
        processingStatus.status === 'analyzing' || 
        processingStatus.status === 'processing') && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Processing Audio</h3>
              <p className="text-gray-600 mb-4">{processingStatus.message}</p>
              
              {/* Progress indication */}
              <div className="space-y-2">
                {processingStatus.status === 'transcribing' && (
                  <div className="text-sm text-blue-600 font-medium">
                    🎤 Transcribing speech to text...
                  </div>
                )}
                {processingStatus.status === 'analyzing' && (
                  <div className="text-sm text-purple-600 font-medium">
                    🧠 Analyzing content for PII...
                  </div>
                )}
                {processingStatus.status === 'processing' && (
                  <div className="text-sm text-green-600 font-medium">
                    🎵 Applying redactions...
                  </div>
                )}
                
                {processingStatus.progress !== undefined && (
                  <Progress value={processingStatus.progress} className="w-full" />
                )}
                
                <div className="text-xs text-gray-500 mt-2">
                  Please wait, this may take a few minutes...
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {processingStatus.status === 'error' && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-red-900">Processing Failed</h3>
              <p className="text-gray-600 mb-6">{processingStatus.message}</p>
              
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => setProcessingStatus({ status: 'idle' })}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setProcessingStatus({ status: 'idle' })
                    setTimeout(processAudioFile, 500)
                  }}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={onBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-semibold">
                Now Editing: {selectedAudioFile?.name}
              </h1>
              {processingStatus.status === 'completed' && (
                <p className="text-sm text-green-600">✅ {processingStatus.message}</p>
              )}
              {processingStatus.status === 'error' && (
                <p className="text-sm text-red-600">❌ {processingStatus.message}</p>
              )}
            </div>
          </div>
          <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700">
            Export Redacted MP3
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {/* Waveform */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div ref={waveformRef} className="w-full mb-4" />
          
          {/* Playback Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={handlePlayPause}
                size="sm"
                disabled={processingStatus.status === 'transcribing' || processingStatus.status === 'analyzing'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <span className="text-sm font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              <Slider
                value={[volume]}
                onValueChange={handleVolumeChange}
                max={1}
                min={0}
                step={0.1}
                className="w-20"
              />
            </div>
          </div>
        </div>

        {/* Redactions Timeline */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Redactions</h3>
          {/* Debug info */}
          <div className="text-xs text-gray-500 mb-2">
            Debug: {redactions.length} redactions found
            {redactions.length > 0 && (
              <div>
                {redactions.map((r, i) => (
                  <div key={i}>
                    {r.action} from {r.start_time.toFixed(2)}s to {r.end_time.toFixed(2)}s 
                    {r.pii_id && ` (PII: ${r.pii_id})`}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-gray-100 rounded h-12 relative">
            {redactions.map((redaction) => {
              const left = (redaction.start_time / duration) * 100
              const width = ((redaction.end_time - redaction.start_time) / duration) * 100
              const colors = {
                silence: 'bg-gray-600',
                beep: 'bg-yellow-500',
                anonymize: 'bg-green-500'
              }
              
              return (
                <div
                  key={redaction.id}
                  className={`absolute top-1 bottom-1 ${colors[redaction.action]} rounded opacity-80 flex items-center justify-center text-xs text-white font-medium`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  {redaction.action}
                </div>
              )
            })}
            {redactions.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-500">
                No redactions applied yet
              </div>
            )}
          </div>
        </div>

        {/* Selection Tools */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Selection Tools</h3>
          
          {!selectedRegion ? (
            <p className="text-gray-600 mb-4">
              No region selected. Drag on the waveform above to select a region.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Selected Region: {formatTime(selectedRegion.start)} - {formatTime(selectedRegion.end)}
              </p>
              
              <div className="flex gap-4">
                <Button
                  onClick={handleSilenceSelection}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <span className="w-4 h-4 bg-gray-600 rounded"></span>
                  Silence Selection
                </Button>
                
                <Button
                  onClick={handleBeepSelection}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <span className="w-4 h-4 bg-yellow-500 rounded"></span>
                  Beep Selection
                </Button>
                
                <Button
                  onClick={handleAnonymizeSelection}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <span className="w-4 h-4 bg-green-500 rounded"></span>
                  Anonymize Selection
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
