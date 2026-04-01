use crate::util::paths::{global_claude_md, settings_path, skills_dir};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

fn portable_dir() -> PathBuf {
    // In dev: CARGO_MANIFEST_DIR parent (repo root)
    // In prod: next to the executable or resource dir
    if let Ok(manifest) = std::env::var("CARGO_MANIFEST_DIR") {
        return PathBuf::from(manifest)
            .parent()
            .unwrap_or(&PathBuf::from("."))
            .join("portable");
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            // macOS .app bundle: go up to Contents, then Resources
            let resources = parent.join("../Resources/portable");
            if resources.parent().map(|p| p.exists()).unwrap_or(false) {
                return resources;
            }
        }
    }
    PathBuf::from("portable")
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub exported: Vec<String>,
    pub portable_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: Vec<String>,
    pub skipped: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableStatus {
    pub has_portable: bool,
    pub portable_path: String,
    pub files: Vec<PortableFileInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortableFileInfo {
    pub name: String,
    pub relative_path: String,
    pub size_bytes: u64,
}

#[tauri::command]
pub fn export_config() -> Result<ExportResult, String> {
    let dest = portable_dir();
    let skills_dest = dest.join("skills");

    fs::create_dir_all(&skills_dest)
        .map_err(|e| format!("Cannot create portable dir: {}", e))?;

    let mut exported = Vec::new();

    // Export CLAUDE.md
    let claude_md = global_claude_md();
    if claude_md.exists() {
        let content = fs::read_to_string(&claude_md)
            .map_err(|e| format!("Cannot read CLAUDE.md: {}", e))?;
        fs::write(dest.join("CLAUDE.md"), &content)
            .map_err(|e| format!("Cannot write CLAUDE.md: {}", e))?;
        exported.push("CLAUDE.md".to_string());
    }

    // Export settings.json
    let settings = settings_path();
    if settings.exists() {
        let content = fs::read_to_string(&settings)
            .map_err(|e| format!("Cannot read settings.json: {}", e))?;
        fs::write(dest.join("settings.json"), &content)
            .map_err(|e| format!("Cannot write settings.json: {}", e))?;
        exported.push("settings.json".to_string());
    }

    // Export skills
    let skills = skills_dir();
    if skills.exists() {
        if let Ok(entries) = fs::read_dir(&skills) {
            for entry in entries.flatten() {
                if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    continue;
                }
                let skill_name = entry.file_name().to_string_lossy().to_string();
                let skill_dest_dir = skills_dest.join(&skill_name);
                fs::create_dir_all(&skill_dest_dir)
                    .map_err(|e| format!("Cannot create skill dir: {}", e))?;

                // Copy all files in the skill directory
                if let Ok(skill_files) = fs::read_dir(entry.path()) {
                    for sf in skill_files.flatten() {
                        if sf.file_type().map(|t| t.is_file()).unwrap_or(false) {
                            let content = fs::read_to_string(sf.path())
                                .map_err(|e| format!("Cannot read skill file: {}", e))?;
                            fs::write(skill_dest_dir.join(sf.file_name()), &content)
                                .map_err(|e| format!("Cannot write skill file: {}", e))?;
                        }
                    }
                }
                exported.push(format!("skills/{}", skill_name));
            }
        }
    }

    Ok(ExportResult {
        exported,
        portable_path: dest.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn import_config() -> Result<ImportResult, String> {
    let source = portable_dir();
    if !source.exists() {
        return Err("No portable config found. Export first.".to_string());
    }

    let mut imported = Vec::new();
    let mut skipped = Vec::new();

    // Import CLAUDE.md
    let claude_src = source.join("CLAUDE.md");
    if claude_src.exists() {
        let content = fs::read_to_string(&claude_src)
            .map_err(|e| format!("Cannot read portable CLAUDE.md: {}", e))?;
        fs::write(global_claude_md(), &content)
            .map_err(|e| format!("Cannot write CLAUDE.md: {}", e))?;
        imported.push("CLAUDE.md".to_string());
    }

    // Import settings.json
    let settings_src = source.join("settings.json");
    if settings_src.exists() {
        let content = fs::read_to_string(&settings_src)
            .map_err(|e| format!("Cannot read portable settings.json: {}", e))?;
        // Validate JSON
        let _: serde_json::Value = serde_json::from_str(&content)
            .map_err(|_| "Portable settings.json is invalid JSON".to_string())?;

        let dest = settings_path();
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).ok();
        }
        fs::write(&dest, &content)
            .map_err(|e| format!("Cannot write settings.json: {}", e))?;
        imported.push("settings.json".to_string());
    }

    // Import skills
    let skills_src = source.join("skills");
    if skills_src.exists() {
        let skills_dest = skills_dir();
        fs::create_dir_all(&skills_dest).ok();

        if let Ok(entries) = fs::read_dir(&skills_src) {
            for entry in entries.flatten() {
                if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    continue;
                }
                let skill_name = entry.file_name().to_string_lossy().to_string();
                let dest_dir = skills_dest.join(&skill_name);
                fs::create_dir_all(&dest_dir).ok();

                if let Ok(skill_files) = fs::read_dir(entry.path()) {
                    for sf in skill_files.flatten() {
                        if sf.file_type().map(|t| t.is_file()).unwrap_or(false) {
                            let content = fs::read_to_string(sf.path())
                                .map_err(|e| format!("Cannot read skill file: {}", e))?;
                            fs::write(dest_dir.join(sf.file_name()), &content)
                                .map_err(|e| format!("Cannot write skill file: {}", e))?;
                        }
                    }
                }
                imported.push(format!("skills/{}", skill_name));
            }
        }
    }

    Ok(ImportResult { imported, skipped })
}

#[tauri::command]
pub fn get_portable_status() -> Result<PortableStatus, String> {
    let dir = portable_dir();
    if !dir.exists() {
        return Ok(PortableStatus {
            has_portable: false,
            portable_path: dir.to_string_lossy().to_string(),
            files: Vec::new(),
        });
    }

    let mut files = Vec::new();

    // Check top-level files
    for name in ["CLAUDE.md", "settings.json"] {
        let p = dir.join(name);
        if p.exists() {
            if let Ok(meta) = fs::metadata(&p) {
                files.push(PortableFileInfo {
                    name: name.to_string(),
                    relative_path: name.to_string(),
                    size_bytes: meta.len(),
                });
            }
        }
    }

    // Check skills
    let skills_dir = dir.join("skills");
    if skills_dir.exists() {
        if let Ok(entries) = fs::read_dir(&skills_dir) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let skill_md = entry.path().join("SKILL.md");
                    let size = fs::metadata(&skill_md).map(|m| m.len()).unwrap_or(0);
                    files.push(PortableFileInfo {
                        name: format!("/{}", name),
                        relative_path: format!("skills/{}", name),
                        size_bytes: size,
                    });
                }
            }
        }
    }

    Ok(PortableStatus {
        has_portable: !files.is_empty(),
        portable_path: dir.to_string_lossy().to_string(),
        files,
    })
}
