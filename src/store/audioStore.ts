import { create } from 'zustand'

export interface AudioWord {
  text: string
  start: number
  end: number
}

export interface AudioPII {
  id: string
  text: string
  category: string
  start_time: number
  end_time: number
  explanation: string
  confidence: number
  accepted: boolean
}

export interface AudioRedaction {
  id: string
  start_time: number
  end_time: number
  action: 'silence' | 'beep' | 'anonymize'
  pii_id?: string
}

export interface AudioProcessingStatus {
  status: 'idle' | 'transcribing' | 'analyzing' | 'processing' | 'completed' | 'error'
  message?: string
  progress?: number
}

interface AudioState {
  // Audio file state
  selectedAudioFile: File | null
  audioUrl: string | null
  duration: number
  
  // Processing state
  processingStatus: AudioProcessingStatus
  transcript: AudioWord[]
  formattedTranscript: string
  piiSuggestions: AudioPII[]
  redactions: AudioRedaction[]
  
  // Playback state
  currentTime: number
  isPlaying: boolean
  volume: number
  
  // Selection state
  selectedRegion: { start: number; end: number } | null
  selectedPII: AudioPII | null
  
  // Actions
  setSelectedAudioFile: (file: File | null) => void
  setAudioUrl: (url: string | null) => void
  setDuration: (duration: number) => void
  setProcessingStatus: (status: AudioProcessingStatus) => void
  setTranscript: (transcript: AudioWord[]) => void
  setFormattedTranscript: (transcript: string) => void
  setPiiSuggestions: (pii: AudioPII[]) => void
  setRedactions: (redactions: AudioRedaction[]) => void
  
  // Playback actions
  setCurrentTime: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
  
  // Selection actions
  setSelectedRegion: (region: { start: number; end: number } | null) => void
  setSelectedPII: (pii: AudioPII | null) => void
  
  // PII management
  togglePIIAcceptance: (piiId: string) => void
  acceptAllPII: () => void
  
  // Redaction management
  addRedaction: (redaction: Omit<AudioRedaction, 'id'>) => void
  removeRedaction: (redactionId: string) => void
  
  reset: () => void
}

const useAudioStore = create<AudioState>((set, get) => ({
  // Initial state
  selectedAudioFile: null,
  audioUrl: null,
  duration: 0,
  
  processingStatus: { status: 'idle' },
  transcript: [],
  formattedTranscript: '',
  piiSuggestions: [],
  redactions: [],
  
  currentTime: 0,
  isPlaying: false,
  volume: 1,
  
  selectedRegion: null,
  selectedPII: null,
  
  // Actions
  setSelectedAudioFile: (file) => set({ selectedAudioFile: file }),
  setAudioUrl: (url) => set({ audioUrl: url }),
  setDuration: (duration) => set({ duration }),
  setProcessingStatus: (status) => set({ processingStatus: status }),
  setTranscript: (transcript) => set({ transcript }),
  setFormattedTranscript: (transcript) => set({ formattedTranscript: transcript }),
  setPiiSuggestions: (pii) => set({ piiSuggestions: pii }),
  setRedactions: (redactions) => set({ redactions }),
  
  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  
  setSelectedRegion: (region) => set({ selectedRegion: region }),
  setSelectedPII: (pii) => set({ selectedPII: pii }),
  
  togglePIIAcceptance: (piiId) => set((state) => {
    const piiItem = state.piiSuggestions.find(pii => pii.id === piiId)
    
    if (!piiItem) return state
    
    const updated = state.piiSuggestions.map(pii =>
      pii.id === piiId ? { ...pii, accepted: !pii.accepted } : pii
    )
    
    let updatedRedactions = [...state.redactions]
    
    if (!piiItem.accepted) {
      // PII is being accepted - add redaction
      const newRedaction: AudioRedaction = {
        id: crypto.randomUUID(),
        start_time: piiItem.start_time,
        end_time: piiItem.end_time,
        action: 'beep', // Default to beep for PII
        pii_id: piiItem.id
      }
      updatedRedactions.push(newRedaction)
      console.log('Adding redaction for PII:', piiItem.text, newRedaction)
    } else {
      // PII is being unaccepted - remove redaction
      updatedRedactions = updatedRedactions.filter(r => r.pii_id !== piiItem.id)
      console.log('Removing redaction for PII:', piiItem.text)
    }
    
    return { 
      piiSuggestions: updated, 
      redactions: updatedRedactions 
    }
  }),
  
  acceptAllPII: () => set((state) => {
    const newRedactions: AudioRedaction[] = []
    
    // Create redactions for all PII items that aren't already accepted
    state.piiSuggestions.forEach(pii => {
      if (!pii.accepted) {
        // This PII is being newly accepted
        const existingRedaction = state.redactions.find(r => r.pii_id === pii.id)
        if (!existingRedaction) {
          newRedactions.push({
            id: crypto.randomUUID(),
            start_time: pii.start_time,
            end_time: pii.end_time,
            action: 'beep', // Default to beep for PII
            pii_id: pii.id
          })
        }
      }
    })
    
    console.log('Accept All PII: Creating', newRedactions.length, 'new redactions')
    console.log('New redactions:', newRedactions)
    
    const updated = state.piiSuggestions.map(pii => ({ ...pii, accepted: true }))
    
    return { 
      piiSuggestions: updated, 
      redactions: [...state.redactions, ...newRedactions] 
    }
  }),
  
  addRedaction: (redaction) => {
    const newRedaction = {
      ...redaction,
      id: crypto.randomUUID()
    }
    const current = get().redactions
    set({ redactions: [...current, newRedaction] })
  },
  
  removeRedaction: (redactionId) => {
    const current = get().redactions
    const updated = current.filter(r => r.id !== redactionId)
    set({ redactions: updated })
  },
  
  reset: () => set({
    selectedAudioFile: null,
    audioUrl: null,
    duration: 0,
    processingStatus: { status: 'idle' },
    transcript: [],
    formattedTranscript: '',
    piiSuggestions: [],
    redactions: [],
    currentTime: 0,
    isPlaying: false,
    volume: 1,
    selectedRegion: null,
    selectedPII: null,
  }),
}))

export default useAudioStore
