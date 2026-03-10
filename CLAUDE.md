# Remote Agents Manager

A full-stack web application for managing git repositories with per-workspace threads (git worktrees), tmux-backed terminal sessions, file browsing, and diff visualization.

## Tech Stack

- **Monorepo**: Turborepo with Bun workspaces
- **Runtime**: Bun
- **API** (`apps/api`): Hono, Drizzle ORM, SQLite (better-sqlite3)
- **Web** (`apps/web`): React 19, Vite, Tailwind CSS 4, shadcn/ui, React Router, React Query
- **Terminal**: xterm.js frontend, tmux backend
- **Auth**: JWT (HS256) with Bun.password hashing
- **Encryption**: AES-256-GCM via crypto.subtle for sensitive settings

## Project Structure

```
apps/
  api/          # Hono backend (port 3000)
    src/
      index.ts          # All API routes and WebSocket handlers
      db/
        index.ts        # Drizzle DB connection
        schema.ts       # DB schema (settings, users, workspaces, threads, agents)
      scripts/
        create-user.ts  # CLI script to create users
    drizzle.config.ts   # Drizzle Kit config
  web/          # React frontend (port 5173)
    src/
      lib/axios.ts      # API client with auth interceptors
      components/       # UI components (shadcn/ui based)
      pages/            # Route pages
packages/       # Shared packages (currently empty)
.workdir/       # Runtime data (gitignored)
  repos/        # Cloned git repositories
  worktrees/    # Git worktrees (one per thread)
```

## Environment Variables

- `ENCRYPTION_SECRET` — AES-256-GCM key for encrypting settings like GitHub PATs (default: `change-me-encryption-secret`)
- `VITE_API_URL` — API base URL in `apps/web/.env` (default: `http://localhost:3000`)

## Commands

All commands run from the project root:

```bash
bun install                              # Install dependencies
bun run dev                              # Start API + Web in dev mode
bun run build                            # Build all apps
bun run db:generate                      # Generate Drizzle migrations
bun run db:push                          # Push schema to DB (creates sqlite.db)
bun run db:studio                        # Open Drizzle Studio
bun run create-user <email> <password>   # Create a user
```

## Database

SQLite file at `apps/api/sqlite.db`. Schema managed by Drizzle ORM.

Tables: `users`, `workspaces`, `threads`, `settings`, `agents`

Run `bun run db:push` to initialize.

## API Routes

Public:
- `POST /auth/login` — returns JWT token

Protected (Bearer token required):
- `GET /me` — current user
- `POST /auth/change-password`
- `GET|PUT /settings/:key` — encrypted settings (github_pat uses AES-256-GCM)
- `GET|POST /agents`, `GET /agents/:id`
- `GET /projects` — list cloned repos in .workdir/repos
- `GET|POST|PATCH|DELETE /workspaces`
- `GET|POST|DELETE /workspaces/:id/threads`
- `GET /workspaces/:wsId/threads/:threadId/diff`
- `GET /workspaces/:wsId/threads/:threadId/files`
- `GET /workspaces/:wsId/threads/:threadId/file?path=`
- `POST /workspaces/:id/pull`

WebSocket:
- `GET /ws/terminal/:threadId/:terminalId` — tmux terminal session
- `GET /ws/clone` — repo cloning with progress

## Key Patterns

- All API routes are in a single `apps/api/src/index.ts` file
- Frontend uses Axios with JWT interceptor (auto-redirect to /login on 401)
- Terminal sessions use tmux — sessions survive server restarts
- Threads create git worktrees for isolated branch work
- Path alias: `@/` maps to `src/` in the web app
- No Docker setup — runs locally with Bun
