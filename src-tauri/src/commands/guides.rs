use crate::util::guides::{list, read, GuideInfo};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn guides_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("guides"))
}

#[tauri::command(async)]
pub fn list_guides(app: AppHandle) -> Result<Vec<GuideInfo>, String> {
    Ok(guides_dir(&app).map(|d| list(&d)).unwrap_or_default())
}

#[tauri::command(async)]
pub fn read_guide(app: AppHandle, id: String) -> Result<String, String> {
    read(&guides_dir(&app).ok_or("Guides folder not found.")?, &id)
}
