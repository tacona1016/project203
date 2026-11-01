# Repository Guidelines

## Project Structure & Module Organization

Next.js App Router, TypeScript, Tailwind CSS, MDX, Supabase, and Vercel.

- `app/`: Home, Archive, Polls, Board, Admin, `/access`, and protected APIs.
- `components/presentation/`: MDX layouts; `interactive/`, `board/`, `admin/`, `access/`: feature UI.
- `data/`: quarter/project information; participants live in Supabase.
- `lib/auth/`: member/admin sessions; `lib/supabase/` and `lib/board/`: server data access.
- `public/images/<quarter>/`: public presentation graphics; `private-assets/site/`: protected photos.
- `supabase/`: schema, seeds, migrations, TEST-only SQL; `tests/`: Node tests and local HTTP/browser fixtures.
- `scripts/`: diagnostics and presentation validation; `docs/`: operations, decisions, backup/restore.

Register quarters in `data/quarters.ts`; published presentations need `app/quarter/<slug>/page.mdx`. Unpublished quarters may host polls. `mdx-components.tsx` registers components.

## Build, Test, and Development Commands

Use Node.js 22+; use `npm.cmd` if PowerShell blocks npm.

- `npm ci`: install locked dependencies.
- `npm run dev`: start local development.
- `npm run check:presentations`: validate publication metadata and MDX files.
- `npm run build`: run presentation validation, then production compilation.
- `npm run start`: serve the production build.
- `npm run lint` / `npm run typecheck`: ESLint and strict TypeScript/route checks.
- `npm test`: Node test runner; no separate coverage threshold.
- `npm run test:integration`, `npm run test:browser`, `npm run test:production`: synthetic HTTP fixtures; browser tests need Chrome.
- `npm run check:supabase`: read-only server-key DB diagnostics, not anonymous access tests.

## Coding Style & Naming Conventions

Use two-space indentation, double quotes, semicolons, PascalCase component filenames, and camelCase functions. Prefer `@/` imports. ESLint is configured; Prettier is not.

Keep MDX content separate from server database work. Prefer Server Components and reuse existing theme/components.

## Testing Guidelines

Inspect impact and preserve behavior. Run relevant tests, lint, typecheck, and build. Add `tests/*.test.mjs` regressions; distinguish fixtures from PostgreSQL/deployment checks. `.verification/` is ignored QA output. Check authentication, recovery, publication, votes/results, Board/comments, Admin permissions, and responsiveness as affected.

## Commit & Pull Request Guidelines

Use focused imperative subjects. PRs explain behavior, validation, SQL/security impact, and UI evidence. Push/deployment requires explicit authorization.

## Security & Configuration

Member login verifies an active UUID/password and issues a 30-day signed HttpOnly cookie. Admin adds separate 8-hour authentication. Derive authorship only from server sessions. Fail closed; distinguish outages from invalid credentials without deleting cookies or granting access.

Server secrets: `SITE_SESSION_SECRET`, `BOARD_PARTICIPANT_PASSWORDS` (site-wide UUID/password mapping), `ADMIN_PASSWORD`, `SUPABASE_SECRET_KEY`. Public config: `NEXT_PUBLIC_SUPABASE_URL`. Keep `.env.local`, secrets, cookies, personal data, and backups out of logs/Git/browser bundles. Retired `SITE_ACCESS_PASSWORD` is only for rollback.

Keep Supabase server-only and direct browser access revoked. Document schema changes, review RLS/grants, and preserve UUIDs/data. Destructive SQL, production restore/migrations/tests require approval. Follow `docs/BACKUP_RESTORE.md`. Use subagents only for independent tasks with nonoverlapping files.

## Session Handoff

For long-running tasks, maintain `docs/SESSION_HANDOFF.md`. Record the current development goal, completed work, changed files, unfinished work, errors, next actions, and test results. Update it after each major work unit and before a planned pause or handoff.

When resuming after a usage limit or interruption, read this file first, then compare it with the current Git diff. Continue unfinished work without repeating completed implementation. Distinguish completed tests from unverified checks and pending approvals. Never record secrets, credentials, cookie values, or personal data.
