import fs from "fs";
import path from "path";
import {redisClient } from "../config/db.js";
// import redis from "redis";

/**
 * Delete file from Redis JSON and disk
 * @param {string} redisKey - Redis key
 * @param {string} jsonField - Field name in JSON (example: "portfoliojson" or "p_campaignfilejson")
 * @param {string} filePathToDelete - Filepath to delete
 * @param {string} folder - subfolder inside uploads ("influencer" | "vendor")
 * @returns {Promise<object>} Updated JSON after deletion
 */
export const deleteFileFromRedis = async (redisKey, jsonField, filePathToDelete, folder = "vendor") => {
  // 1. Redis fetch
  let data = await redisClient.get(redisKey);
  if (!data) return null;

  data = JSON.parse(data);

  // 2. Remove file from JSON array
  if (Array.isArray(data[jsonField])) {
    data[jsonField] = data[jsonField].filter(
      (file) => file.filepath !== filePathToDelete
    );

    // 3. Update Redis
    await redisClient.set(redisKey, JSON.stringify(data));
  }

  // 4. Delete from disk
  const uploadBase = path.join(process.cwd(), "src/uploads", folder);
  const fullPath = path.join(uploadBase, path.basename(filePathToDelete));

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    console.log("🗑 Deleted file:", fullPath);
  } else {
    console.warn("⚠️ File not found on disk:", fullPath);
  }

  return data;
};
