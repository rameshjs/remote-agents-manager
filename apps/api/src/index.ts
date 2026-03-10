import { Hono } from 'hono'
import { jwt, sign } from 'hono/jwt'
import { cors } from 'hono/cors'
import { upgradeWebSocket, websocket } from 'hono/bun'
import { db } from './db'
import type { Database } from './db'
import { agents, settings, users, workspaces, threads } from './db/schema'
import { eq } from 'drizzle-orm'
import { resolve } from 'path'
import { mkdir, readdir, readFile, rm, stat } from 'fs/promises'
import type { Subprocess } from 'bun'

// --- Encryption helpers (AES-256-GCM) ---

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('ram-salt'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptValue(plaintext: string, secret: string): Promise<string> {
  const key = await deriveKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  )
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

async function decryptValue(encoded: string, secret: string): Promise<string> {
  const key = await deriveKey(secret)
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  return new TextDecoder().decode(plaintext)
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-change-me'
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'change-me-encryption-secret'
const WORKDIR = resolve(process.cwd(), '../../.workdir/repos')
const WORKTREES_DIR = resolve(process.cwd(), '../../.workdir/worktrees')

type Env = {
  Variables: {
    db: Database
    jwtPayload: { sub: number; email: string; iat: number }
  }
}

const app = new Hono<Env>()

app.use(cors())

app.use(async (c, next) => {
  c.set('db', db)
  await next()
})

// --- Auth routes (public) ---

app.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json<{
    email: string
    password: string
  }>()

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400)
  }

  const user = c.var.db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get()

  if (!user) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const valid = await Bun.password.verify(password, user.passwordHash)
  if (!valid) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const now = Math.floor(Date.now() / 1000)
  const token = await sign(
    { sub: user.id, email: user.email, iat: now, exp: now + 60 * 60 * 24 },
    JWT_SECRET,
    'HS256'
  )

  return c.json({ token })
})

// --- Protected routes ---

app.use(
  '/auth/change-password',
  jwt({ secret: JWT_SECRET, alg: 'HS256' })
)
app.use(
  '/agents/*',
  jwt({ secret: JWT_SECRET, alg: 'HS256' })
)
app.use(
  '/me',
  jwt({ secret: JWT_SECRET, alg: 'HS256' })
)
app.use(
  '/settings/*',
  jwt({ secret: JWT_SECRET, alg: 'HS256' })
)
app.use(
  '/projects',
  jwt({ secret: JWT_SECRET, alg: 'HS256' })
)
app.use(
  '/workspaces/*',
  jwt({ secret: JWT_SECRET, alg: 'HS256' })
)
app.use(
  '/workspaces',
  jwt({ secret: JWT_SECRET, alg: 'HS256' })
)

app.get('/me', (c) => {
  const payload = c.get('jwtPayload')
  return c.json({ id: payload.sub, email: payload.email })
})

app.post('/auth/change-password', async (c) => {
  const payload = c.get('jwtPayload')
  const { currentPassword, newPassword } = await c.req.json<{
    currentPassword: string
    newPassword: string
  }>()

  if (!currentPassword || !newPassword) {
    return c.json({ error: 'Current password and new password are required' }, 400)
  }

  if (newPassword.length < 6) {
    return c.json({ error: 'New password must be at least 6 characters' }, 400)
  }

  const user = c.var.db.select().from(users).where(eq(users.id, payload.sub)).get()
  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  const valid = await Bun.password.verify(currentPassword, user.passwordHash)
  if (!valid) {
    return c.json({ error: 'Current password is incorrect' }, 401)
  }

  const newHash = await Bun.password.hash(newPassword)
  c.var.db.update(users).set({ passwordHash: newHash }).where(eq(users.id, payload.sub)).run()

  return c.json({ ok: true })
})

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// --- Settings routes ---

app.get('/settings/:key', async (c) => {
  const key = c.req.param('key')
  const result = c.var.db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get()
  if (!result) return c.json({ key, value: null })

  // Decrypt github_pat using env secret
  if (key === 'github_pat' && result.value) {
    try {
      const decrypted = await decryptValue(result.value, ENCRYPTION_SECRET)
      return c.json({ key: result.key, value: decrypted })
    } catch {
      return c.json({ key: result.key, value: null, error: 'Decryption failed' })
    }
  }

  return c.json({ key: result.key, value: result.value })
})

