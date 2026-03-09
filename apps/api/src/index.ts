import { Hono } from 'hono'
import { jwt, sign } from 'hono/jwt'
import { cors } from 'hono/cors'
import { db } from './db'
import type { Database } from './db'
import { agents, users } from './db/schema'
import { eq } from 'drizzle-orm'

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-change-me'

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

app.get('/me', (c) => {
  const payload = c.get('jwtPayload')
  return c.json({ id: payload.sub, email: payload.email })
})

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

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

export default app
