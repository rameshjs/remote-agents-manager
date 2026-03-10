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

Create `apps/web/.env` if you need a custom API URL:

```
VITE_API_URL=http://localhost:3000
```

The API reads `ENCRYPTION_SECRET` from `process.env` for encrypting sensitive settings (like GitHub PATs). The default works for local dev but should be changed in production.

4. Initialize the database:

```bash
bun run db:push
```

5. Create your first user:

```bash
bun run create-user your@email.com yourpassword
```

6. Start the development servers:

```bash
bun run dev
```

This starts both:
- API server at `http://localhost:3000`
- Web app at `http://localhost:5173`

7. Open `http://localhost:5173` in your browser and log in with the credentials you created.

## Environment Variables

| Variable | Location | Default | Description |
|---|---|---|---|
| `ENCRYPTION_SECRET` | `process.env` | `change-me-encryption-secret` | AES-256-GCM key for encrypting sensitive settings |
| `VITE_API_URL` | `apps/web/.env` | `http://localhost:3000` | URL of the API server |

## Available Scripts

All commands run from the project root:

```bash
bun run dev                              # Start API and Web in dev mode
bun run build                            # Build all apps
bun run lint                             # Lint all apps
bun run format                           # Format code with Prettier
bun run db:generate                      # Generate Drizzle migrations
bun run db:push                          # Push schema changes to SQLite
bun run db:studio                        # Open Drizzle Studio (database GUI)
bun run create-user <email> <password>   # Create a new user
```

## How It Works

- **Workspaces** point to git repositories (cloned via the UI or existing on disk).
- **Threads** create git worktrees from a workspace, giving each thread an isolated branch and working directory.
- **Terminals** are backed by tmux sessions that persist across page reloads and server restarts.
- **Settings** like GitHub PATs are encrypted at rest using AES-256-GCM.
- **Authentication** uses JWT tokens with a 24-hour expiry.
