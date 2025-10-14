import session from "express-session";
import RedisStore from "connect-redis";
import redisClient from "../config/redis.js";
// import redis from "redis";
// const redisClient = redis.createClient({ url: process.env.REDIS_URL });
// redisClient.connect().catch(console.error);

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET, // ✅ use this one
  credentials: true,
  name: "sid",
  store: new RedisStore({ client: redisClient }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.ENVIRONMENT === "production" ? "true" : "auto",
    httpOnly: true,
    sameSite: process.env.ENVIRONMENT === "production" ? "none" : "lax",
  },
});

app.use(sessionMiddleware);