import { Hono } from 'hono'
import { jwt, sign } from 'hono/jwt'
import { cors } from 'hono/cors'
import { upgradeWebSocket, websocket } from 'hono/bun'
import { db } from './db'
import type { Database } from './db'
import { agents, settings, users, workspaces } from './db/schema'
import { eq } from 'drizzle-orm'
import { resolve } from 'path'
import { mkdir, readdir, stat } from 'fs/promises'

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-change-me'
const WORKDIR = resolve(process.cwd(), '../../.workdir/repos')

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

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// --- Settings routes ---

app.get('/settings/:key', (c) => {
  const key = c.req.param('key')
  const result = c.var.db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get()
  if (!result) return c.json({ key, value: null })
  return c.json({ key: result.key, value: result.value })
})

app.put('/settings/:key', async (c) => {
  const key = c.req.param('key')
  const { value } = await c.req.json<{ value: string }>()

  const existing = c.var.db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get()

  if (existing) {
    c.var.db
      .update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.key, key))
      .run()
  } else {
    c.var.db
      .insert(settings)
      .values({ key, value })
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
  const existing = c.var.db.select().from(workspaces).where(eq(workspaces.name, name)).get()
  if (existing) {
    return c.json({ error: 'Workspace with this name already exists' }, 409)
  }
  const result = c.var.db.insert(workspaces).values({ name, repoPath }).returning().all()
  return c.json(result[0], 201)
})

app.delete('/workspaces/:id', (c) => {
  const id = Number(c.req.param('id'))
  c.var.db.delete(workspaces).where(eq(workspaces.id, id)).run()
  return c.json({ ok: true })
})

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