app.put('/settings/:key', async (c) => {
  const key = c.req.param('key')
  const { value } = await c.req.json<{ value: string }>()

  let storeValue = value

  // Encrypt github_pat using env secret
  if (key === 'github_pat' && value) {
    storeValue = await encryptValue(value, ENCRYPTION_SECRET)
  }

  const existing = c.var.db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get()

  if (existing) {
    c.var.db
      .update(settings)
      .set({ value: storeValue, updatedAt: new Date() })
      .where(eq(settings.key, key))
      .run()
  } else {
    c.var.db
      .insert(settings)
      .values({ key, value: storeValue })
      .run()
  }

  return c.json({ key, value })
})

// --- Agents routes ---

app.get('/agents', (c) => {
  const result = c.var.db.select().from(agents).all()
  return c.json(result)
})

app.post('/agents', async (c) => {
  const body = await c.req.json<{ name: string; endpoint: string }>()
  const result = c.var.db.insert(agents).values(body).returning().all()
  return c.json(result[0], 201)
})

app.get('/agents/:id', (c) => {
  const id = Number(c.req.param('id'))
  const result = c.var.db
    .select()
    .from(agents)
    .where(eq(agents.id, id))
    .get()
  if (!result) return c.json({ error: 'Agent not found' }, 404)
  return c.json(result)
})

// --- Projects routes (list repos in .workdir/repos) ---

app.get('/projects', async (c) => {
  try {
    await mkdir(WORKDIR, { recursive: true })
    const entries = await readdir(WORKDIR, { withFileTypes: true })
    const projects = entries
      .filter((e) => e.isDirectory())
      .map((e) => ({ name: e.name, path: resolve(WORKDIR, e.name) }))
    return c.json(projects)
  } catch {
    return c.json([])
  }
})

// --- Workspaces routes ---

app.get('/workspaces', (c) => {
  const result = c.var.db.select().from(workspaces).all()
  return c.json(result)
})

app.post('/workspaces', async (c) => {
  const { name, repoPath } = await c.req.json<{ name: string; repoPath: string }>()
  if (!name || !repoPath) {
    return c.json({ error: 'name and repoPath are required' }, 400)
  }
  const result = c.var.db.insert(workspaces).values({ name, repoPath }).returning().all()
  return c.json(result[0], 201)
})

app.patch('/workspaces/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const { name } = await c.req.json<{ name: string }>()
  if (!name) {
    return c.json({ error: 'name is required' }, 400)
  }
  const existing = c.var.db.select().from(workspaces).where(eq(workspaces.id, id)).get()
  if (!existing) {
    return c.json({ error: 'Workspace not found' }, 404)
  }
  c.var.db.update(workspaces).set({ name }).where(eq(workspaces.id, id)).run()
  const updated = c.var.db.select().from(workspaces).where(eq(workspaces.id, id)).get()
  return c.json(updated)
})

app.delete('/workspaces/:id', async (c) => {
  const id = Number(c.req.param('id'))

  // Get all threads for this workspace to clean up worktrees
  const wsThreads = c.var.db.select().from(threads).where(eq(threads.workspaceId, id)).all()

  // Remove tmux sessions, worktree directories, and prune from git
  for (const thread of wsThreads) {
    killTmuxSession(thread.id)
    try {
      const ws = c.var.db.select().from(workspaces).where(eq(workspaces.id, id)).get()
      if (ws) {
        await Bun.spawn(['git', 'worktree', 'remove', '--force', thread.worktreePath], {
          cwd: ws.repoPath,
          stdout: 'ignore',
          stderr: 'ignore',
        }).exited
      }
    } catch {
      try {
        await rm(thread.worktreePath, { recursive: true, force: true })
      } catch {
        // ignore cleanup errors
      }
    }
  }

  // Delete threads (cascade should handle this, but be explicit)
  c.var.db.delete(threads).where(eq(threads.workspaceId, id)).run()
  c.var.db.delete(workspaces).where(eq(workspaces.id, id)).run()
  return c.json({ ok: true })
})

