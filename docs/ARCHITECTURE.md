# 🏗️ Guardian Redact - System Architecture

## High-Level Architecture Overview

**Central Intelligence Design:** Guardian Redact is architected around Google's Gemma 3n model as the primary intelligence core. Every piece of content—whether document text, images, or audio transcripts—flows through Gemma 3n for context-aware PII detection and classification.

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI[React + TypeScript Frontend]
        Home[HomeScreen Component]
        DocView[DocumentViewer Component] 
        AudioEdit[AudioEditor Component]
        PII[PII Sidebar Components]
    end
    
    subgraph "Application Layer"
        Tauri[Tauri Desktop Runtime]
        Commands[Rust Command Handlers]
        FileSystem[File System Access]
        Dialogs[Native File Dialogs]
    end
    
    subgraph "Processing Layer"
        PyWorker[Python Worker Scripts]
        DocProcessor[Document Processor → Gemma 3n]
        AudioProcessor[Audio Processor → Gemma 3n]
        AIManager[Ollama AI Manager]
    end
    
    subgraph "🧠 AI INTELLIGENCE CORE - SYSTEM HEART"
        Ollama[Ollama Runtime]
        Gemma[🎯 GEMMA 3n MODEL - ALL ANALYSIS FLOWS HERE]
        Whisper[Whisper ASR Model → Feeds to Gemma 3n]
    end
    
    subgraph "External Dependencies"
        FFmpeg[FFmpeg Audio Processing]
        PyMuPDF[PyMuPDF PDF Parser → Text to Gemma 3n]
        OpenCV[OpenCV Image Processing → OCR to Gemma 3n]
    end
    
    UI --> Tauri
    Home --> UI
    DocView --> UI
    AudioEdit --> UI
    PII --> UI
    
    Tauri --> Commands
    Commands --> FileSystem
    Commands --> Dialogs
    Commands --> PyWorker
    
    PyWorker --> DocProcessor
    PyWorker --> AudioProcessor
    PyWorker --> AIManager
    
    AIManager --> Ollama
    Ollama --> Gemma
    AudioProcessor --> Whisper
    Whisper --> Gemma
    
    DocProcessor --> Gemma
    DocProcessor --> PyMuPDF
    DocProcessor --> OpenCV
    AudioProcessor --> FFmpeg
    PyMuPDF --> Gemma
    OpenCV --> Gemma
    
    style UI fill:#61DAFB,stroke:#333,stroke-width:3px
    style Tauri fill:#FFC131,stroke:#333,stroke-width:3px
    style PyWorker fill:#3776AB,stroke:#333,stroke-width:3px
    style Gemma fill:#FF1744,stroke:#fff,stroke-width:5px
    style Ollama fill:#FF6B6B,stroke:#333,stroke-width:3px
```

**Architecture Principle:** Gemma 3n serves as the singular intelligence hub—no PII detection occurs without its analysis. This ensures consistent, context-aware classification across all media types.

## Data Flow Architecture

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Tauri
    participant Python
    participant AI
    
    User->>Frontend: Upload Document/Audio
    Frontend->>Tauri: invoke('process_file')
    Tauri->>Python: Execute worker script
    
    alt Document Processing
        Python->>Python: Parse PDF with PyMuPDF
        Python->>AI: Analyze text for PII
        AI-->>Python: Return PII suggestions
        Python->>Python: Format results
    else Audio Processing
        Python->>Python: Transcribe with Whisper
        Python->>AI: Analyze transcript for PII
        AI-->>Python: Return PII suggestions
        Python->>Python: Apply audio redactions
    end
    
    Python-->>Tauri: Return JSON results
    Tauri-->>Frontend: Processed data
    Frontend->>User: Display results & controls
    
    User->>Frontend: Accept/Reject suggestions
    Frontend->>Frontend: Update UI state
    
    User->>Frontend: Export redacted file
    Frontend->>Tauri: invoke('export_file')
    Tauri->>Python: Execute export script
    Python-->>Tauri: File path
    Tauri-->>Frontend: Success confirmation
    Frontend->>User: Download complete
```

## Component Architecture

```mermaid
graph LR
    subgraph "Frontend Components"
        A[App.tsx] --> B[HomeScreen.tsx]
        A --> C[DocumentViewer.tsx]
        A --> D[AudioEditor.tsx]
        
        C --> E[PIISidebar.tsx]
        C --> F[RedactionOverlay.tsx]
        
        D --> G[AudioPIISidebar.tsx]
        D --> H[WaveformViewer]
        
        subgraph "State Management"
            I[documentStore.ts]
            J[audioStore.ts]
        end
        
        C --> I
        D --> J
        E --> I
        G --> J
    end
    
    subgraph "Rust Backend"
        K[main.rs] --> L[commands.rs]
        L --> M[process_page]
        L --> N[process_audio]
        L --> O[export_pdf]
        L --> P[export_audio]
    end
    
    subgraph "Python Workers"
        Q[process_page.py]
        R[process_audio.py]
        S[export_pdf.py]
        T[apply_audio_redactions.py]
        U[ollama_manager.py]
    end
    
    M --> Q
    N --> R
    O --> S
    P --> T
    Q --> U
    R --> U
    
    style A fill:#e1f5fe
    style K fill:#fff3e0
    style Q fill:#f3e5f5
```

