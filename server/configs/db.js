import { neon } from "@neondatabase/serverless"

const pgsql = neon(`${process.env.DATABASE_URL}`)

export default pgsql