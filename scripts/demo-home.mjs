#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = '/tmp/hippo-demo/home';
fs.rmSync(root, { recursive: true, force: true });

const write = (rel, text) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};
const link = (rel, target) => fs.symlinkSync(target, path.join(root, rel));
fs.mkdirSync(root, { recursive: true });
const realRoot = fs.realpathSync(root);
const slug = rel => path.join(realRoot, rel).replace(/[^A-Za-z0-9]/g, '-');
const old = new Date('2026-08-01T09:00:00Z');
const age = (rel, date = old) => fs.utimesSync(path.join(root, rel), date, date);

write('.claude/CLAUDE.md', `# Global rules

## Production safety

- Production is read-only. Never send writes to a production API without asking first.

## Testing

- TDD: write the failing test first, then implement.
- Anything a user can see gets tested in the browser. Always use the \`/browser-testing\` skill for this.

## Git

- Never work on main. Never commit or push unless asked in that turn.
- Before committing or opening a PR, always use the \`/writing-prs\` skill.

## Communication

- Short. No preamble or recap.
- Always use \`/investigating-bugs\` before diagnosing a bug.
`);
write('.claude/settings.json', JSON.stringify({ permissions: { allow: ['Read', 'Grep'], ask: ['Bash(git push*)'], deny: ['Bash(git push --force *)'] } }, null, 2) + '\n');

const skill = (name, description, body) => write(`.claude/skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`);
skill('browser-testing', 'Use whenever testing anything a user can see in the storefront or mobile app. Covers the dev server, light and dark mode, phone width and what counts as a real repro.',
  '# Browser testing\n\n- Dev server on port 3000.\n- Check light mode, dark mode, desktop and 390px.\n- Say what was faked (stubbed responses, injected state).');
skill('writing-prs', 'Use when writing a commit message, PR description or review reply. Covers tone, length and the pre-commit cleanup.',
  '# Writing PRs\n\n- Review the full diff first.\n- Strip comments and console logs you added.\n- Plain prose, a few short paragraphs.');
skill('investigating-bugs', 'Use when a bug report says data is missing or wrong. Covers checking the API before the UI and how to state a cause.',
  '# Investigating bugs\n\n1. Call the endpoint and read the real response.\n2. Check dev and prod.\n3. Only say "confirmed" when you traced the cause end to end.');

write('.cursor/rules/ask-before-committing.mdc', '---\ndescription: Ask before any git commit\nalwaysApply: true\n---\n\nNever commit or push without asking first.\n');

write('code/CLAUDE.md', `# Northwind code

Every Northwind app lives in this folder.

- \`storefront/\`: the customer web shop (React, Vite)
- \`api-gateway/\`: the public API (Node)
- \`mobile-app/\`: the delivery driver app

Shared conventions: TypeScript strict, no \`any\`, Prettier, conventional commit messages.
`);

const sections = ['Checkout', 'Cart', 'Product pages', 'Search', 'Accounts', 'Promotions', 'Inventory sync', 'Analytics', 'Feature flags', 'Error pages'];
let storefront = `# Storefront

The Northwind customer web shop. React 18, Vite, TypeScript.

## Commands

\`\`\`bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
npm run e2e        # Playwright
\`\`\`

## Where the details are

\`docs/claude/architecture.md\` has the full data flow. Read it before changing how orders are saved.

`;
for (const name of sections) {
  storefront += `## ${name}\n\n`;
  for (let i = 1; i <= 19; i++) storefront += `- ${name} note ${i}: keep this behavior when touching the ${name.toLowerCase()} code.\n`;
  storefront += '\n';
}
write('code/storefront/CLAUDE.md', storefront);
link('code/storefront/AGENTS.md', 'CLAUDE.md');
write('code/storefront/docs/claude/architecture.md', '# Storefront architecture\n\nOrders flow from the cart to the checkout service, then to the order API.\n');
write('code/storefront/.claude/rules/forms.md', '---\ndescription: Form conventions\npaths:\n  - "src/forms/**/*.tsx"\n---\n\n- Every input has a label.\n- Show errors under the field, not in a toast.\n');
write('code/storefront/.claude/rules/style.md', '# Code style\n\n- Few comments. Explain why, never what.\n- Prefer a clear name over a comment.\n');
fs.mkdirSync(path.join(root, 'code/storefront/.cursor'), { recursive: true });

write('code/api-gateway/CLAUDE.md', `# API gateway\n\nThe public Northwind API. Node 20, Express.\n\n## Commands\n\n\`\`\`bash\nnpm run dev   # http://localhost:7100\nnpm test\n\`\`\`\n\n## Rules\n\n- Every route needs an integration test.\n- Never log request bodies; they can contain card data.\n`);
fs.mkdirSync(path.join(root, 'code/api-gateway/.cursor'), { recursive: true });

write('code/mobile-app/AGENTS.md', '# Mobile app\n\nThe delivery driver app. React Native.\n\n- Test on a 390px wide screen.\n- Offline first: every write goes through the sync queue.\n');
write('code/mobile-app/.cursor/rules/offline.mdc', '---\ndescription: Offline sync rules\nglobs: src/sync/**/*.ts\nalwaysApply: false\n---\n\n- Writes go through the sync queue, never straight to the API.\n');
write('code/mobile-app/.cursor/rules/legacy-notes.md', '# Old notes\n\nThis file has the wrong extension, so Cursor ignores it.\n');

const mem = `.claude/projects/${slug('code/storefront')}/memory`;
write(`${mem}/MEMORY.md`, '# Memory\n\n- [Checkout totals](feedback_checkout_totals.md) - totals come from the API, never recalculated in the browser\n- [Staging login](reference_staging_login.md) - staging uses a separate test account\n- [Q3 redesign](project_q3_redesign.md) - redesign of product pages, waiting on final designs\n');
write(`${mem}/feedback_checkout_totals.md`, '---\nname: Checkout totals\ndescription: totals come from the API, never recalculated in the browser\nmetadata:\n  type: feedback\n---\n\nShow the total the API returns.\n');
write(`${mem}/reference_staging_login.md`, '---\nname: Staging login\ndescription: staging uses a separate test account\nmetadata:\n  type: reference\n---\n\nUse the staging test account from the team vault.\n');
write(`${mem}/project_q3_redesign.md`, '---\nname: Q3 redesign\ndescription: redesign of product pages, waiting on final designs\nmetadata:\n  type: project\n---\n\nWaiting on final designs.\n');
age(`${mem}/project_q3_redesign.md`);
age('code/api-gateway/CLAUDE.md');

console.log(root);