// --- Threads routes (worktrees per workspace) ---

app.get('/workspaces/:id/threads', (c) => {
  const workspaceId = Number(c.req.param('id'))
  const result = c.var.db.select().from(threads).where(eq(threads.workspaceId, workspaceId)).all()
  return c.json(result)
})

app.post('/workspaces/:id/threads', async (c) => {
  const workspaceId = Number(c.req.param('id'))
  const { name } = await c.req.json<{ name: string }>()

  if (!name) {
    return c.json({ error: 'name is required' }, 400)
  }

  const ws = c.var.db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).get()
  if (!ws) {
    return c.json({ error: 'Workspace not found' }, 404)
  }

  // Create a branch name from the thread name
  const branchName = `thread/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`

  // Create worktree directory
  await mkdir(WORKTREES_DIR, { recursive: true })
  const worktreePath = resolve(WORKTREES_DIR, `${workspaceId}-${branchName.replace(/\//g, '-')}`)

  // Create git worktree
  const proc = Bun.spawn(['git', 'worktree', 'add', '-b', branchName, worktreePath], {
    cwd: ws.repoPath,
    stderr: 'pipe',
    stdout: 'pipe',
  })

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    return c.json({ error: `Failed to create worktree: ${stderr}` }, 500)
  }

  const result = c.var.db
    .insert(threads)
    .values({ workspaceId, name, branchName, worktreePath })
    .returning()
    .all()

  return c.json(result[0], 201)
})

app.delete('/workspaces/:wsId/threads/:threadId', async (c) => {
  const wsId = Number(c.req.param('wsId'))
  const threadId = Number(c.req.param('threadId'))

  const thread = c.var.db.select().from(threads).where(eq(threads.id, threadId)).get()
  if (!thread || thread.workspaceId !== wsId) {
    return c.json({ error: 'Thread not found' }, 404)
  }

  const ws = c.var.db.select().from(workspaces).where(eq(workspaces.id, wsId)).get()

  // Kill tmux session and remove git worktree
  killTmuxSession(threadId)
  if (ws) {
    try {
      await Bun.spawn(['git', 'worktree', 'remove', '--force', thread.worktreePath], {
        cwd: ws.repoPath,
        stdout: 'ignore',
        stderr: 'ignore',
      }).exited
    } catch {
      try {
        await rm(thread.worktreePath, { recursive: true, force: true })
      } catch {
        // ignore
      }
    }
  }

  c.var.db.delete(threads).where(eq(threads.id, threadId)).run()
  return c.json({ ok: true })
})

// --- Thread status route ---

app.get('/workspaces/:wsId/threads/:threadId/status', (c) => {
  const threadId = Number(c.req.param('threadId'))
  const thread = c.var.db.select().from(threads).where(eq(threads.id, threadId)).get()
  if (!thread) return c.json({ error: 'Thread not found' }, 404)
  return c.json({ status: thread.status })
})

// --- Git pull (fetch latest) for workspace ---

app.post('/workspaces/:id/pull', async (c) => {
  const id = Number(c.req.param('id'))
  const ws = c.var.db.select().from(workspaces).where(eq(workspaces.id, id)).get()
  if (!ws) return c.json({ error: 'Workspace not found' }, 404)

  const proc = Bun.spawn(['git', 'pull', '--ff-only'], {
    cwd: ws.repoPath,
    stderr: 'pipe',
    stdout: 'pipe',
  })

  const exitCode = await proc.exited
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()

  if (exitCode !== 0) {
    return c.json({ error: `Git pull failed: ${stderr}` }, 500)
  }

  return c.json({ ok: true, message: stdout.trim() || 'Already up to date.' })
})

// --- Git diff for a thread worktree ---

