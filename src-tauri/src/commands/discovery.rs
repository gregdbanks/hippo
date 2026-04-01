use crate::util::discover::{discover as do_discover, DiscoveryResult};

#[tauri::command]
pub fn discover() -> Result<DiscoveryResult, String> {
    Ok(do_discover())
}
