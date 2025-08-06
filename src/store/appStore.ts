import { create } from 'zustand'

export interface RedactionSuggestion {
  id: string
  text: string
  confidence: number
  category: string
  reason?: string  // Add reason field as optional
  coordinates: {
    page: number
    x: number
    y: number
    width: number
    height: number
  }
  accepted: boolean
}

export interface ProcessingStatus {
  status: 'idle' | 'processing' | 'completed' | 'error'
  currentPage?: number
  totalPages?: number
  message?: string
}

interface AppState {
  // Document state
  selectedFile: File | null
  documentUrl: string | null
  totalPages: number
  
  // Processing state
  processingStatus: ProcessingStatus
  redactionSuggestions: Map<number, RedactionSuggestion[]> // page -> suggestions
  
  // UI state
  currentPage: number
  selectedProfile: 'quick' | 'deep'
  sidebarOpen: boolean
  selectedRedaction: RedactionSuggestion | null
  
  // Actions
  setSelectedFile: (file: File | null) => void
  setDocumentUrl: (url: string | null) => void
  setTotalPages: (pages: number) => void
  setProcessingStatus: (status: ProcessingStatus) => void
  addPageRedactions: (page: number, redactions: RedactionSuggestion[]) => void
  toggleRedactionAcceptance: (page: number, suggestionId: string) => void
  acceptAllRedactions: () => void
  acceptPageRedactions: (page: number) => void
  setCurrentPage: (page: number) => void
  setSelectedProfile: (profile: 'quick' | 'deep') => void
  setSidebarOpen: (open: boolean) => void
  setSelectedRedaction: (redaction: RedactionSuggestion | null) => void
  reset: () => void
}

const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  selectedFile: null,
  documentUrl: null,
  totalPages: 0,
  processingStatus: { status: 'idle' },
  redactionSuggestions: new Map(),
  currentPage: 1,
  selectedProfile: 'quick',
  sidebarOpen: true,
  selectedRedaction: null,
  
  // Actions
  setSelectedFile: (file) => set({ selectedFile: file }),
  setDocumentUrl: (url) => set({ documentUrl: url }),
  setTotalPages: (pages) => set({ totalPages: pages }),
  setProcessingStatus: (status) => set({ processingStatus: status }),
  
  addPageRedactions: (page, redactions) => {
    const current = get().redactionSuggestions
    const updated = new Map(current)
    updated.set(page, redactions)
    set({ redactionSuggestions: updated })
  },
  
  toggleRedactionAcceptance: (page, suggestionId) => {
    const current = get().redactionSuggestions
    const pageRedactions = current.get(page)
    if (pageRedactions) {
      const updated = pageRedactions.map(suggestion => 
        suggestion.id === suggestionId 
          ? { ...suggestion, accepted: !suggestion.accepted }
          : suggestion
      )
      const updatedMap = new Map(current)
      updatedMap.set(page, updated)
      set({ redactionSuggestions: updatedMap })
    }
  },
  
  acceptAllRedactions: () => {
    const current = get().redactionSuggestions
    const updatedMap = new Map()
    
    // Accept all suggestions on all pages
    current.forEach((suggestions, page) => {
      const updated = suggestions.map(suggestion => ({
        ...suggestion,
        accepted: true
      }))
      updatedMap.set(page, updated)
    })
    
    set({ redactionSuggestions: updatedMap })
  },
  
  acceptPageRedactions: (page) => {
    const current = get().redactionSuggestions
    const pageRedactions = current.get(page)
    if (pageRedactions) {
      const updated = pageRedactions.map(suggestion => ({
        ...suggestion,
        accepted: true
      }))
      const updatedMap = new Map(current)
      updatedMap.set(page, updated)
      set({ redactionSuggestions: updatedMap })
    }
  },
  
  setCurrentPage: (page) => set({ currentPage: page }),
  setSelectedProfile: (profile) => set({ selectedProfile: profile }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSelectedRedaction: (redaction) => set({ selectedRedaction: redaction }),
  
  reset: () => set({
    selectedFile: null,
    documentUrl: null,
    totalPages: 0,
    processingStatus: { status: 'idle' },
    redactionSuggestions: new Map(),
    currentPage: 1,
    selectedProfile: 'quick',
    sidebarOpen: true,
    selectedRedaction: null,
  }),
}))

export default useAppStore
