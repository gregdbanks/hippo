use crate::util::inventory::build;
use crate::util::paths::home_dir;
use crate::util::search::{search, SearchHit};

#[tauri::command(async)]
pub fn search_configs(query: String) -> Result<Vec<SearchHit>, String> {
    let home = home_dir();
    Ok(search(&home, &build(&home), &query))
}
