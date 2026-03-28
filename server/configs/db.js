import { neon } from '@neondatabase/serverless';
import { configDotenv } from 'dotenv';
configDotenv();

const pgsql = neon(`${process.env.DATABASE_URL}`);

export default pgsql;
