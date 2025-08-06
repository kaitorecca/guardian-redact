use std::process::Command;
use std::fs::File;
use std::io::Write;
use std::sync::Arc;
use std::sync::Mutex;
use tokio::sync::oneshot;
use std::path::PathBuf;
use tauri::command;
use tauri::api::dialog::FileDialogBuilder;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct RedactionSuggestion {
    pub id: String,
    pub text: String,
    pub confidence: f32,
    pub category: String, // "PII", "FINANCIAL", "MEDICAL", etc.
    pub reason: Option<String>,
    pub coordinates: RedactionCoordinates,
    pub accepted: bool,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct RedactionCoordinates {
    pub page: i32,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct ProcessingStatus {
    pub status: String,
    pub current_page: Option<i32>,
    pub total_pages: Option<i32>,
    pub page_complete: Option<i32>,
    pub redactions: Option<Vec<RedactionSuggestion>>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct InitializationStatus {
    pub status: String,  // "initializing", "downloading_model", "ready", "error"
    pub message: String,
}

#[command]
pub async fn initialize_ai_engine() -> Result<InitializationStatus, String> {
    // Get the Python executable path
    let python_exe = if cfg!(windows) {
        "C:/coding/gemma/.venv/Scripts/python.exe"
    } else {
        "python3"
    };

    // Call the AI initialization script
    let mut cmd = Command::new(python_exe);
    cmd.arg("python-worker/initialize_ai.py")
        .current_dir("C:/coding/gemma");
    
    // Hide console window on Windows
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute AI initialization script: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        // Print debug output
        if !stderr.is_empty() {
            println!("AI init debug output:\n{}", stderr);
        }
        
        // Parse the last line as JSON status
        if let Some(last_line) = stdout.lines().last() {
            match serde_json::from_str::<InitializationStatus>(last_line) {
                Ok(status) => Ok(status),
                Err(_) => Ok(InitializationStatus {
                    status: "ready".to_string(),
                    message: "AI engine initialized successfully".to_string(),
                })
            }
        } else {
            Ok(InitializationStatus {
                status: "ready".to_string(),
                message: "AI engine initialized successfully".to_string(),
            })
        }
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("AI initialization failed: {}", stderr))
    }
}

#[command]
pub async fn save_temp_file(file_name: String, file_data: Vec<u8>) -> Result<String, String> {
    // Create temp directory if it doesn't exist
    let temp_dir = std::env::temp_dir().join("guardian_redact");
    std::fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;
    
    // Generate unique filename
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let temp_file_path = temp_dir.join(format!("{}_{}", timestamp, file_name));
    
    // Write file data
    let mut file = File::create(&temp_file_path).map_err(|e| format!("Failed to create temp file: {}", e))?;
    file.write_all(&file_data).map_err(|e| format!("Failed to write file data: {}", e))?;
    
    Ok(temp_file_path.to_string_lossy().to_string())
}

#[command]
pub async fn start_document_processing(file_path: String, total_pages: i32, profile: String) -> Result<(), String> {
    // This will be called to initiate the processing
    // We'll implement the page-by-page processing logic here
    println!("Starting document processing for: {} with {} pages using {} profile", file_path, total_pages, profile);
    Ok(())
}

#[command]
pub async fn process_single_page(file_path: String, page_number: i32, profile: String) -> Result<Vec<RedactionSuggestion>, String> {
    // Get the Python executable path
    let python_exe = if cfg!(windows) {
        "C:/coding/gemma/.venv/Scripts/python.exe"
    } else {
        "python3"
    };

    // Call Python worker script for a single page
    let mut cmd = Command::new(python_exe);
    cmd.arg("python-worker/process_page.py")
        .arg(&file_path)
        .arg(&page_number.to_string())
        .arg(&profile)
        .current_dir("C:/coding/gemma"); // Set working directory
    
    // Hide console window on Windows
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute Python script: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("Python script stderr: {}", stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    // Print stderr for debugging purposes
    if !stderr.is_empty() {
        println!("Python script debug output:\n{}", stderr);
    }
    
    // Clean up JSON response (remove trailing commas that might cause parsing issues)
    let cleaned_stdout = stdout
        .replace(",\n]", "\n]")
        .replace(",\n}", "\n}");
    
    let suggestions: Vec<RedactionSuggestion> = serde_json::from_str(&cleaned_stdout)
        .map_err(|e| format!("Failed to parse JSON output: {}. Raw output: {}", e, stdout))?;

    Ok(suggestions)
}

#[command]
pub async fn export_redacted_document(
    file_path: String, 
    redactions: Vec<RedactionSuggestion>, 
    suggested_filename: String
) -> Result<String, String> {
    use std::sync::{Arc, Mutex};
    use tokio::sync::oneshot;
    
    let (tx, rx) = oneshot::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));
    
    // Show save dialog with callback
    FileDialogBuilder::new()
        .set_title("Save Redacted PDF")
        .set_file_name(&suggested_filename)
        .add_filter("PDF Files", &["pdf"])
        .save_file(move |path| {
            let tx = tx.lock().unwrap().take();
            if let Some(tx) = tx {
                let _ = tx.send(path);
            }
        });
    
    // Wait for dialog result
    let save_path = rx.await.map_err(|_| "Dialog callback failed".to_string())?;
    
    let output_path = match save_path {
        Some(path) => path.to_string_lossy().to_string(),
        None => return Err("Save dialog was cancelled".to_string()),
    };

    // Get the Python executable path
    let python_exe = if cfg!(windows) {
        "C:/coding/gemma/.venv/Scripts/python.exe"
    } else {
        "python3"
    };

    // Call Python script to export the final redacted PDF
    let redactions_json = serde_json::to_string(&redactions)
        .map_err(|e| format!("Failed to serialize redactions: {}", e))?;

    let mut cmd = Command::new(python_exe);
    cmd.arg("python-worker/export_pdf.py")
        .arg(&file_path)
        .arg(&redactions_json)
        .arg(&output_path)
        .current_dir("C:/coding/gemma"); // Set working directory
    
    // Hide console window on Windows
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute Python export script: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        println!("Export script failed - stderr: {}", stderr);
        println!("Export script failed - stdout: {}", stdout);
        return Err(format!("Export script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    // Print debug output
    if !stderr.is_empty() {
        println!("Export script debug output:\n{}", stderr);
    }
    if !stdout.is_empty() {
        println!("Export script stdout:\n{}", stdout);
    }

    Ok(output_path)
}

#[command]
pub async fn save_temp_audio(file_name: String, file_data: Vec<u8>) -> Result<String, String> {
    // Create temp directory if it doesn't exist
    let temp_dir = std::env::temp_dir().join("guardian_redact");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    // Save the audio file
    let file_path = temp_dir.join(&file_name);
    let mut file = File::create(&file_path)
        .map_err(|e| format!("Failed to create temp audio file: {}", e))?;
    
    file.write_all(&file_data)
        .map_err(|e| format!("Failed to write audio data: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[command]
pub async fn process_audio(audio_path: String) -> Result<String, String> {
    // Get the Python executable path
    let python_exe = if cfg!(windows) {
        "C:/coding/gemma/.venv/Scripts/python.exe"
    } else {
        "python3"
    };

    // Run the audio processing script
    let mut cmd = Command::new(python_exe);
    cmd.arg("python-worker/process_audio.py")
        .arg(&audio_path)
        .current_dir("C:/coding/gemma");
    
    // Hide console window on Windows
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute audio processing script: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        // Print debug output
        if !stderr.is_empty() {
            println!("Audio processing debug output:\n{}", stderr);
        }
        
        Ok(stdout.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Audio processing failed: {}", stderr))
    }
}

#[command]
pub async fn export_redacted_audio(
    original_path: String,
    redactions: String,  // JSON string of redactions
    output_name: String
) -> Result<String, String> {
    let (tx, rx) = oneshot::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));
    
    // Show save dialog
    FileDialogBuilder::new()
        .set_title("Save Redacted Audio")
        .set_file_name(&output_name)
        .add_filter("MP3 Audio", &["mp3"])
        .save_file(move |path| {
            let tx = tx.lock().unwrap().take();
            if let Some(tx) = tx {
                let _ = tx.send(path);
            }
        });

    // Wait for the user's selection
    let save_path = match rx.await {
        Ok(Some(path)) => path,
        Ok(None) => return Err("Save cancelled by user".to_string()),
        Err(_) => return Err("Failed to get save path".to_string()),
    };
    
    let output_path = save_path.to_string_lossy().to_string();

    // Get the Python executable path
    let python_exe = if cfg!(windows) {
        "C:/coding/gemma/.venv/Scripts/python.exe"
    } else {
        "python3"
    };

    // Create a temporary file for redactions data
    let temp_dir = std::env::temp_dir().join("guardian_redact");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    let redactions_file = temp_dir.join("redactions.json");
    let mut file = File::create(&redactions_file)
        .map_err(|e| format!("Failed to create redactions file: {}", e))?;
    file.write_all(redactions.as_bytes())
        .map_err(|e| format!("Failed to write redactions data: {}", e))?;

    // Run the audio redaction script
    let mut cmd = Command::new(python_exe);
    cmd.arg("python-worker/apply_audio_redactions.py")
        .arg(&original_path)
        .arg(&redactions_file.to_string_lossy().to_string())
        .arg(&output_path)
        .current_dir("C:/coding/gemma");
    
    // Hide console window on Windows
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute audio redaction script: {}", e))?;

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    
    // Always print debug output for audio processing
    if !stderr.is_empty() {
        println!("Audio redaction debug output:\n{}", stderr);
    }
    if !stdout.is_empty() {
        println!("Audio redaction stdout:\n{}", stdout);
    }

    if output.status.success() {
        Ok(output_path)
    } else {
        Err(format!("Audio redaction failed: {}", stderr))
    }
}
