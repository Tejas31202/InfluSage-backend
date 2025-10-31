import dotenv from "dotenv";
import pkg from "pg";
import { createClient as createRedisClient } from "redis";

dotenv.config();

const { Client } = pkg;

// ✅ PostgreSQL client setup
export const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: {
    require: true,
    rejectUnauthorized: false, // Required for Render & Supabase
  },
});

// ✅ Connect once (no repeated reconnect loops)
const connectPostgres = async () => {
  try {
    await client.connect();
    console.log("✅ Connected to PostgreSQL");
  } catch (err) {
    console.error("❌ PostgreSQL connection error:", err.message);
    // Retry only if failed to connect initially
    setTimeout(connectPostgres, 5000);
  }
};

connectPostgres();

// ✅ Handle PostgreSQL disconnections gracefully
client.on("error", async (err) => {
  console.error("⚠️ PostgreSQL client error:", err.message);
  console.log("♻️ Attempting PostgreSQL reconnect...");
  try {
    await client.end().catch(() => {}); // safely close old client
    await client.connect();
    console.log("✅ PostgreSQL reconnected successfully");
  } catch (reconnectErr) {
    console.error("❌ PostgreSQL reconnect failed:", reconnectErr.message);
  }
});

//
// ✅ Redis client setup
//
export const redisClient = createRedisClient({
  url: process.env.REDIS_URL,
  socket: {
    family: 4, // Force IPv4 (avoids Render IPv6 timeouts)
    reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
  },
});

redisClient.on("connect", () => console.log("✅ Connected to Redis"));
redisClient.on("error", (err) => console.error("❌ Redis error:", err.message));

(async () => {
  try {
    await redisClient.connect();
    console.log("🚀 Redis connection established successfully!");
  } catch (err) {
    console.error("Redis connect failed:", err.message);
  }
})();

// ✅ Redis keep-alive every 10 minutes
setInterval(async () => {
  try {
    await redisClient.ping();
    console.log("🔁 Redis keep-alive ✅");
  } catch (err) {
    console.error("Redis ping failed ❌", err.message);
  }
}, 600000); // 10 min

export default { client, redisClient };