## AI Processing Pipeline

**Gemma 3n Central Processing Flow:** Every piece of content analysis flows through Google's Gemma 3n model as the single source of intelligence.

```mermaid
flowchart TD
    A[Input File] --> B{File Type?}
    
    B -->|PDF| C[PyMuPDF Parser]
    B -->|Audio| D[Whisper Transcription]
    
    C --> E[Extract Text & Images]
    C --> F[Page-by-Page Processing]
    
    D --> G[Word-Level Timestamps]
    D --> H[Formatted Transcript]
    
    E --> I[🧠 GEMMA 3n ANALYSIS - SYSTEM HEART]
    F --> I
    G --> J[🧠 GEMMA 3n ANALYSIS - SYSTEM HEART]
    H --> J
    
    I --> K[Document PII Classification]
    J --> L[Audio PII Classification]
    
    K --> M[Bounding Box Coordinates]
    L --> N[Time-based Segments]
    
    M --> O[Frontend Rendering]
    N --> P[Waveform Visualization]
    
    O --> Q[User Review & Accept]
    P --> R[User Review & Accept]
    
    Q --> S[PDF Export with Redactions]
    R --> T[Audio Export with Redactions]
    
    style I fill:#FF1744,stroke:#fff,stroke-width:3px
    style J fill:#FF1744,stroke:#fff,stroke-width:3px
    style A fill:#e8f5e8
    style S fill:#e8f5e8
    style T fill:#e8f5e8
```

**Critical Design:** No PII detection occurs without Gemma 3n analysis. All text, images (via OCR), and transcripts are processed through the same intelligent core for consistent, context-aware results.

## Security & Privacy Architecture

```mermaid
graph TB
    subgraph "Local Device Boundary"
        subgraph "Application Sandbox"
            A[User Files]
            B[Temporary Processing]
            C[AI Models]
            D[Processed Output]
        end
        
        subgraph "System Resources"
            E[Local File System]
            F[Memory Management] 
            G[CPU/GPU Processing]
        end
    end
    
    subgraph "External Boundaries"
        H[❌ No Internet Required]
        I[❌ No Cloud Services]
        J[❌ No Data Transmission]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    
    B --> F
    C --> G
    
    style A fill:#c8e6c9
    style B fill:#fff9c4
    style C fill:#ffcdd2
    style D fill:#c8e6c9
    style H fill:#ffcdd2
    style I fill:#ffcdd2
    style J fill:#ffcdd2
```

## Technology Stack Detail

```mermaid
mindmap
  root((Guardian Redact))
    🧠 INTELLIGENCE CORE
      🎯 GEMMA 3n MODEL
        Context Understanding
        Multilingual Analysis
        PII Classification
        Privacy Intelligence
      Ollama Runtime
        Local Processing
        No Cloud Required
        Complete Privacy
      🎤 Speech Processing
        Whisper ASR
        whisper-timestamped
        → Feeds to Gemma 3n
    
    Frontend
      React 18
        TypeScript
        Zustand State
        shadcn/ui
      Visualization
        react-pdf
        WaveSurfer.js
        Canvas API
      Styling
        Tailwind CSS
        Radix UI
        Lucide Icons
    
    Desktop
      Tauri v1
        Rust Backend
        WebView Frontend
        Native APIs
      Platform
        Windows
        macOS  
        Linux
    
    Media Processing
      Documents
        PyMuPDF → Gemma 3n
        PyPDF2 → Gemma 3n
        OpenCV → Gemma 3n
      Audio
        FFmpeg
        PyDub
        Audio Manipulation
      Export
        PDF Flattening
        MP3 Generation
```

---

## Performance Characteristics

| Component | Processing Time | Memory Usage | Notes |
|-----------|----------------|--------------|-------|
| PDF Analysis | 2-5s per page | 100-500MB | Depends on page complexity |
| Audio Transcription | 1:4 ratio | 200-1GB | Real-time processing |
| PII Detection | 1-3s per analysis | 50-200MB | Model inference time |
| Export Generation | 5-30s | 100-2GB | File size dependent |

## Scalability Considerations

- **Document Size**: Optimized for documents up to 100 pages
- **Audio Length**: Supports files up to 2 hours efficiently  
- **Memory Management**: Streaming processing for large files
- **Parallel Processing**: Multi-core CPU utilization
- **Model Caching**: AI models loaded once, reused for speed

---

*This architecture ensures complete privacy by keeping all processing local while maintaining high performance and user experience quality.*
