# CLI Tools & Agentic Capabilities

A reference of CLI programs actively used across projects, plus recommended tools worth adopting.

---

## Core CLI Programs

These are the high-impact tools that power our development workflow. They're especially powerful when used by agentic AI — enabling autonomous testing, deployment, and verification without human intervention.

### Playwright CLI
- **What:** Browser automation, E2E testing, screenshots, visual verification
- **Install:** `npm install -g @playwright/cli`
- **Why it matters:** Lets the agent see what users see. Screenshots, form interactions, visual regression testing — all without a human watching the browser.
- **Key uses:**
  - E2E tests that mirror real user behavior (clicks, keyboard, navigation)
  - Post-deploy visual verification against live URLs
  - Screenshot capture for UI change validation
  - Accessibility testing with real browser rendering

### GitHub CLI (`gh`)
- **What:** GitHub operations from the terminal — PRs, issues, checks, releases
- **Install:** `brew install gh`
- **Why it matters:** Full GitHub workflow without leaving the terminal. Agents can create PRs, check CI status, comment on issues, and merge — all autonomously.
- **Key uses:**
  - `gh pr create` / `gh pr merge` — PR lifecycle
  - `gh issue create` / `gh issue list` — ticket tracking
  - `gh run view` — monitor CI/CD pipeline status
  - `gh api` — direct GitHub API access for anything not covered by subcommands

### AWS CLI
- **What:** Manage all AWS services from the terminal
- **Install:** `brew install awscli`
- **Why it matters:** Infrastructure management, deployments, debugging — without clicking through the console. Critical for our AWS stack (Amplify, Bedrock, Cognito, S3).
- **Key uses:**
  - Amplify deployments and environment management
  - Bedrock AI model invocation
  - S3 file management
  - Cognito user pool administration
  - Cost Explorer queries for usage monitoring

---

## Build & Development Tools

### pnpm
- **What:** Fast, disk-efficient package manager with workspace support
- **Version:** 9.15.4
- **Key uses:** Monorepo workspace management, dependency installation, script execution

### Turborepo
- **What:** Monorepo build orchestrator with caching
- **Key uses:** Parallel builds, dependency-aware task execution, remote caching

### Vite
- **What:** Next-gen frontend build tool
- **Key uses:** Dev server with HMR, production builds, proxy configuration

### TypeScript (`tsc`)
- **What:** Type checking and compilation
- **Key uses:** Pre-commit type validation, CI quality gates

### tsx
- **What:** TypeScript execution without compilation step
- **Key uses:** Running server-side TypeScript directly (dev servers, scripts)

---

## Testing Tools

### Jest
- **What:** JavaScript test runner
- **Key uses:** Unit tests, integration tests, coverage reporting

### Playwright (library)
- **What:** E2E browser testing framework
- **Key uses:** Full E2E test suites, cross-browser testing, CI pipeline tests

### Axe-core CLI
- **What:** Automated accessibility testing
- **Install:** `npm install -g @axe-core/cli`
- **Key uses:** WCAG compliance checks, accessibility auditing in CI

### Trufflehog
- **What:** Secret scanning for git repositories
- **Key uses:** CI pipeline secret detection, pre-commit security checks

---

## Code Quality

### ESLint
- **What:** JavaScript/TypeScript linter
- **Key uses:** Code style enforcement, error detection, auto-fix

### Prettier
- **What:** Opinionated code formatter
- **Key uses:** Consistent formatting across all files

### Husky + lint-staged
- **What:** Git hooks manager + staged file linting
- **Key uses:** Pre-commit quality gates (lint, format, type-check)

---

## Infrastructure & DevOps

### Docker / Docker Compose
- **What:** Container management and orchestration
- **Key uses:** Local development environments, service isolation, database containers

### psql
- **What:** PostgreSQL command-line client
- **Key uses:** Direct database queries, migrations, debugging

### nvm
- **What:** Node Version Manager
- **Key uses:** Switching between Node versions (18.x / 20.x for CI parity)

---

## Custom Tools

### gb-cli
- **What:** Custom deterministic REST API generator
- **Location:** `~/Desktop/gb-cli/`
- **Built with:** Commander.js, Handlebars, Inquirer, Zod
- **Key uses:** Template-based API scaffolding, consistent service generation

---

## Recommended — Not Yet Adopted

Tools worth evaluating for our workflow. These would extend agentic capabilities significantly.

### MCP Servers (Model Context Protocol)

MCP servers give the agent direct access to external services within conversations.

| MCP Server | What It Does | Why Consider It |
|---|---|---|
| **Chrome MCP** | Control Chrome browser programmatically | Real-time browser interaction beyond Playwright's test scope — live debugging, form filling, navigation |
| **Slack MCP** | Read/send Slack messages | Agent can post deploy notifications, check team messages, respond to alerts |
| **Linear MCP** | Manage Linear issues | If migrating from GitHub Issues — agent can create, update, triage tickets |
| **Postgres MCP** | Direct database access | Agent can query, inspect, debug data without psql setup |
| **Sentry MCP** | Error monitoring access | Agent can check for production errors, correlate with recent deploys |
| **Filesystem MCP** | Enhanced file operations | Extended file management beyond built-in tools |

### CLI Tools

| Tool | What It Does | Why Consider It |
|---|---|---|
| **Terraform CLI** | Infrastructure as code | Codify AWS infrastructure instead of console-clicking |
| **act** | Run GitHub Actions locally | Test CI workflows without pushing — faster feedback loop |
| **k6** | Load testing | Performance testing from CLI, integrates with CI |
| **Lighthouse CLI** | Web performance auditing | Performance, SEO, accessibility scores in CI |
| **Supabase CLI** | Postgres + auth + storage | If evaluating alternatives to raw AWS services |
| **Stripe CLI** | Payment testing | Local webhook testing, fixture data — useful for monetization work |
| **Wrangler (Cloudflare)** | Edge functions & workers | If evaluating edge deployment for latency-sensitive features |
