# Repository Guidelines

## Project Structure & Module Organization

Built with Next.js App Router, TypeScript, Tailwind CSS, and MDX.

- `app/`: routes, layouts, global styles, and quarterly `page.mdx` files.
- `components/presentation/`: reusable MDX layouts; `components/interactive/`: names, polls, and comments.
- `data/`: quarter metadata and participant names.
- `lib/supabase/`: clients, queries, types, and errors.
- `public/images/<quarter>/`: presentation assets.
- `supabase/`: initial schema, seed data, and migrations; `scripts/`: diagnostics.
- `mdx-components.tsx`: shared MDX component registration.

Add quarters as `app/quarter/2027-q1/page.mdx` with matching metadata in `data/quarters.ts`.

## Build, Test, and Development Commands

Use Node.js 22+ and npm. Use `npm.cmd` if PowerShell blocks `npm`.

- `npm ci`: install locked dependencies.
- `npm run dev`: start local development.
- `npm run build`: compile MDX and build for production.
- `npm run start`: serve the production build.
- `npm run lint`: run Next.js ESLint rules.
- `npm run typecheck`: generate route types and check strict TypeScript.
- `npm run check:supabase`: check public database reads without modifying data.

## Coding Style & Naming Conventions

Use two-space indentation, double quotes, semicolons, PascalCase component filenames, and camelCase functions. Prefer `@/` imports. ESLint is configured; Prettier is not.

Keep presentation content in MDX and database logic in `lib/supabase/`. Reuse components instead of repeating Tailwind classes in MDX. Default to Server Components; use Client Components for browser interactions. Preserve the minimal design and existing theme tokens.

## Testing Guidelines

No test runner or coverage threshold is configured. `.verification/` contains ignored local QA artifacts. Run lint, typecheck, and build for code changes. Check `/`, Archive links, and `/quarter/2026-q4` on desktop and mobile. For interaction changes, verify name persistence, voting, comments, loading, and failure recovery. Distinguish mocked checks from live database verification. If adding automated tests, use names such as `Poll.test.tsx` and document the runner.

## Commit & Pull Request Guidelines

History uses subjects like `Initial` and `.`, without a consistent convention. Prefer descriptive imperative subjects, such as `Fix poll slug lookup`. Keep commits focused. PRs should explain behavior, list validation and required SQL changes, link relevant issues, and include screenshots for UI changes.

## Security & Configuration

Keep `.env.local` untracked. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` locally and in Vercel; never expose secret or service-role keys. Redeploy after environment changes.

Names are identifiers, not authentication. Preserve anonymous read/insert permissions and existing update/delete restrictions unless explicitly requested. MDX `pollId` identifies `polls.slug`; use the resolved database ID for foreign keys. Preserve existing records through migrations.
