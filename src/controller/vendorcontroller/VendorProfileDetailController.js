import { Client } from 'pg';
import { client } from "../../config/db.js";
import authenticateUser from "../../middleware/AuthMiddleware.js";
import redis from 'redis';

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

function calculateProfileCompletionSingle(part) {
  if (!part || typeof part !== "object") return 0;
  const values = Object.values(part);
  const total = values.length;
  const filled = values.filter(v => v !== null && v !== "" && v !== undefined).length;
  if (total === 0) return 0;
  return Math.round((filled / total) * 100);
}

function calculateProfileCompletion(partsArray) {
  const totalFields = partsArray.reduce((sum, part) => {
    const values = Object.values(part || {});
    return sum + values.length;
  }, 0);

  const filledFields = partsArray.reduce((sum, part) => {
    const values = Object.values(part || {});
    const filled = values.filter(v => v !== null && v !== "" && v !== undefined).length;
    return sum + filled;
  }, 0);

  if (totalFields === 0) return 0;

  return Math.round((filledFields / totalFields) * 100);
}

export const getVendorCategories = async (req, res) => {
  const redisKey = 'vendor_categories';

  try {
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      return res.status(200).json({
        categories: JSON.parse(cachedData),
        source: 'redis'
      });
    }

    const result = await client.query('select * from ins.fn_get_categories();');

    await redisClient.setEx(redisKey, 300, JSON.stringify(result.rows)); // TTL 5 mins

    return res.status(200).json({
      categories: result.rows,
      source: 'db'
    });
  } catch (error) {
    console.error("Error fetching vendor categories:", error);
    return res.status(500).json({ message: 'Failed to fetch vendor categories' });
  }
};

export const getCompanySizes = async (req, res) => {
  const redisKey = 'company_sizes';

  try {
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      return res.status(200).json({
        companySizes: JSON.parse(cachedData),
        source: 'redis'
      });
    }

    const result = await client.query('SELECT * FROM ins.fn_get_companysize()');

    await redisClient.setEx(redisKey, 300, JSON.stringify(result.rows)); // TTL 5 mins

    return res.status(200).json({
      companySizes: result.rows,
      source: 'db'
    });
  } catch (error) {
    console.error("Error fetching company sizes:", error);
    return res.status(500).json({ message: 'Failed to fetch company sizes' });
  }
};

export const getInfluencerTiers = async (req, res) => {
  const redisKey = 'influencer_tiers';

  try {
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      return res.status(200).json({
        influencerTiers: JSON.parse(cachedData),
        source: 'redis'
      });
    }

    const result = await client.query('SELECT * FROM ins.fn_get_influencertiers()');

    await redisClient.setEx(redisKey, 300, JSON.stringify(result.rows)); // TTL 5 mins

    return res.status(200).json({
      influencerTiers: result.rows,
      source: 'db'
    });
  } catch (error) {
    console.error("Error fetching influencer tiers:", error);
    return res.status(500).json({ message: 'Failed to fetch influencer tiers' });
  }
};

