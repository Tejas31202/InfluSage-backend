const { Client } = require("pg");
const {client} = require("../config/db")
// const authenticateUser = require("../middleware/AuthMiddleware");
const redis = require('redis');
const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);



const calculateProfileCompletion = (profileParts) => {
  const totalSections = profileParts.length;

  const filledSections = profileParts.filter(part => {
    return part && typeof part === 'object' && Object.keys(part).length > 0;
  }).length;

  return Math.round((filledSections / totalSections) * 100);
};


// Complete User Profile
exports.completeUserProfile = async (req, res) => {
   const userId = req.user?.id || req.body.userid;
  const {
    profilejson,
    socialaccountjson,
    categoriesjson,
    portfoliojson,
    paymentjson
  } = req.body;

  try {
    // 🔍 Debug logs for incoming data
    console.log("===== 📩 Incoming Complete User Profile Data =====");
    console.log("👤 userId:", userId);
    console.log("📌 profilejson:", JSON.stringify(profilejson, null, 2));
    console.log("🔗 socialaccountjson:", JSON.stringify(socialaccountjson, null, 2));
    console.log("📂 categoriesjson:", JSON.stringify(categoriesjson, null, 2));
    console.log("🖼 portfoliojson:", JSON.stringify(portfoliojson, null, 2));
    console.log("💳 paymentjson:", JSON.stringify(paymentjson, null, 2));
    console.log("===================================================");

    // Extra breakdown for categories
    if (categoriesjson && categoriesjson.length) {
      categoriesjson.forEach((parent, i) => {
        console.log(`➡ Parent ${i + 1}: parentcategoryid =`, parent.parentcategoryid);
        if (parent.categories && parent.categories.length) {
          parent.categories.forEach((child, j) => {
            console.log(`   └─ Child ${j + 1}: categoryid =`, child.categoryid);
          });
        } else {
          console.log(`   ⚠ No child categories found for parent ${i + 1}`);
        }
      });
    }

    const redisPrefix = `profile:${userId}`;

    // Save in Redis
    await redisClient.setEx(`${redisPrefix}:profilejson`, 120, JSON.stringify(profilejson));
    await redisClient.setEx(`${redisPrefix}:socialaccountjson`, 120, JSON.stringify(socialaccountjson));
    await redisClient.setEx(`${redisPrefix}:categoriesjson`, 120, JSON.stringify(categoriesjson));
    await redisClient.setEx(`${redisPrefix}:portfoliojson`, 120, JSON.stringify(portfoliojson));
    await redisClient.setEx(`${redisPrefix}:paymentjson`, 120, JSON.stringify(paymentjson));

    // DB call
    await client.query('BEGIN');
    const result = await client.query(
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

    // Debug stored procedure output
    console.log("📤 SP Output:", result.rows);

    const { p_status, p_message } = result.rows[0];
    if (p_status) {
      return res.status(200).json({ message: p_message });
    } else {
      return res.status(400).json({ message: p_message });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("❌ Complete user profile error:", error);
    return res.status(500).json({ message: error.message });
  }
};


// Get User Profile
exports.getUserProfile = async (req, res) => {
  // ... your existing getUserProfile logic ...
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


    const profileParts = [
         profilejson ? JSON.parse(profilejson) : {},
  socialaccountjson ? JSON.parse(socialaccountjson) : {},
  categoriesjson ? JSON.parse(categoriesjson) : {},
  portfoliojson ? JSON.parse(portfoliojson) : {},
  paymentjson ? JSON.parse(paymentjson) : {},
];


const profileCompletion = calculateProfileCompletion(profileParts);

console.log("Profile Completion %:", profileCompletion);
    // ✅ Step 2: If all data found in Redis, return it
    if (profilejson && socialaccountjson && categoriesjson && portfoliojson && paymentjson) {
      return res.status(200).json({
        p_profile: JSON.parse(profilejson),
        p_socials: JSON.parse(socialaccountjson),
        p_categories: JSON.parse(categoriesjson),
        p_portfolios: JSON.parse(portfoliojson),
        p_paymentaccounts: JSON.parse(paymentjson),
        profileCompletion,
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

// Get User Name by Email
exports.getUserNameByEmail = async (req, res) => {
  // ... your existing getUserNameByEmail logic ...
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


// exports.getUserProfile = getUserProfile;

