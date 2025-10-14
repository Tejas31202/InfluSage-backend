// sessionMiddleware.js
import session from 'express-session';
import { RedisStore } from 'connect-redis';  // ✅ named import
import redisClient from '../config/redis.js';

export const sessionMiddleware = session({
  name: "influSession",
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || "defaultsecret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.ENVIRONMENT === "production" ? true : false,
    sameSite: process.env.ENVIRONMENT === "production" ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24, // optional: 1 day
  },
});
