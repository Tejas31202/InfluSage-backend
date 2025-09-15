import { client } from "../../config/db.js";
import redis from "redis";
import fs from "fs";
import path from "path";

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

// ---------------- CREATE / UPDATE Campaign Draft ----------------
export const createMyCampaign = async (req, res) => {
  const userId = req.user?.id || req.body.p_userid;
  const username = req.user.name

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const tryParseJSON = (value) => {
    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      return value;
    }
  };

  const p_objectivejson = tryParseJSON(req.body.p_objectivejson);
  const p_vendorinfojson = tryParseJSON(req.body.p_vendorinfojson);
  const p_campaignjson = tryParseJSON(req.body.p_campaignjson);
  const p_contenttypejson = tryParseJSON(req.body.p_contenttypejson);
  const p_campaigncategoyjson = tryParseJSON(req.body.p_campaigncategoyjson);

  // ---------------- File Handling ----------------
  let p_campaignfilejson = null;

  // Photo file (single)
  if (req.files?.photo && req.files.photo[0]) {
    const file = req.files.photo[0];
    const ext = path.extname(file.originalname);
    const finalName = `${username}_cp_${Date.now()}${ext}`;

    // Only relative path from src/
    const relativePath = path
      .join("src/uploads/vendor", finalName)
      .replace(/\\/g, "/");

    if (p_campaignjson) {
      p_campaignjson.photopath = relativePath;
    }

    // rename file from multer temp name → our format
    fs.renameSync(file.path, relativePath);
  }

  // ---------------- Multiple Campaign Files ----------------


  //changes before files

  // if (req.files?.Files && req.files.Files.length > 0) {
  //   p_campaignfilejson = req.files.Files.map((file) => {
  //     const ext = path.extname(file.originalname);
  //     const finalName = `${username}_campaign_${Date.now()}${ext}`;

  //     const relativePath = path
  //       .join("src/uploads/vendor", finalName)
  //       .replace(/\\/g, "/");

  //     fs.renameSync(file.path, relativePath);

  //     return { filepath: relativePath };
  //   });
  // }
  const redisKey = `getCampaign:${userId}`;

  try {
    let existingData = await redisClient.get(redisKey);
    existingData = existingData ? JSON.parse(existingData) : {};


    //Changes Below For Multiple Files In Edit Options 


    // Extract old files array or default to empty array
    const oldFiles = Array.isArray(existingData.p_campaignfilejson)
      ? existingData.p_campaignfilejson
      : [];

    let newFiles = [];

    if (req.files?.Files && req.files.Files.length > 0) {
      newFiles = req.files.Files.map((file) => {
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        const finalName = `${username}_campaign_${Date.now()}_${baseName}${ext}`;
        const relativePath = path.join("src/uploads/vendor", finalName).replace(/\\/g, "/");

        fs.renameSync(file.path, relativePath);

        return { filepath: relativePath };
      });
    }

    // Merge old and new files (if any new files exist)
    const p_campaignfilejson = newFiles.length > 0 ? [...oldFiles, ...newFiles] : oldFiles;

    //Changes Below For Multiple Files In Edit Options 

    const mergedData = {
      p_objectivejson: p_objectivejson || existingData.p_objectivejson || null,
      p_vendorinfojson:
        p_vendorinfojson || existingData.p_vendorinfojson || null,
      p_campaignjson: p_campaignjson || existingData.p_campaignjson || null,
      p_campaigncategoyjson: p_campaigncategoyjson || existingData.p_campaigncategoyjson || null,
      p_campaignfilejson:
        p_campaignfilejson || existingData.p_campaignfilejson || null,
      p_contenttypejson:
        p_contenttypejson || existingData.p_contenttypejson || null,
      is_completed: false,
    };

    await redisClient.set(redisKey, JSON.stringify(mergedData));
    // console.log("===>",mergedData)

    return res.status(200).json({
      status: true,
      message: "Draft stored in Redis successfully",
      campaignParts: mergedData,
      source: "redis",
    });
  } catch (err) {
    console.error("❌ createMyCampaign error:", err);
    return res.status(500).json({ status: false, message: err.message });
  }
};

