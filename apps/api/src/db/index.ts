import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema'

const db = drizzle('./sqlite.db', { schema })

export { db }
export type Database = typeof db