app.get('/workspaces/:wsId/threads/:threadId/diff', async (c) => {
  const threadId = Number(c.req.param('threadId'))
  const thread = c.var.db.select().from(threads).where(eq(threads.id, threadId)).get()
  if (!thread) return c.json({ error: 'Thread not found' }, 404)

  const diffProc = Bun.spawn(['git', 'diff', 'HEAD'], {
    cwd: thread.worktreePath,
    stderr: 'pipe',
    stdout: 'pipe',
  })
  const diffCode = await diffProc.exited
  let diff = await new Response(diffProc.stdout).text()

  const statusProc = Bun.spawn(['git', 'status', '--porcelain'], {
    cwd: thread.worktreePath,
    stderr: 'pipe',
    stdout: 'pipe',
  })
  await statusProc.exited
  const status = await new Response(statusProc.stdout).text()

  // Generate diffs for untracked files so they show content in the UI
  const untrackedFiles = status
    .split('\n')
    .filter((line) => line.startsWith('??'))
    .map((line) => line.substring(3).trim())

  for (const filePath of untrackedFiles) {
    try {
      const absolute = resolve(thread.worktreePath, filePath)
      if (!absolute.startsWith(thread.worktreePath)) continue
      const info = await stat(absolute)
      if (!info.isFile() || info.size > 256 * 1024) continue

      const content = await readFile(absolute, 'utf-8')
      const lines = content.split('\n')
      const header = [
        `diff --git a/${filePath} b/${filePath}`,
        'new file mode 100644',
        '--- /dev/null',
        `+++ b/${filePath}`,
        `@@ -0,0 +1,${lines.length} @@`,
      ].join('\n')
      const body = lines.map((l) => `+${l}`).join('\n')
      diff += `\n${header}\n${body}\n`
    } catch {
      // skip files that can't be read
    }
  }

  return c.json({ diff, status, exitCode: diffCode })
})

// --- File tree for a thread worktree ---

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

async function buildFileTree(dir: string, prefix = ''): Promise<FileNode[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nodes: FileNode[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.git') || entry.name === 'node_modules') continue
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      const children = await buildFileTree(resolve(dir, entry.name), fullPath)
      nodes.push({ name: entry.name, path: fullPath, type: 'directory', children })
    } else {
      nodes.push({ name: entry.name, path: fullPath, type: 'file' })
    }
  }

  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name)
    return a.type === 'directory' ? -1 : 1
  })
}

app.get('/workspaces/:wsId/threads/:threadId/files', async (c) => {
  const threadId = Number(c.req.param('threadId'))
  const thread = c.var.db.select().from(threads).where(eq(threads.id, threadId)).get()
  if (!thread) return c.json({ error: 'Thread not found' }, 404)

  try {
    const files = await buildFileTree(thread.worktreePath)
    return c.json({ files, worktreePath: thread.worktreePath })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to read file tree'
    return c.json({ error: message }, 500)
  }
})

// --- Read file content from a thread worktree ---

app.get('/workspaces/:wsId/threads/:threadId/file', async (c) => {
  const threadId = Number(c.req.param('threadId'))
  const filePath = c.req.query('path')
  if (!filePath) return c.json({ error: 'path query param is required' }, 400)

  const thread = c.var.db.select().from(threads).where(eq(threads.id, threadId)).get()
  if (!thread) return c.json({ error: 'Thread not found' }, 404)

  // Prevent path traversal
  const absolute = resolve(thread.worktreePath, filePath)
  if (!absolute.startsWith(thread.worktreePath)) {
    return c.json({ error: 'Invalid path' }, 400)
  }

  try {
    const info = await stat(absolute)
    if (!info.isFile()) return c.json({ error: 'Not a file' }, 400)
    if (info.size > 512 * 1024) return c.json({ error: 'File too large (max 512KB)' }, 400)

    const content = await readFile(absolute, 'utf-8')
    return c.json({ content, path: filePath })
  } catch {
    return c.json({ error: 'File not found' }, 404)
  }
})

// --- tmux-based terminal sessions ---
// tmux sessions persist independently of this process, surviving server restarts.
// Each thread can have multiple terminals, each backed by its own tmux session.

const TMUX_PREFIX = 'ram-'

function tmuxSessionName(threadId: number, terminalId: number) {
  return `${TMUX_PREFIX}${threadId}-${terminalId}`
}

