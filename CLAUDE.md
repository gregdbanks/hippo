# Hippo — Claude Code Configuration Manager

## What This Is
Hippo is a local Tauri desktop app for managing Claude Code configuration files — the global CLAUDE.md, settings.json, skills (slash commands), and per-project memories. It lives in the system tray and provides a GUI for everything normally edited by hand in `~/.claude/`.

**App name**: Hippo (bundle ID: `com.gregbanks.hippo`)
**Build output**: `~/Desktop/Hippo.app`

## Tech Stack
- **Desktop framework**: Tauri 2.x (Rust backend + web frontend)
- **Frontend**: React 18, React Router 6, TypeScript 5, Vite 5
- **Styling**: Pure CSS (`src/client/styles.css`), Pico CSS for base styles
- **Rust edition**: 2021, minimum 1.77.2
- **Auto-update**: `tauri-plugin-updater` + `tauri-plugin-process`

## Project Structure
```
src/client/                    # React frontend
  App.tsx                      # Routes + sidebar navigation
  pages/
    Dashboard.tsx              # Overview of all config files
    Editor.tsx                 # Generic markdown/text editor
    MemoryBrowser.tsx          # Per-project memory management
    SkillsBrowser.tsx          # Skill (slash command) CRUD + templates
    SettingsEditor.tsx         # settings.json editor
    DocsBrowser.tsx            # CLI tools reference viewer
    SyncPage.tsx               # Config export/import
    HelpPage.tsx               # Usage instructions
  hooks/
    useDiscovery.ts            # Discovers all Claude config on disk
    useFile.ts                 # Read/write files via Tauri IPC
    useUpdater.ts              # App auto-update hook
  components/
    UpdateBanner.tsx           # In-app update notification
  lib/                         # Shared utilities

src-tauri/src/                 # Rust backend
  lib.rs                       # Tauri app setup, tray icon, window management
  main.rs                      # Entry point
  commands/                    # IPC command handlers
    discovery.rs               # Scan ~/.claude/ for all config files
    files.rs                   # Read/write arbitrary files
    settings.rs                # Parse/write settings.json
    memories.rs                # Memory CRUD + MEMORY.md index sync
    docs.rs                    # List documentation files
    sync.rs                    # Export/import config bundles
  util/
    discover.rs                # Filesystem discovery logic
    frontmatter.rs             # YAML frontmatter parser
    paths.rs                   # Claude config path resolution
    tokens.rs                  # Token count estimation
```

## Key Commands
```bash
npm run dev          # Start Tauri dev mode (frontend + Rust hot-reload)
npm run build        # Production build → extracts Hippo.app
npm run vite:dev     # Frontend-only dev server (port 5174)
npm run typecheck    # TypeScript validation
```

## How It Works
1. **Discovery**: On launch, Rust scans `~/.claude/` to find the global CLAUDE.md, settings.json, all skills (`~/.claude/skills/*/SKILL.md`), and all project memory directories
2. **Sidebar**: Lists config files at top, then each discovered project with its memory count
3. **Editor**: Generic markdown editor for any file (CLAUDE.md, SKILL.md, memories)
4. **Skills**: CRUD interface with built-in templates (code-review, design-audit, etc.)
5. **Sync**: Export/import config bundles for backup or machine transfer

## Skill Templates (Built-In)
The SkillsBrowser ships with these templates users can install as slash commands:
- `blank` — Empty skill
- `code-review` — PR/diff review
- `commit-message` — Generate commit messages
- `explain` — Explain code with analogies and diagrams
- `test-writer` — Write tests (TDD)
- `refactor` — Clean up code
- **Design pipeline** (5 skills, meant to run in sequence):
  1. `design-audit` — Audit app UI, produce GitHub issue with deviations
  2. `design-typography` — Fix type scale from audit issue
  3. `design-color` — Fix color palette from audit issue
  4. `design-spacing` — Fix spacing grid from audit issue
  5. `design-polish` — Add hover/focus/transition polish, close audit issue

## Design Skills — Current Behavior
The design skills follow an **audit → execute** pipeline:
- `/design-audit` produces a **single GitHub issue** with categorized checklists (component adoption, token violations, typography, color, spacing, polish)
- The four executor skills (`/design-typography`, `/design-color`, `/design-spacing`, `/design-polish`) read the audit issue, make code changes, and check off items
- **These are NOT epic-style issues** — the audit creates one flat issue per app, and the executors work against that same issue

## Architecture Decisions
- **Close-to-tray**: Window hides on close, lives in system tray (toggle via tray icon click)
- **No cloud/telemetry**: Everything is local filesystem reads/writes via Tauri IPC
- **Skills write to `~/.claude/skills/`**: Global skills available across all projects
- **Memory management**: Supports per-project memory directories under `~/.claude/projects/`

## Current Installed Skills (on this machine)
Located in `~/.claude/skills/`:
- `/commit`, `/branch`, `/start` — Git workflow
- `/audit`, `/inspect` — Code review (backend/frontend)
- `/design-audit`, `/design-typography`, `/design-color`, `/design-spacing`, `/design-polish` — Design pipeline
- `/design-it-pro`, `/design-system-audit` — Standalone design skills
- `/run-pulse` — Test runner integration