// ---------------- FINALIZE Campaign ----------------
export const finalizeCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.p_userid;
    const campaignId = req.body.p_campaignid || null; // ya req.body.campaignid

    if (!userId)
      return res.status(400).json({ message: "User ID is required" });

    const redisKey = `getCampaign:${userId}`;
    const cachedData = await redisClient.get(redisKey);

    if (!cachedData) {
      return res
        .status(404)
        .json({ message: "No campaign data found in Redis to finalize" });
    }

    const campaignData = JSON.parse(cachedData);

    await client.query("BEGIN");
    const result = await client.query(
      `CALL ins.usp_upsert_campaigndetails(
          $1::BIGINT,
          $2::BIGINT,
          $3::JSON,
          $4::JSON,
          $5::JSON,
          $6::JSON,
          $7::JSON,
          $8::JSON,
          NULL,
          NULL
      )`,
      [
        userId,
        campaignId,
        JSON.stringify(campaignData.p_objectivejson || {}),
        JSON.stringify(campaignData.p_vendorinfojson || {}),
        JSON.stringify(campaignData.p_campaignjson || {}),
        JSON.stringify(campaignData.p_campaigncategoyjson || {}),
        JSON.stringify(campaignData.p_campaignfilejson || {}),
        JSON.stringify(campaignData.p_contenttypejson || {}),
      ]
    );
    await client.query("COMMIT");

    const { p_status, p_message } = result.rows[0] || {};
    if (p_status) {
      await redisClient.del(redisKey); // delete draft
      return res.status(200).json({
        status: p_status,
        message: p_message,
        // campaignId: p_campaignid
      });
    } else {
      return res.status(400).json({
        status: false,
        message: p_message || "Failed to finalize campaign",
      });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ finalizeCampaign error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

// ---------------- GET CAMPAIGN ----------------gi
export const getCampaign = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.p_userid;
    const campaignId = req.params.campaignId || "01"; // default draft

    if (!userId) return res.status(400).json({ message: "User ID required" });

    let redisKey;
    if (campaignId === "01") {
      // Draft mode → Redis key without campaignId
      redisKey = `getCampaign:${userId}`;
    } else {
      // Actual campaign → Redis key with campaignId
      redisKey = `getCampaign:${userId}:${campaignId}`;
    }

    console.log("👉 Redis Key:", redisKey);

    // Check Redis
    const cachedData = await redisClient.get(redisKey);
    if (cachedData) {
      return res.status(200).json({
        message:
          campaignId === "01"
            ? "Draft campaign data from Redis"
            : "Campaign data from Redis",
        campaignParts: JSON.parse(cachedData),
        source: "redis",
      });
    }

    // Draft not found → return empty
    if (campaignId === "01") {
      return res.status(200).json({
        message: "No draft found",
        campaignParts: {},
        source: "redis",
      });
    }

    // Fetch actual campaign from DB
    const result = await client.query(
      `SELECT * FROM ins.fn_get_campaigndetailsjson($1::BIGINT,$2::BIGINT)`,
      [userId, campaignId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Campaign not found" });
    }

    const fullData = result.rows[0];
    // Cache in Redis 120s
    await redisClient.setEx(redisKey, 120, JSON.stringify(fullData));

    return res.status(200).json({
      message: "Campaign data from DB",
      campaignParts: fullData,
      source: "db",
    });
  } catch (err) {
    console.error("❌ getCampaign error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

//..................GET INFLUENCER BROWSE DETAILS...........
export const getInfluencerBrowseDetails = async (req, res) => {

  try {

    const userId = req.user?.id || req.query.p_userid;

    if (!userId) {
      return res.status(400).json({ message: "User ID required" })
    };

    // const redisKey = `getinfluencerbrowsedetails:${userId}`;

    // console.log("Redis Key==>", redisKey);

    // const cachedData = await redisClient.get(redisKey);

    // console.log("CachedData==>", cachedData)
    // if (cachedData) {
    //   return res.status(200).json(
    //     {
    //       message: "Influencer Browse Details From Redis",
    //       result: JSON.parse(cachedData),
    //       source: 'redis',
    //     })
    // }

    //Data Given Form DB
    const result = await client.query(
      `SELECT * FROM ins.fn_get_influencerbrowsedetails($1::BIGINT)`,
      [userId]
    )

    const influencers = result.rows[0]?.fn_get_influencerbrowsedetails;

    //For Chek Data In Influencer
    // console.log("Influencer data==>",JSON.stringify(influencers))

    //Check For Influencer Data Available Or Not
    if (!influencers) {
      return res.status(404).json({ message: "No influencer data found" });
    }
    //Store Data In Redis
    // await redisClient.set(redisKey, JSON.stringify(influencers));

    // await redisClient.setEx(redisKey, 600, JSON.stringify(influencers)); // 10 min cache

    return res.status(200).json({
      message: "Influencers Browse Details Form DB",
      result: influencers,
      source: 'db'

    })

  } catch (error) {

    console.log("getInfluencerBrowseDetails error:", error)
    return res.status(500).json({ message: "Internal server Error" })

  }

}

//..................BROWSE ALL INFLUENCER...............
export const browseAllInfluencer = async (req, res) => {
  try {

    const userId = req.user?.id || req.query.p_userid || null;

    //Check For User Id Available OR Not
    // if (!userId) {
    //   return res.status(400).json({ message: "User ID is required." });
    // }


    const {
      p_location = null,
      p_providers = null,
      p_influencertiers = null,
      p_ratings = null,
      p_genders = null,
      p_languages = null,
      p_pagenumber = 1,
      p_pagesize = 20,
      p_search 

    } = req.query;



    const result = await client.query(
      `SELECT * FROM ins.fn_get_influencerbrowse(
    $1::BIGINT,
    $2::TEXT,
    $3::JSON,
    $4::JSON,
    $5::JSON,
    $6::JSON,
    $7::JSON,
    $8::INTEGER,
    $9::INTEGER,
    $10::TEXT
  )`,
      [
        userId,
        p_location,
        p_providers ? JSON.parse(p_providers) : null,
        p_influencertiers ? JSON.parse(p_influencertiers) : null,
        p_ratings ? JSON.parse(p_ratings) : null,
        p_genders ? JSON.parse(p_genders) : null,
        p_languages,
        p_pagenumber || 1,
        p_pagesize || 20,
        p_search
      ]
    );


    const influencers = result.rows;

    //Check For Data
    console.log("==>", influencers)
    if (influencers.length === 0) {
      return res.status(404).json({ message: 'No influencers found.' });
    }

    return res.status(200).json(
      {
        message: "Influencers Get Sucessfully",
        data: influencers,
        source: 'db'
      }
    )

  } catch (error) {
    console.log("Failed to Get Influencers sucessfully", error)
    return res.status(500).json({ message: "Internal Server Error" })

  }
}


export const deleteCampaignFile = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const filePathToDelete = req.body.filepath;

    if (!userId || !filePathToDelete) {
      return res
        .status(400)
        .json({ message: "userId and filepath are required" });
    }

    // Redis key (ab campaignId nahi hoga)
    const redisKey = `getCampaign:${userId}`;

    // 1 Redis se data fetch
    let campaignData = await redisClient.get(redisKey);
    if (campaignData) {
      campaignData = JSON.parse(campaignData);

      // Remove file from JSON
      if (campaignData.p_campaignfilejson) {
        campaignData.p_campaignfilejson = campaignData.p_campaignfilejson.filter(
          (file) => file.filepath !== filePathToDelete
        );

        // Update Redis
        await redisClient.set(redisKey, JSON.stringify(campaignData));
      }
    }

    // 2 Delete file from folder
    const fullPath = path.resolve(filePathToDelete);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    return res.status(200).json({
      status: true,
      message: "File deleted successfully",
      campaignFiles: campaignData?.p_campaignfilejson || [],
    });
  } catch (error) {
    console.error("❌ deleteCampaignFile error:", error);
    return res.status(500).json({ status: false, message: error.message });
  }
};

export const GetCampaignObjectives = async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * from ins.fn_get_campaignobjectives()"
    );

    return res.status(200).json({
      objectives: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching GetCampaignObjectives:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch GetCampaignObjectives" });
  }
};

