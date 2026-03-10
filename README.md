# Remote Agents Manager

A web application for managing git repositories with isolated workspaces, tmux-backed terminals, file browsing, and diff visualization. Each workspace maps to a git repo, and threads create git worktrees for isolated branch work.

## Requirements

Before setting up, make sure you have the following installed:

- **Bun** (v1.3.9 or later) — JavaScript runtime and package manager
  - Install: `curl -fsSL https://bun.sh/install | bash`
- **Git** — version control
- **tmux** — terminal multiplexer (used for persistent terminal sessions)
  - Ubuntu/Debian: `sudo apt install tmux`
  - macOS: `brew install tmux`
- **Node.js** (v18 or later) — required by some tooling
- **SQLite3** — ships with Bun, no separate install needed

## Setup

1. Clone the repository:

```bash
git clone <repo-url>
cd remote-agents-manager
```

2. Install dependencies:

```bash
bun install
```

3. Set up environment variables (optional — defaults work for local dev):

Create `apps/api/.env`:

```
JWT_SECRET=your-jwt-secret-here
ENCRYPTION_SECRET=your-encryption-secret-here
```

Create `apps/web/.env`:

```
VITE_API_URL=http://localhost:3000
```

4. Initialize the database:

```bash
cd apps/api
bun run db:push
```

5. Create your first user:

```bash
cd apps/api
bun run create-user your@email.com yourpassword
```

6. Start the development servers:

```bash
# From the project root
bun run dev
```

This starts both:
- API server at `http://localhost:3000`
- Web app at `http://localhost:5173`

7. Open `http://localhost:5173` in your browser and log in with the credentials you created.

## Environment Variables

| Variable | Location | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | `apps/api/.env` | `super-secret-change-me` | Secret for signing JWT tokens |
| `ENCRYPTION_SECRET` | `apps/api/.env` | `change-me-encryption-secret` | Secret for AES-256-GCM encryption of sensitive settings |
| `VITE_API_URL` | `apps/web/.env` | `http://localhost:3000` | URL of the API server |

## Project Structure

```
remote-agents-manager/
  apps/
    api/            Hono backend API (SQLite + Drizzle ORM)
    web/            React frontend (Vite + Tailwind + shadcn/ui)
  packages/         Shared packages (currently empty)
  .workdir/         Runtime data (gitignored)
    repos/          Cloned git repositories
    worktrees/      Git worktrees for threads
```

## Available Scripts

From the project root:

```bash
bun run dev         # Start API and Web in development mode
bun run build       # Build all apps
bun run lint        # Lint all apps
bun run format      # Format code with Prettier
```

From `apps/api`:

```bash
bun run dev             # Start API with hot reload
bun run db:generate     # Generate Drizzle migrations
bun run db:push         # Push schema changes to SQLite
bun run db:studio       # Open Drizzle Studio (database GUI)
bun run create-user     # Create a new user
```

From `apps/web`:

```bash
bun run dev         # Start Vite dev server
bun run build       # Production build
bun run preview     # Preview production build
bun run lint        # ESLint
bun run format      # Prettier
```

## How It Works

- **Workspaces** point to git repositories (cloned via the UI or existing on disk).
- **Threads** create git worktrees from a workspace, giving each thread an isolated branch and working directory.
- **Terminals** are backed by tmux sessions that persist across page reloads and server restarts.
- **Settings** like GitHub PATs are encrypted at rest using AES-256-GCM.
- **Authentication** uses JWT tokens with a 24-hour expiry.
