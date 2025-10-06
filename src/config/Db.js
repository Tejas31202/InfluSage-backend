import dotenv from "dotenv";
import { Client } from "pg";
import redis from "redis";
 
dotenv.config();
 
// ---------- PostgreSQL Client Setup ----------

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,  // Required for Render and AWS RDS
  },
});
 
client.connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(err => console.error("❌ PostgreSQL connection error:", err));
 
// ---------- Redis Client Setup ----------
export const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});
 
redisClient.connect()
  .then(() => console.log("✅ Connected to Redis"))
  .catch((err) => console.error("❌ Redis connection error:", err));
 
export default {
  client,
  redisClient,
};
 
 
 