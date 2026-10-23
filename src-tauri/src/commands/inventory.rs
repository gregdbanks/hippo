use crate::util::alerts::current_alerts;
use crate::util::inventory::{build, Inventory};
use crate::util::paths::home_dir;
use tauri::AppHandle;

#[tauri::command(async)]
pub fn inventory(app: AppHandle) -> Result<Inventory, String> {
    let inv = build(&home_dir());
    crate::commands::alerts::show_count(&app, current_alerts(&inv).len());
    Ok(inv)
}