export const getUserNameByEmail = async (req, res) => {
  const { email } = req.params; // or use req.body.email if POST

  try {
    const result = await client.query(
      `SELECT * FROM ins.fn_get_username($1::varchar)`,
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      firstname: user.firstname,
      lastname: user.lastname
    });
  } catch (error) {
    console.error('Error fetching user name:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getVendorProfile = async (req, res) => {
  const vendorId = req.params.userId;
  const redisPrefix = `vendor:${vendorId}`;

  try {
    const [
      profilejson,
      categoriesjson,
      providersjson,
      objectivesjson,
      paymentjson
    ] = await Promise.all([
      redisClient.get(`${redisPrefix}:profilejson`),
      redisClient.get(`${redisPrefix}:categoriesjson`),
      redisClient.get(`${redisPrefix}:providersjson`),
      redisClient.get(`${redisPrefix}:objectivesjson`),
      redisClient.get(`${redisPrefix}:paymentjson`)
    ]);

    const parsedParts = {
      profile: profilejson ? JSON.parse(profilejson) : {},
      categories: categoriesjson ? JSON.parse(categoriesjson) : {},
      providers: providersjson ? JSON.parse(providersjson) : {},
      objectives: objectivesjson ? JSON.parse(objectivesjson) : {},
      payment: paymentjson ? JSON.parse(paymentjson) : {}
    };

    const profileCompletion = calculateProfileCompletion(Object.values(parsedParts));

    const completionBreakdown = {
      profile: calculateProfileCompletionSingle(parsedParts.profile),
      categories: calculateProfileCompletionSingle(parsedParts.categories),
      providers: calculateProfileCompletionSingle(parsedParts.providers),
      objectives: calculateProfileCompletionSingle(parsedParts.objectives),
      payment: calculateProfileCompletionSingle(parsedParts.payment)
    };

    if (profilejson && categoriesjson && providersjson && objectivesjson && paymentjson) {
      return res.status(200).json({
        p_profile: parsedParts.profile,
        p_categories: parsedParts.categories,
        p_providers: parsedParts.providers,
        p_objectives: parsedParts.objectives,
        p_paymentaccount: parsedParts.payment,
        profileCompletion,
        completionBreakdown,
        source: 'redis'
      });
    }

    // DB se data agar Redis cache nahi mila
    const result = await client.query(
      `SELECT * FROM ins.fn_get_vendorprofilejson($1::BIGINT)`,
      [vendorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Vendor not found.' });
    }

    const {
      p_profile,
      p_categories,
      p_providers,
      p_objectives,
      p_paymentaccount
    } = result.rows[0];
    console.log({ p_profile, p_categories, p_providers, p_objectives, p_paymentaccount });

    await Promise.all([
      redisClient.setEx(`${redisPrefix}:profilejson`, 120, JSON.stringify(p_profile || {})),
      redisClient.setEx(`${redisPrefix}:categoriesjson`, 120, JSON.stringify(p_categories || [])),
      redisClient.setEx(`${redisPrefix}:providersjson`, 120, JSON.stringify(p_providers || [])),
      redisClient.setEx(`${redisPrefix}:objectivesjson`, 120, JSON.stringify(p_objectives || [])),
      redisClient.setEx(`${redisPrefix}:paymentjson`, 120, JSON.stringify(p_paymentaccount || {}))
    ]);
    
    const dbParsedParts = {
      profile: p_profile || {},
      categories: p_categories || {},
      providers: p_providers || {},
      objectives: p_objectives || {},
      payment: p_paymentaccount || {}
    };

    const profileCompletionFromDb = calculateProfileCompletion(Object.values(dbParsedParts));

    const completionBreakdownDb = {
      profile: calculateProfileCompletionSingle(dbParsedParts.profile),
      categories: calculateProfileCompletionSingle(dbParsedParts.categories),
      providers: calculateProfileCompletionSingle(dbParsedParts.providers),
      objectives: calculateProfileCompletionSingle(dbParsedParts.objectives),
      payment: calculateProfileCompletionSingle(dbParsedParts.payment)
    };

    return res.status(200).json({
      p_profile,
      p_categories,
      p_providers,
      p_objectives,
      p_paymentaccount,
      profileCompletion: profileCompletionFromDb,
      completionBreakdown: completionBreakdownDb,
      source: 'db'
    });

  } catch (err) {
    console.error('Error fetching vendor profile:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const completeVendorProfile = async (req, res) => {
  const userId = req.user?.id || req.body.userid;
  const {
    profilejson,
    categoriesjson,
    providersjson,
    objectivesjson,
    paymentjson
  } = req.body;

  console.log("Vendor ID:", userId);
  console.log("Profile JSON:", profilejson);
  console.log("Categories:", categoriesjson);
  console.log("Providers:", providersjson);
  console.log("Objectives:", objectivesjson);
  console.log("Payment:", paymentjson);

  try {
    const redisPrefix = `vendorprofile:${userId}`;

    await redisClient.setEx(`${redisPrefix}:profilejson`, 120, JSON.stringify(profilejson));
    await redisClient.setEx(`${redisPrefix}:categoriesjson`, 120, JSON.stringify(categoriesjson));
    await redisClient.setEx(`${redisPrefix}:providersjson`, 120, JSON.stringify(providersjson));
    await redisClient.setEx(`${redisPrefix}:objectivesjson`, 120, JSON.stringify(objectivesjson));
    await redisClient.setEx(`${redisPrefix}:paymentjson`, 120, JSON.stringify(paymentjson));

    await client.query('BEGIN');
    const result = await client.query(
      `CALL ins.sp_complete_vendorprofile(
        $1::BIGINT, $2::JSON, $3::JSON, $4::JSON, $5::JSON, $6::JSON, $7::BOOLEAN, $8::TEXT)`,
      [
        userId,
        JSON.stringify(profilejson),
        JSON.stringify(categoriesjson),
        JSON.stringify(providersjson),
        JSON.stringify(objectivesjson),
        JSON.stringify(paymentjson),
        null, // Assuming these are optional
        null // Assuming these are optional
      ]
    );

    await client.query('COMMIT');

    const { p_status, p_message } = result.rows[0];
    if (p_status) {
      return res.status(200).json({ message: p_message });
    } else {
      return res.status(400).json({ message: p_message });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("complete vendor profile error:", error);

    return res.status(500).json({ message: error.message });
  }
};

export const getObjectives = async (req, res) => {
  const redisKey = 'vendor_objectives';

  try {
    const cachedData = await redisClient.get(redisKey);

    if (cachedData) {
      return res.status(200).json({
        objectives: JSON.parse(cachedData),
        source: 'redis'
      });
    }

    const result = await client.query('SELECT * FROM ins.fn_get_objectives();');

    await redisClient.setEx(redisKey, 300, JSON.stringify(result.rows)); // TTL: 5 mins

    return res.status(200).json({
      objectives: result.rows,
      source: 'db'
    });

  } catch (error) {
    console.error("Error fetching objectives:", error);
    return res.status(500).json({ message: 'Failed to fetch objectives' });
  }
};
