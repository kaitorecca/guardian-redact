#!/usr/bin/env python3
"""
Guardian Redact - Startup Initialization Script
Handles first-time setup of Ollama service and model downloading
"""

import sys
import json
from ollama_manager import get_ollama_manager

def progress_callback(message):
    """Callback function to report progress to the frontend."""
    # Send progress updates that can be captured by the Rust backend
    progress_info = {
        "status": "downloading_model",
        "message": message
    }
    print(json.dumps(progress_info), flush=True)

def main():
    """Initialize the Guardian Redact AI engine."""
    try:
        print(json.dumps({
            "status": "initializing",
            "message": "Starting Guardian Redact AI Engine..."
        }), flush=True)
        
        manager = get_ollama_manager()
        
        # Initialize with progress callback
        success = manager.initialize(progress_callback)
        
        if success:
            print(json.dumps({
                "status": "ready",
                "message": "Guardian Redact AI Engine is ready!"
            }), flush=True)
            sys.exit(0)
        else:
            print(json.dumps({
                "status": "error",
                "message": "Failed to initialize AI engine"
            }), flush=True)
            sys.exit(1)
            
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": f"Initialization failed: {str(e)}"
        }), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