function ensureTmuxSession(threadId: number, terminalId: number, worktreePath: string) {
  const name = tmuxSessionName(threadId, terminalId)
  const check = Bun.spawnSync(['tmux', 'has-session', '-t', name], {
    stdout: 'ignore',
    stderr: 'ignore',
  })
  if (check.exitCode === 0) return // session already exists

  const result = Bun.spawnSync(
    ['tmux', 'new-session', '-d', '-s', name, '-c', worktreePath, '-x', '80', '-y', '24'],
    { stderr: 'pipe' }
  )
  if (result.exitCode !== 0) {
    throw new Error(`tmux new-session failed: ${result.stderr.toString()}`)
  }

  // Enable mouse scrolling and set scrollback buffer
  Bun.spawnSync(['tmux', 'set-option', '-t', name, 'mouse', 'on'], {
    stdout: 'ignore',
    stderr: 'ignore',
  })
  Bun.spawnSync(['tmux', 'set-option', '-t', name, 'history-limit', '10000'], {
    stdout: 'ignore',
    stderr: 'ignore',
  })
}

function killTmuxSession(threadId: number, terminalId?: number) {
  if (terminalId !== undefined) {
    Bun.spawnSync(['tmux', 'kill-session', '-t', tmuxSessionName(threadId, terminalId)], {
      stdout: 'ignore',
      stderr: 'ignore',
    })
  } else {
    // Kill all tmux sessions for this thread
    const result = Bun.spawnSync(['tmux', 'list-sessions', '-F', '#{session_name}'], {
      stdout: 'pipe',
      stderr: 'ignore',
    })
    if (result.exitCode === 0) {
      const prefix = `${TMUX_PREFIX}${threadId}-`
      const sessions = result.stdout.toString().split('\n').filter((s) => s.startsWith(prefix))
      for (const s of sessions) {
        Bun.spawnSync(['tmux', 'kill-session', '-t', s], {
          stdout: 'ignore',
          stderr: 'ignore',
        })
      }
    }
  }
}

// Active tmux attach processes — keyed by "threadId-terminalId"
const attachments = new Map<
  string,
  { proc: Subprocess; ws: { send: (data: string) => void } | null }
>()

app.get(
  '/ws/terminal/:threadId/:terminalId',
  upgradeWebSocket((c) => {
    const threadId = Number(c.req.param('threadId'))
    const terminalId = Number(c.req.param('terminalId'))
    const attachKey = `${threadId}-${terminalId}`

    return {
      onOpen(_event, ws) {
        const thread = db.select().from(threads).where(eq(threads.id, threadId)).get()
        if (!thread) {
          ws.send(JSON.stringify({ type: 'error', message: 'Thread not found' }))
          ws.close()
          return
        }

        // Kill previous attach process if any (session stays alive)
        const prev = attachments.get(attachKey)
        if (prev) {
          prev.ws = null
          prev.proc.kill()
          attachments.delete(attachKey)
        }

        try {
          ensureTmuxSession(threadId, terminalId, thread.worktreePath)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to create tmux session'
          ws.send(JSON.stringify({ type: 'error', message: msg }))
          ws.close()
          return
        }

        const sessionName = tmuxSessionName(threadId, terminalId)
        const attachment = { proc: null as any as Subprocess, ws: ws as any }

        const proc = Bun.spawn(['tmux', 'attach', '-t', sessionName], {
          env: { ...process.env, TERM: 'xterm-256color' },
          terminal: {
            cols: 80,
            rows: 24,
            data(_terminal: any, data: any) {
              const str = data.toString()
              if (attachment.ws) {
                try {
                  attachment.ws.send(JSON.stringify({ type: 'output', data: str }))
                } catch {
                  // WebSocket might be closed
                }
              }
            },
          },
        })

        attachment.proc = proc
        attachments.set(attachKey, attachment)

        // When the attach process exits, the tmux session may have ended (shell exited)
        proc.exited.then((code) => {
          attachments.delete(attachKey)

          // Check if the tmux session is actually gone (shell exited vs detached)
          const still = Bun.spawnSync(['tmux', 'has-session', '-t', sessionName], {
            stdout: 'ignore',
            stderr: 'ignore',
          })
          if (still.exitCode !== 0) {
            if (attachment.ws) {
              try {
                attachment.ws.send(JSON.stringify({ type: 'exit', code }))
              } catch {
                // ignore
              }
            }
          }
        })

        ws.send(JSON.stringify({ type: 'connected', threadId, terminalId }))
      },

      onMessage(event, _ws) {
        const attachment = attachments.get(attachKey)
        if (!attachment?.proc?.terminal) return

        try {
          const msg = JSON.parse(event.data as string)

          if (msg.type === 'input') {
            attachment.proc.terminal.write(msg.data)
          } else if (msg.type === 'resize') {
            attachment.proc.terminal.resize(msg.cols, msg.rows)
          }
        } catch {
          // If not JSON, treat as raw input
          if (typeof event.data === 'string') {
            attachment.proc.terminal.write(event.data)
          }
        }
      },

      onClose() {
        // Kill the attach process — tmux session stays alive
        const attachment = attachments.get(attachKey)
        if (attachment) {
          attachment.ws = null
          attachment.proc.kill()
          attachments.delete(attachKey)
        }
      },
    }
  })
)

