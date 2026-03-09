import { db } from '../db'
import { users } from '../db/schema'

const email = process.argv[2]
const password = process.argv[3]

if (!email || !password) {
  console.error('Usage: bun run src/scripts/create-user.ts <email> <password>')
  process.exit(1)
}

const passwordHash = await Bun.password.hash(password)

try {
  const [user] = db
    .insert(users)
    .values({ email, passwordHash })
    .returning()
    .all()

  console.log(`User created: ${user.email} (id: ${user.id})`)
} catch (err: any) {
  if (err.message?.includes('UNIQUE constraint failed')) {
    console.error(`Error: User with email "${email}" already exists.`)
    process.exit(1)
  }
  throw err
}
