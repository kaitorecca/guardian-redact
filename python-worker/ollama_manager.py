#!/usr/bin/env python3
"""
Guardian Redact - Ollama Manager
Manages the embedded Ollama service including startup, model pulling, and health checks
"""

import os
import sys
import subprocess
import time
import json
import requests
from pathlib import Path
import threading
import signal

class OllamaManager:
    def __init__(self, ollama_dir=None):
        """Initialize Ollama manager with the embedded Ollama directory."""
        if ollama_dir is None:
            # Default to ollama folder in the project root
            project_root = Path(__file__).parent.parent
            ollama_dir = project_root / "ollama"
        
        self.ollama_dir = Path(ollama_dir)
        self.ollama_exe = self.ollama_dir / "ollama.exe"
        self.base_url = "http://localhost:11434"
        self.model_name = "gemma3n"  # Using gemma3n as originally specified
        self.process = None
        self.startup_timeout = 30  # seconds
        
        # Set environment variables for embedded Ollama
        os.environ["OLLAMA_HOST"] = "localhost:11434"
        os.environ["OLLAMA_ORIGINS"] = "*"
        
    def is_ollama_running(self):
        """Check if Ollama service is running."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def start_ollama_service(self):
        """Start the embedded Ollama service."""
        if self.is_ollama_running():
            print("✅ Ollama service is already running", file=sys.stderr)
            return True
        
        if not self.ollama_exe.exists():
            print(f"❌ Ollama executable not found at {self.ollama_exe}", file=sys.stderr)
            return False
        
        try:
            print("🚀 Starting embedded Ollama service...", file=sys.stderr)
            
            # Start Ollama serve in background
            self.process = subprocess.Popen(
                [str(self.ollama_exe), "serve"],
                cwd=str(self.ollama_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            # Wait for service to start
            for i in range(self.startup_timeout):
                if self.is_ollama_running():
                    print("✅ Ollama service started successfully", file=sys.stderr)
                    return True
                time.sleep(1)
                print(f"⏳ Waiting for Ollama service... ({i+1}/{self.startup_timeout})", file=sys.stderr)
            
            print("❌ Ollama service failed to start within timeout", file=sys.stderr)
            return False
            
        except Exception as e:
            print(f"❌ Error starting Ollama service: {e}", file=sys.stderr)
            return False
    
    def is_model_available(self):
        """Check if the required model is available."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=10)
            if response.status_code == 200:
                models = response.json().get("models", [])
                for model in models:
                    if self.model_name in model.get("name", ""):
                        return True
            return False
        except requests.exceptions.RequestException:
            return False
    
    def pull_model(self, progress_callback=None):
        """Pull the required model with progress tracking."""
        if self.is_model_available():
            print(f"✅ Model {self.model_name} is already available", file=sys.stderr)
            return True
        
        try:
            print(f"📥 Pulling model {self.model_name}...", file=sys.stderr)
            
            # Use ollama pull command
            pull_process = subprocess.Popen(
                [str(self.ollama_exe), "pull", self.model_name],
                cwd=str(self.ollama_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            
            # Monitor progress
            while True:
                output = pull_process.stdout.readline()
                if output == '' and pull_process.poll() is not None:
                    break
                if output:
                    line = output.strip()
                    print(f"📥 {line}", file=sys.stderr)
                    if progress_callback:
                        progress_callback(line)
            
            return_code = pull_process.poll()
            if return_code == 0:
                print(f"✅ Model {self.model_name} downloaded successfully", file=sys.stderr)
                return True
            else:
                print(f"❌ Failed to download model {self.model_name}", file=sys.stderr)
                return False
                
        except Exception as e:
            print(f"❌ Error pulling model: {e}", file=sys.stderr)
            return False
    
    def chat(self, messages):
        """Send a chat request to Ollama."""
        try:
            payload = {
                "model": self.model_name,
                "messages": messages,
                "stream": False
            }
            
            response = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=120  # 2 minutes timeout for AI responses
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"❌ Ollama API error: {response.status_code}", file=sys.stderr)
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Error calling Ollama API: {e}", file=sys.stderr)
            return None
    
    def initialize(self, progress_callback=None):
        """Initialize Ollama service and ensure model is available."""
        print("🔧 Initializing Guardian Redact AI Engine...", file=sys.stderr)
        
        # Step 1: Start Ollama service
        if not self.start_ollama_service():
            return False
        
        # Step 2: Check and pull model if needed
        if not self.is_model_available():
            print(f"📦 Model {self.model_name} not found, downloading...", file=sys.stderr)
            if not self.pull_model(progress_callback):
                return False
        
        print("✅ Guardian Redact AI Engine initialized successfully", file=sys.stderr)
        return True
    
    def shutdown(self):
        """Shutdown the Ollama service."""
        if self.process:
            try:
                # Terminate the process gracefully
                self.process.terminate()
                
                # Wait for termination
                try:
                    self.process.wait(timeout=10)
                    print("✅ Ollama service stopped gracefully", file=sys.stderr)
                except subprocess.TimeoutExpired:
                    # Force kill if it doesn't terminate
                    self.process.kill()
                    self.process.wait()
                    print("⚠️ Ollama service force stopped", file=sys.stderr)
                    
            except Exception as e:
                print(f"❌ Error stopping Ollama service: {e}", file=sys.stderr)
            
            self.process = None

# Global instance
_ollama_manager = None

def get_ollama_manager():
    """Get the global Ollama manager instance."""
    global _ollama_manager
    if _ollama_manager is None:
        _ollama_manager = OllamaManager()
    return _ollama_manager

def initialize_ollama(progress_callback=None):
    """Initialize Ollama for the application."""
    manager = get_ollama_manager()
    return manager.initialize(progress_callback)

def call_ollama_chat(messages):
    """Call Ollama chat API."""
    manager = get_ollama_manager()
    return manager.chat(messages)

def shutdown_ollama():
    """Shutdown Ollama service."""
    global _ollama_manager
    if _ollama_manager:
        _ollama_manager.shutdown()
        _ollama_manager = None
