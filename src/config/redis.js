import { Redis } from "@upstash/redis";
import dotenv from "dotenv";
dotenv.config();

export const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Test connection
(async () => {
  try {
    const pong = await redisClient.ping();
    console.log("✅ Upstash Redis Connected:", pong);
  } catch (err) {
    console.error("❌ Upstash Redis Error:", err.message);
  }
})();
      