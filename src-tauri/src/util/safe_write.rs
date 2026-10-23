use std::fs;
use std::path::Path;

pub fn atomic_write(target: &Path, content: &str) -> Result<(), String> {
    use std::io::Write;
    let dir = target.parent().ok_or("Invalid location")?;
    let mut tmp = tempfile::NamedTempFile::new_in(dir).map_err(|e| format!("Failed to write file: {}", e))?;
    tmp.write_all(content.as_bytes()).map_err(|e| format!("Failed to write file: {}", e))?;
    if let Ok(meta) = fs::metadata(target) {
        fs::set_permissions(tmp.path(), meta.permissions()).map_err(|e| format!("Failed to keep permissions: {}", e))?;
    }
    tmp.persist(target).map_err(|e| format!("Failed to save file: {}", e.error))?;
    Ok(())
}