// --- WebSocket: Clone repo ---

app.get(
  '/ws/clone',
  upgradeWebSocket(() => {
    return {
      async onMessage(event, ws) {
        try {
          const data = JSON.parse(event.data as string)
          const { repoUrl, token } = data as { repoUrl: string; token?: string }

          if (!repoUrl) {
            ws.send(JSON.stringify({ type: 'error', message: 'Repository URL is required' }))
            return
          }

          // Validate URL format
          let cloneUrl = repoUrl.trim()
          if (!/^https?:\/\/.+/.test(cloneUrl) && !/^git@.+/.test(cloneUrl)) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid repository URL' }))
            return
          }

          // If PAT token provided, inject into HTTPS URL
          if (token && cloneUrl.startsWith('https://')) {
            const url = new URL(cloneUrl)
            url.username = token
            cloneUrl = url.toString()
          }

          // Extract repo name from URL
          const repoName = cloneUrl
            .replace(/\.git$/, '')
            .split('/')
            .pop() || 'repo'

          const targetDir = resolve(WORKDIR, repoName)

          // Ensure .workdir/repos exists
          await mkdir(WORKDIR, { recursive: true })

          ws.send(JSON.stringify({ type: 'log', message: `Cloning into ${repoName}...` }))

          const proc = Bun.spawn(['git', 'clone', '--progress', cloneUrl, targetDir], {
            stderr: 'pipe',
            stdout: 'pipe',
          })

          // Stream stderr (git clone outputs progress to stderr)
          const stderrReader = proc.stderr.getReader()
          const decoder = new TextDecoder()

          const readStream = async () => {
            while (true) {
              const { done, value } = await stderrReader.read()
              if (done) break
              const text = decoder.decode(value, { stream: true })
              const lines = text.split(/\r?\n|\r/).filter(Boolean)
              for (const line of lines) {
                ws.send(JSON.stringify({ type: 'log', message: line }))
              }
            }
          }

          // Also read stdout
          const stdoutReader = proc.stdout.getReader()
          const readStdout = async () => {
            while (true) {
              const { done, value } = await stdoutReader.read()
              if (done) break
              const text = decoder.decode(value, { stream: true })
              const lines = text.split(/\r?\n|\r/).filter(Boolean)
              for (const line of lines) {
                ws.send(JSON.stringify({ type: 'log', message: line }))
              }
            }
          }

          await Promise.all([readStream(), readStdout()])
          const exitCode = await proc.exited

          if (exitCode === 0) {
            ws.send(JSON.stringify({
              type: 'complete',
              message: `Repository cloned successfully to ${repoName}`,
              repoName,
              path: targetDir,
            }))
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: `Clone failed with exit code ${exitCode}`,
            }))
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          ws.send(JSON.stringify({ type: 'error', message }))
        }
      },
      onClose() {
        console.log('Clone WebSocket closed')
      },
    }
  })
)

export default {
  fetch: app.fetch,
  websocket,
}
