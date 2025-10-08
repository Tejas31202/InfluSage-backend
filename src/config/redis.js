import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const redis = createClient({
  url: process.env.REDIS_URL, // rediss://...
   socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 5000),
    connectTimeout: 10000 // 10 sec
  }
});

await redis.connect();

