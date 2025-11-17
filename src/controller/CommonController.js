import { client } from '../config/Db.js';
import { redisClient } from "../config/redis.js";


export const getRoles = async (req, res) => {
  try {
    const result = await client.query(`SELECT * from ins.fn_get_roles();`);

    // rows array aayega roles ka
    return res.status(200).json({
      status: true,
      message: "Roles fetched successfully",
      roles: result.rows,
    });
  } catch (error) {
    console.error("❌ Error fetching roles:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

export const getContentTypes = async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * from ins.fn_get_contenttypes();"
    );

    return res.status(200).json({
      contentType: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching getContentTypes:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch getContentTypes" });
  }
};

export const getGenders = async (req, res) => {
  try {
    const result = await client.query("SELECT * from ins.fn_get_genders();");

    return res.status(200).json({
      genders: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching Genders:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch Genders" });
  }
};

export const getLanguages = async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM ins.fn_get_languages();");

    return res.status(200).json({
      languages: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching languages:", error);
    return res.status(500).json({ message: "Failed to fetch languages" });
  }
};

export const getCategories = async (req, res) => {
  const redisKey = "categories";

  try {
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      return res.status(200).json({
        categories: cachedData,   // <-- Direct Object
        source: "redis",
      });
    }

    const result = await client.query("select * from ins.fn_get_categories();");

    // 
    // ✔ Upstash automatically JSON store
    await redisClient.set(redisKey, result.rows, { ex: 300 });

    return res.status(200).json({
      categories: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({ message: "Failed to fetch categories" });
  }
};


export const getProviders = async (req, res) => {
  try {
    // DB function call
    const result = await client.query("SELECT * FROM ins.fn_get_providers()");

    // console.log("providers", result.rows);
    const providers = result.rows;

    res.status(200).json({
      status: true,
      data: providers,
    });
  } catch (error) {
    console.error("Error fetching providers:", error);
    res.status(500).json({
      status: false,
      message: "Failed to fetch providers",
      error: error.message,
    });
  }
};

export const getInfluencerTiers = async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * from ins.fn_get_influencertiers();"
    );

    return res.status(200).json({
      influencerType: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching getInfluencerTiers:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch getInfluencerTiers" });
  }
};
