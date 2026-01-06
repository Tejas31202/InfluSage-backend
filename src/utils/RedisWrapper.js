import { createClient } from "redis";
import { Redis as UpstashRedis } from "@upstash/redis";
import dotenv from "dotenv";
dotenv.config();

const isUpstash = process.env.REDIS_PROVIDER === "Upstash";

let redis;

if (isUpstash) {
  redis = new UpstashRedis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} else {
  redis = createClient({
    socket: {
      host: process.env.REDIS_HOST, // 🔥 IMPORTANT
      port: Number(process.env.REDIS_PORT),
    },
  });

  redis.on("error", (err) => {
    console.error("Redis Client Error", err);
  });

  await redis.connect();
}

export default {
  async set(key, value) {
    if (isUpstash) {
      return await redis.set(key, value);   // Upstash auto-handles JSON
    } else {
      return await redis.set(key, JSON.stringify(value)); // Local redis needs stringify
    }
  },

  async setEx(key, ttl, value) {
    if (isUpstash) {
      // Upstash REST API TTL in seconds
      return await redis.set(key, value, { ex: ttl });
    } else {
      // node-redis: setEx(key, ttl, value)
      return await redis.setEx(key, ttl, JSON.stringify(value));
    }
  },

  async get(key) {
    const data = await redis.get(key);
    if (!data) return null;

    try {
      // Upstash already object, local Redis stringified
      if (typeof data === "string") {
        return JSON.parse(data);
      }
      return data; // Upstash object
    } catch (err) {
      return data;
    }
  },

  async del(key) {
    return await redis.del(key);
  },
};