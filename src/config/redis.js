import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    family: 4, // Force IPv4 to avoid timeout on Render
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

// ✅ Keep-alive ping
setInterval(async () => {
  try {
    await redisClient.ping();
    console.log("🔁 Redis keep-alive ✅");
  } catch (err) {
    console.error("Redis ping failed ❌", err.message);
  }
}, 600000);

export default redisClient;
