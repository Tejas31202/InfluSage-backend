import dotenv from 'dotenv';
import { Client } from 'pg';
import redis from 'redis';
 
dotenv.config();
 
// ---------- PostgreSQL Client Setup ----------
export const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DATABASE, // Make sure this is in your .env
  
});
 
client.connect()
  .then(() => console.log(" Connected to PostgreSQL"))
  .catch((err) => console.error(" PostgreSQL connection error:", err));
 
// ---------- Redis Client Setup ----------
export const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});
 
redisClient.connect()
  .then(() => console.log(" Connected to Redis"))
  .catch((err) => console.error(" Redis connection error:", err));
 
export default {
  client,
  redisClient,
};
 
 
 