// export const GetLanguages = async (req, res) => {
//   try {
//     const result = await client.query("SELECT * FROM ins.fn_get_languages();");

//     return res.status(200).json({
//       languages: result.rows,
//       source: "db",
//     });
//   } catch (error) {
//     console.error("Error fetching languages:", error);
//     return res.status(500).json({ message: "Failed to fetch languages" });
//   }
// };


export const GetInfluencerTiers = async (req, res) => {

  try {
    const result = await client.query(
      "SELECT * from ins.fn_get_influencertiers();"
    );

    return res.status(200).json({
      influencerType: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching GetCampaignObjectives:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch GetCampaignObjectives" });
  }
}

// export const GetGender=async(req,res)=>{

//   try {
//     const result = await client.query(
//       "SELECT * from ins.fn_get_genders();"
//     );

//     return res.status(200).json({
//       genders: result.rows,
//       source: "db",
//     });
//   } catch (error) {
//     console.error("Error fetching GetCampaignObjectives:", error);
//     return res
//       .status(500)
//       .json({ message: "Failed to fetch GetCampaignObjectives" });
//   }
// }


export const GetProvidorContentTypes = async (req, res) => {

  try {
    const result = await client.query(
      "SELECT * from ins.fn_get_providercontenttypes();"
    );

    return res.status(200).json({
      providorType: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching GetCampaignObjectives:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch GetCampaignObjectives" });
  }
}

//................Add Favourite Influencer................
export const addFavouriteInfluencer = async (req, res) => {
  const { userId, influencerId } = req.body;

  if (!userId || !influencerId) {
    return res.status(400).json({
      status: false,
      message: "Missing userId or influencerId",
    });
  };

  try {
    const result = await client.query(
      `CALL ins.usp_insert_influencersave(
        $1::bigint,
        $2::bigint,
        $3::boolean,
        $4::text
      )`,
      [userId, influencerId, null, null]
    );

    const { p_status, p_message } = result.rows[0];

    return res.status(200).json({
      status: p_status,
      message: p_message
    });
  } catch (error) {
    console.error("❌ Error adding favourite influencer:", error);
    return res.status(500).json({
      status: p_status,
      message: p_message
    });
  }
};

//...............Get Favourite Influencer.................
export const getFavouriteInfluencer = async (req, res) => {
  const { userId,
    p_pagenumber,
    p_pagesize,
    p_search
  } = req.query;

  if (!userId) return res.status(400).json("Userid Require");

  try {

    const result = await client.query(
      `SELECT * FROM ins.fn_get_influencerbrowsedetails($1::BIGINT,$2,$3,$4)`,
      [userId,
        p_pagenumber || 1,
        p_pagesize || 20,
        p_search
      ]
    )

    return res.json(result.rows);

  }

  catch (error) {

    console.log("Error While Favourite Influencer Get", error);
    return res.status(500).json({ error: "Internal Server Error" });

  }
}

export const inviteInfluencer = (req,res) =>{
  
}


// export const getProviders = async (req, res) => {

//   try {
//     // DB function call
//     const result = await client.query("SELECT * FROM ins.fn_get_providers()");

//     // console.log("providers", result.rows);
//     const providers = result.rows;

//     res.status(200).json({
//       status: true,
//       data: providers,
//     });
//   } catch (error) {
//     console.error("Error fetching providers:", error);
//     res.status(500).json({
//       status: false,
//       message: "Failed to fetch providers",
//       error: error.message,
//     })
//   };
// };