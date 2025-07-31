const { Client } = require("pg");
const client = require("../config/db")
const authenticateUser = require("../middleware/AuthMiddleware");
const redis = require('redis');
const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);





exports.completeUserProfile = async (req, res) => {
  const userId = req.user.id;
  const {
    profilejson,
    socialaccountjson,
    categoriesjson,
    portfoliojson,
    paymentjson
  } = req.body;

  console.log("User ID:", userId);
  console.log("Profile JSON:", profilejson);
  console.log("Social Accounts:", socialaccountjson);
  console.log("Categories:", categoriesjson);
  console.log("Portfolios:", portfoliojson);
  console.log("Payment:", paymentjson);

  try {
    // ✅ Save each field in Redis with individual keys (TTL: 2 mins)
    const redisPrefix = `profile:${userId}`;

    await redisClient.setEx(`${redisPrefix}:profilejson`, 120, JSON.stringify(profilejson));
    await redisClient.setEx(`${redisPrefix}:socialaccountjson`, 120, JSON.stringify(socialaccountjson));
    await redisClient.setEx(`${redisPrefix}:categoriesjson`, 120, JSON.stringify(categoriesjson));
    await redisClient.setEx(`${redisPrefix}:portfoliojson`, 120, JSON.stringify(portfoliojson));
    await redisClient.setEx(`${redisPrefix}:paymentjson`, 120, JSON.stringify(paymentjson));

    // ✅ Save to DB using stored procedure
    await client.query('BEGIN');

    await client.query(
      `CALL ins.sp_complete_userprofile(
        $1::bigint,
        $2::json,
        $3::json,
        $4::json,
        $5::json,
        $6::json,
        $7::boolean,
        $8::text
      )`,
      [
        userId,
        JSON.stringify(profilejson),
        JSON.stringify(socialaccountjson),
        JSON.stringify(categoriesjson),
        JSON.stringify(portfoliojson),
        JSON.stringify(paymentjson),
        null,
        null
      ]
    );

    await client.query('COMMIT');

    // ✅ Clear Redis cache after success
    // await redisClient.del(`${redisPrefix}:profilejson`);
    // await redisClient.del(`${redisPrefix}:socialaccountjson`);
    // await redisClient.del(`${redisPrefix}:categoriesjson`);
    // await redisClient.del(`${redisPrefix}:portfoliojson`);
    // await redisClient.del(`${redisPrefix}:paymentjson`);

    // return res.status(200).json({ message: "User profile completed successfully." });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("complete user profile error:", error);

    // ❗ Redis data retained for possible retry
    return res.status(500).json({ message: "Failed to complete user profile." });
  }
};



exports.getUserProfile = async (req, res) => {
  const userId = req.params.userId;
  const redisPrefix = `profile:${userId}`;

  try {
    // ✅ Step 1: Try to fetch data from Redis
    const [
      profilejson,
      socialaccountjson,
      categoriesjson,
      portfoliojson,
      paymentjson
    ] = await Promise.all([
      redisClient.get(`${redisPrefix}:profilejson`),
      redisClient.get(`${redisPrefix}:socialaccountjson`),
      redisClient.get(`${redisPrefix}:categoriesjson`),
      redisClient.get(`${redisPrefix}:portfoliojson`),
      redisClient.get(`${redisPrefix}:paymentjson`)
    ]);

    // ✅ Step 2: If all data found in Redis, return it
    if (profilejson && socialaccountjson && categoriesjson && portfoliojson && paymentjson) {
      return res.status(200).json({
        p_profile: JSON.parse(profilejson),
        p_socials: JSON.parse(socialaccountjson),
        p_categories: JSON.parse(categoriesjson),
        p_portfolios: JSON.parse(portfoliojson),
        p_paymentaccounts: JSON.parse(paymentjson),
        source: 'redis'
      });
    }

    // ✅ Step 3: If not in Redis, fetch from DB
    const result = await client.query(
      `SELECT * FROM ins.fn_get_userprofilejson($1::BIGINT)`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const {
      p_profile,
      p_socials,
      p_categories,
      p_portfolios,
      p_paymentaccounts
    } = result.rows[0];

    // ✅ Step 4: Store individual parts in Redis for next time (TTL: 2 mins)
    await Promise.all([
      redisClient.setEx(`${redisPrefix}:profilejson`, 120, JSON.stringify(p_profile)),
      redisClient.setEx(`${redisPrefix}:socialaccountjson`, 120, JSON.stringify(p_socials)),
      redisClient.setEx(`${redisPrefix}:categoriesjson`, 120, JSON.stringify(p_categories)),
      redisClient.setEx(`${redisPrefix}:portfoliojson`, 120, JSON.stringify(p_portfolios)),
      redisClient.setEx(`${redisPrefix}:paymentjson`, 120, JSON.stringify(p_paymentaccounts))
    ]);

    // ✅ Step 5: Return data from DB
    res.json({
      p_profile,
      p_socials,
      p_categories,
      p_portfolios,
      p_paymentaccounts,
      source: 'db'
    });

  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Get firstname and lastname by email
exports.getUserNameByEmail = async (req, res) => {
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

