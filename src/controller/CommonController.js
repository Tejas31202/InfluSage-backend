import { client } from "../config/db.js";
import redis from "redis";

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

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
    console.error("Error fetching GetCampaignObjectives:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch GetCampaignObjectives" });
  }
};

export const GetGender = async (req, res) => {
  try {
    const result = await client.query("SELECT * from ins.fn_get_genders();");

    return res.status(200).json({
      genders: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching GetCampaignObjectives:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch GetCampaignObjectives" });
  }
};

export const GetLanguages = async (req, res) => {
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
        categories: JSON.parse(cachedData),
        source: "redis",
      });
    }

    const result = await client.query("select * from ins.fn_get_categories();");

    await redisClient.setEx(redisKey, 300, JSON.stringify(result.rows)); // TTL 5 mins

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

// export const getPagination = async (req, res) => {

 
//   try {

//     const desktop = await client.query(
//       `SELECT ins.fn_get_configvalue($1) AS desktop`,
//       ['PaginationPageSizeDesktop']
//     )

//     const mobile = await client.query(
//       `SELECT ins.fn_get_configvalue($1) AS mobile`,
//       ['PaginationPagesizeMobile']
//     )

//     const paginationData = {
//       desktop:desktop.rows[0].desktop,
//       mobile:mobile.rows[0].mobile
//     }
//     res.json(paginationData)

//   } catch (error) {
//     console.error('DB Error:', error);
//     res.status(500).json({ error: 'Internal server error' })
//   }

// }


