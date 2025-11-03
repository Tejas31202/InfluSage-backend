import dotenv from "dotenv";
import pkg from "pg";
import { createClient as createRedisClient } from "redis";

dotenv.config();

const { Client } = pkg;

let client;

// ✅ Helper to create new PostgreSQL client
const createPgClient = () =>
  new Client({
    connectionString:
      process.env.USE_POOLER === "true"
        ? process.env.DATABASE_URL_POOLED
        : process.env.DATABASE_URL_DIRECT || process.env.SUPABASE_DB_URL,
    ssl: {
      require: true,
      rejectUnauthorized: false, // Required for Render & Supabase
    },
  });

// ✅ Connect function (with safe retry & re-init)
const connectPostgres = async (retryCount = 0) => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 5000; // ms

  try {
    if (client) {
      await client.end().catch(() => {});
    }

    client = createPgClient();
    await client.connect();

    console.log(
      `✅ Connected to PostgreSQL (${process.env.USE_POOLER === "true" ? "Pooler" : "Direct"})`
    );

    // Handle unexpected errors
    client.on("error", (err) => {
      console.error("⚠️ PostgreSQL client error:", err.message);
      console.log("♻️ Reconnecting PostgreSQL...");
      setTimeout(() => connectPostgres(), RETRY_DELAY);
    });
  } catch (err) {
    console.error("❌ PostgreSQL connection error:", err.message);

    // Fallback: try direct connection if pooler fails
    if (process.env.USE_POOLER === "true") {
      console.log("🔁 Switching to direct connection...");
      process.env.USE_POOLER = "false";
      setTimeout(() => connectPostgres(), RETRY_DELAY);
      return;
    }

    // Retry if still failing
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Retrying PostgreSQL connection (${retryCount + 1}/${MAX_RETRIES})...`);
      setTimeout(() => connectPostgres(retryCount + 1), RETRY_DELAY);
    } else {
      console.error("❌ Max retries reached. Could not connect to PostgreSQL.");
    }
  }
};

// ✅ Initial connect
connectPostgres();

//
// ✅ Redis setup
//
export const redisClient = createRedisClient({
  url: process.env.REDIS_URL,
  socket: {
    family: 4,
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

// ✅ Keep Redis alive
setInterval(async () => {
  try {
    await redisClient.ping();
    console.log("🔁 Redis keep-alive ✅");
  } catch (err) {
    console.error("Redis ping failed ❌", err.message);
  }
}, 600000); // 10 min

export { client };
export default { client, redisClient };


// import dotenv from "dotenv";
// import pkg from "pg";
// import { createClient as createRedisClient } from "redis";

// dotenv.config();

// const { Client } = pkg;

// // ✅ PostgreSQL client setup
// export const client = new Client({
//   connectionString: process.env.SUPABASE_DB_URL,
//   ssl: {
//     require: true,
//     rejectUnauthorized: false, // Required for Render & Supabase
//   },
// });

// // ✅ Connect once (no repeated reconnect loops)
// const connectPostgres = async () => {
//   try {
//     await client.connect();
//     console.log("✅ Connected to PostgreSQL");
//   } catch (err) {
//     console.error("❌ PostgreSQL connection error:", err.message);
//     // Retry only if failed to connect initially
//     setTimeout(connectPostgres, 5000);
//   }
// };

// connectPostgres();

// // ✅ Handle PostgreSQL disconnections gracefully
// client.on("error", async (err) => {
//   console.error("⚠️ PostgreSQL client error:", err.message);
//   console.log("♻️ Attempting PostgreSQL reconnect...");
//   try {
//     await client.end().catch(() => {}); // safely close old client
//     await client.connect();
//     console.log("✅ PostgreSQL reconnected successfully");
//   } catch (reconnectErr) {
//     console.error("❌ PostgreSQL reconnect failed:", reconnectErr.message);
//   }
// });

// //
// // ✅ Redis client setup
// //
// export const redisClient = createRedisClient({
//   url: process.env.REDIS_URL,
//   socket: {
//     family: 4, // Force IPv4 (avoids Render IPv6 timeouts)
//     reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
//   },
// });

// redisClient.on("connect", () => console.log("✅ Connected to Redis"));
// redisClient.on("error", (err) => console.error("❌ Redis error:", err.message));

// (async () => {
//   try {
//     await redisClient.connect();
//     console.log("🚀 Redis connection established successfully!");
//   } catch (err) {
//     console.error("Redis connect failed:", err.message);
//   }
// })();

// // ✅ Redis keep-alive every 10 minutes
// setInterval(async () => {
//   try {
//     await redisClient.ping();
//     console.log("🔁 Redis keep-alive ✅");
//   } catch (err) {
//     console.error("Redis ping failed ❌", err.message);
//   }
// }, 600000); // 10 min

// export default { client, redisClient };
