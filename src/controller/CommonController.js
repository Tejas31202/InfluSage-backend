import { client } from '../config/Db.js';
import Redis from '../utils/RedisWrapper.js';
import { HTTP, SP_STATUS } from '../utils/Constants.js';

export const getRoles = async (req, res) => {
  try {
    const result = await client.query(`SELECT * from ins.fn_get_roles();`);

    return res.status(HTTP.OK).json({
      status: true,
      message: "Roles fetched successfully",
      roles: result.rows,
    });
  } catch (error) {
    console.error(" Error fetching roles:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
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

    return res.status(HTTP.OK).json({
      contentType: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching getContentTypes:", error);
    return res
      .status(HTTP.INTERNAL_ERROR)
      .json({ message: "Failed to fetch getContentTypes" });
  }
};

export const getGenders = async (req, res) => {
  try {
    const result = await client.query("SELECT * from ins.fn_get_genders();");

    return res.status(HTTP.OK).json({
      genders: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching Genders:", error);
    return res
      .status(HTTP.INTERNAL_ERROR)
      .json({ message: "Failed to fetch Genders" });
  }
};

export const getLanguages = async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM ins.fn_get_languages();");

    return res.status(HTTP.OK).json({
      languages: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching languages:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getCategories = async (req, res) => {
  const redisKey = "categories";

  try {
    const cachedData = await Redis.get(redisKey);

    if (cachedData) {
      return res.status(HTTP.OK).json({
        // categories: JSON.parse(cachedData),
        categories:cachedData,
        source: "redis",
      });
    }

    const result = await client.query("select * from ins.fn_get_categories();");

    await Redis.setEx(redisKey, 700, result.rows); // TTL 2h

    return res.status(HTTP.OK).json({
      categories: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};


export const getProviders = async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM ins.fn_get_providers()");

    const providers = result.rows;

    res.status(HTTP.OK).json({
      status: true,
      data: providers,
    });
  } catch (error) {
    console.error("Error fetching providers:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getInfluencerTiers = async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * from ins.fn_get_influencertiers();"
    );

    return res.status(HTTP.OK).json({
      influencerType: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching getInfluencerTiers:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getUserNameAndPhoto = async (req, res) => {
  try {
    const p_userid  = req.user?.id || req.query.p_userid ;

    if (!p_userid ) {
      return res.status(HTTP.BAD_REQUEST).json({
        message: "p_userid is required.",
      });
    }
    const result = await client.query(
      "SELECT * FROM ins.fn_get_userinfo($1::bigint);",
      [p_userid ]
    );

    const userData = result.rows[0].fn_get_userinfo[0];

    return res.status(HTTP.OK).json({
      userData: userData,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching getUserNameAndPhoto:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getCountries = async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM ins.fn_get_countries();");
    return res.status(HTTP.OK).json({
      countries: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching countries:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getStatesByCountry = async (req, res) => {
  try {
    const { countryId } = req.params;

    if (!countryId) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "countryId is required" });
    }
    const result = await client.query(
      "SELECT * FROM ins.fn_get_statesbycountry($1::bigint);",
      [countryId]
    );
    return res.status(HTTP.OK).json({
      states: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching states by country:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}

export const getCityiesByState = async (req, res) => {
  try {
    const { stateId } = req.params;
    if (!stateId) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "stateId is required" });
    }
    const result = await client.query(
      "SELECT * FROM ins.fn_get_citiesbystate($1::bigint);",
      [stateId] 
    );
    return res.status(HTTP.OK).json({
      cities: result.rows,
      source: "db",
    });
  }
  catch (error) {
    console.error("Error fetching cities by state:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}

export const getTermsAndConditions = async (req, res) => {
  try {
    const result = await client.query(
      `SELECT * FROM ins.fn_get_configvalue($1::varchar);`,
      ["termsAndConditions"]
    );
    const data = result.rows[0]?.fn_get_configvalue;
    return res.status(HTTP.OK).json({
      message: "Terms and conditions retrieved successfully",
      data: data,
    });
  } catch (error) {
    console.error("Error in getTermsAndConditions:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getStats = async (req, res) => {
  const campaigns = await client.query("SELECT COUNT(*) FROM ins.campaigns");
  const users = await client.query("SELECT COUNT(*) FROM ins.users");

  return res.json({
    status: true,
    data: {
      totalCampaigns: campaigns.rows[0].count,
      totalUsers: users.rows[0].count
    }
  });
};

export const getSenderEmail = async () => {
  const result = await client.query(
    `SELECT * FROM ins.fn_get_configvalue($1::varchar);`,
    ["senderEmail"]
  );

  return result.rows[0]?.fn_get_configvalue;
};
