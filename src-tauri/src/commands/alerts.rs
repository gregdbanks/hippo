use crate::util::alerts::{check, current_alerts, AlertItem, AlertState};
use crate::util::inventory::build;
use crate::util::paths::home_dir;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

pub const CHECK_EVERY: std::time::Duration = std::time::Duration::from_secs(5 * 60);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlertsView {
    pub enabled: bool,
    pub items: Vec<AlertItem>,
}

fn state_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("alerts.json"))
}

fn load_state(app: &AppHandle) -> AlertState {
    state_path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or(AlertState { enabled: true, ..Default::default() })
}

fn save_state(app: &AppHandle, state: &AlertState) {
    if let Some(path) = state_path(app) {
        if let Some(dir) = path.parent() {
            let _ = fs::create_dir_all(dir);
        }
        if let Ok(text) = serde_json::to_string_pretty(state) {
            let _ = crate::util::safe_write::atomic_write(&path, &text);
        }
    }
}

pub fn show_count(app: &AppHandle, count: usize) {
    if let Some(tray) = app.tray_by_id("main") {
        let title = if count == 0 { None } else { Some(count.to_string()) };
        let _ = tray.set_title(title);
        let _ = tray.set_tooltip(Some(if count == 0 { "Hippo: all config files within limits".to_string() } else { format!("Hippo: {} to review", count) }));
    }
}

pub fn run_check(app: &AppHandle) {
    let items = current_alerts(&build(&home_dir()));
    show_count(app, items.len());
    let mut state = load_state(app);
    let notices = check(&mut state, &items, chrono::Local::now());
    save_state(app, &state);
    for notice in notices {
        let _ = app.notification().builder().title(notice.title).body(notice.body).show();
    }
}

#[tauri::command(async)]
pub fn get_alerts(app: AppHandle) -> Result<AlertsView, String> {
    let items = current_alerts(&build(&home_dir()));
    show_count(&app, items.len());
    Ok(AlertsView { enabled: load_state(&app).enabled, items })
}

#[tauri::command]
pub fn set_alerts_enabled(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let mut state = load_state(&app);
    state.enabled = enabled;
    save_state(&app, &state);
    Ok(enabled)
}
