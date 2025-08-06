// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use commands::*;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            initialize_ai_engine,
            start_document_processing,
            process_single_page,
            export_redacted_document,
            save_temp_file,
            save_temp_audio,
            process_audio,
            export_redacted_audio
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
