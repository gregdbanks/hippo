use crate::util::discover::{get_memories as do_get_memories, MemoryInfo};

#[tauri::command]
pub fn get_memories(slug: String) -> Result<Vec<MemoryInfo>, String> {
    Ok(do_get_memories(&slug))
}
