use crate::util::paths::settings_path;
use serde::Serialize;
use std::fs;

#[derive(Serialize)]
pub struct SettingsReadResult {
    pub content: String,
    pub parsed: serde_json::Value,
}

#[derive(Serialize)]
pub struct SettingsWriteResult {
    pub saved: bool,
}

#[tauri::command]
pub fn read_settings() -> Result<SettingsReadResult, String> {
    let path = settings_path();
    let content =
        fs::read_to_string(&path).map_err(|_| "Settings file not found".to_string())?;
    let parsed: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Invalid JSON: {}", e))?;

    Ok(SettingsReadResult { content, parsed })
}

#[tauri::command]
pub fn write_settings(content: String) -> Result<SettingsWriteResult, String> {
    // Validate JSON
    let _: serde_json::Value =
        serde_json::from_str(&content).map_err(|_| "Invalid JSON".to_string())?;

    let path = settings_path();
    fs::write(&path, &content).map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(SettingsWriteResult { saved: true })
}
