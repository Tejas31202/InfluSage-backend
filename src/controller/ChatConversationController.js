import { client } from '../config/Db.js';
// import authenticateUser from '../middleware/AuthMiddleware.js';


export const resolveUsername = async (req, res, next) => {
  const userId = req.user?.id || req.body?.userId;
  let username = "user";

  try {
    // Prefer JWT payload
    if (req.user?.firstName || req.user?.lastName) {
      username = `${req.user.firstName || ""}_${req.user.lastName || ""}`.trim();
    }
    // Fallback to request body
    else if (req.body?.firstName || req.body?.lastName) {
      username = `${req.body.firstName || ""}_${req.body.lastName || ""}`.trim();
    }
    // Fallback to DB
    else if (userId) {
      const dbUser = await client.query(
        "SELECT firstname, lastname FROM ins.users WHERE id=$1",
        [userId]
      );
      if (dbUser.rows[0]) {
        username =
          `${dbUser.rows[0].firstname || ""}_${dbUser.rows[0].lastname || ""}`.trim() ||
          "user";
      }
    }

    req.username = username || "user";
    next();
  } catch (err) {
    console.error("Error resolving username:", err);
    req.username = "user";
    next();
  }
};

export const startConversation = async (req, res) => {
  const { p_campaignapplicationid} = req.body;

  if (!p_campaignapplicationid ) {
    return res.status(400).json({
      message: "campaignapplicationid  Id Require",
    });
  }
  

  try {
    const result = await client.query(
      `call ins.usp_upsert_conversation(
        $1::bigint,
        $2::boolean,
        $3::text
       )`,
      [
        p_campaignapplicationid,
        null,
        null,
      ]
    );

    const { p_status, p_message } = result.rows[0];

    if (p_status) {
      return res
        .status(200)
        .json({ message: p_message, p_status, source: "db" });
    } else {
      return res.status(400).json({ message: p_message, p_status });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};



export const insertMessage = async (req, res) => {
  const { p_conversationid, p_roleid, p_messages, p_replyid, p_messageid } = req.body || {};

  // Multiple file paths
  let p_filepaths = null;
  if (req.files && req.files.length > 0) {
    p_filepaths = req.files
      .map((file) => file.path.replace(/\\/g, "/"))
      .join(",");
  } else if (req.body.p_filepath) {
    p_filepaths = req.body.p_filepath;
  }

  if (!p_conversationid || !p_roleid) {
    return res
      .status(400)
      .json({ message: "Action, conversationId, and roleId are required" });
  }

  try {
    const result = await client.query(
      `CALL ins.usp_upsert_message(
        $1::bigint, 
        $2::smallint, 
        $3::text,
        $4::text, 
        $5::boolean, 
        $6::text,
        $7::bigint,
        $8::bigint
        
      )`,
      [
        p_conversationid,
        p_roleid,
        p_messages || null,
        p_filepaths || null,
        null,
        null,
        p_replyid || null,
        p_messageid|| null
      ]
    );

    const { p_status, p_message } = result.rows[0] || {};

    if (p_status) {
      return res.status(200).json({
        message: p_message,
        p_status,
        filePaths: p_filepaths ? p_filepaths.split(",") : [],
      });
    } else {
      return res.status(400).json({ message: p_message, p_status });
    }
  } catch (error) {
    console.error("Failed to upsert message:", error);
    return res.status(500).json({ message: error.message });
  }
};


//Get Conversations (Full)
export const getConversationsdetails = async (req, res) => {
  try {
    const p_userid = req.user?.id; // token se user id
    const { p_search = "" } = req.query || {};

    if (!p_userid) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_conversationdetails($1::BIGINT, $2::TEXT)`,
      [p_userid, p_search]
    );

    if (!result?.rows?.length || !result.rows[0]?.fn_get_conversationdetails) {
      return res.status(404).json({ message: "No conversations found" });
    }

    const conversations = result.rows[0].fn_get_conversationdetails;

    return res.status(200).json({
      message: "Conversations fetched successfully",
      data: conversations,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return res.status(500).json({
      message: "Failed to get conversations",
      error: error.message,
    });
  }
};

// Get Campaigns only
export const getCampaigns = async (req, res) => {
  try {
    const p_userid = req.user?.id;
    const { p_search = "" } = req.query || {};

    if (!p_userid) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_conversationdetails($1::BIGINT, $2::TEXT)`,
      [p_userid, p_search]
    );

    if (!result?.rows?.length || !result.rows[0]?.fn_get_conversationdetails) {
      return res.status(404).json({ message: "No campaigns found" });
    }

    const campaigns = result.rows[0].fn_get_conversationdetails.map((row) => ({
      campaignid: row.campaignid,
      campaignname: row.campaignname,
      campaignphoto: row.campaignphoto,
    }));

    return res.status(200).json({
      message: "Campaigns fetched successfully",
      data: campaigns,
    });
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return res.status(500).json({
      message: "Failed to get campaigns",
      error: error.message,
    });
  }
};


// Get Influencers only
export const getInfluencers = async (req, res) => {
  try {
    const p_userid = req.user?.id;
    const { p_search = "" } = req.query || {};

    if (!p_userid) {
      return res.status(400).json({ message: "User ID is required." });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_conversationdetails($1::BIGINT, $2::TEXT)`,
      [p_userid, p_search]
    );

    if (!result?.rows?.length || !result.rows[0]?.fn_get_conversationdetails) {
      return res.status(404).json({ message: "No influencers found" });
    }

    // saare campaigns ke influencers ko ek array me merge karo
    const influencers = result.rows[0].fn_get_conversationdetails.flatMap(
      (row) => row.influencers || []
    );

    return res.status(200).json({
      message: "Influencers fetched successfully",
      data: influencers,
    });
  } catch (error) {
    console.error("Error fetching influencers:", error);
    return res.status(500).json({
      message: "Failed to get influencers",
      error: error.message,
    });
  }
};


export const getVendors = async (req, res) => {
  try {
    const p_userid = req.user?.id;
    const { p_search = "" } = req.query || {};
    if (!p_userid) {
      return res.status(400).json({ message: "User ID is required." });
    }
    const result = await client.query(
      `SELECT * FROM ins.fn_get_conversationdetails($1::BIGINT, $2::TEXT)`,
      [p_userid, p_search]
    );
    if (!result?.rows?.length || !result.rows[0]?.fn_get_conversationdetails) {
      return res.status(404).json({ message: "No vendors found" });
    }
    // saare campaigns ke vendors ko ek array me merge karo
    const vendors = result.rows[0].fn_get_conversationdetails.flatMap(
      (row) => row.vendors || []
    );
    return res.status(200).json({
      message: "Vendors fetched successfully",
      data: vendors,
    });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return res.status(500).json({
      message: "Failed to get vendors",
      error: error.message,
    });
  }
};


export const getMessages = async (req, res) => {
  try {
    const { p_conversationid, p_roleid, p_limit, p_offset } = req.query;

    if (!p_conversationid) {
      return res.status(400).json({ message: "Conversation ID is required." });
    }

    // Parse limit and offset, but allow null
    const limit = p_limit !== undefined && p_limit !== "" ? parseInt(p_limit, 20) : null;
    const offset = p_offset !== undefined && p_offset !== "" ? parseInt(p_offset, 0) : null;

    if (isNaN(limit) && limit !== null) {
      return res.status(400).json({ message: "Invalid limit value" });
    }
    if (isNaN(offset) && offset !== null) {
      return res.status(400).json({ message: "Invalid offset value" });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_messages(
        $1::BIGINT,
        $2::SMALLINT,
        $3::INTEGER,
        $4::INTEGER
      )`,
      [p_conversationid, p_roleid, limit, offset]
    );

    const messages = result.rows[0]?.fn_get_messages;

    if (!messages || messages.length === 0) {
      return res.status(404).json({ message: "No messages found." });
    }

    return res.status(200).json({
      message: "Messages fetched successfully",
      data: messages,
      source: "db",
    });
  } catch (error) {
    console.log("Failed to get messages", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

//..................DELETE MESSAGE.................
// export const deleteMessage = async (req, res) => {
//   try {
//     const { p_messageid, p_userid } = req.body;

//     if (!p_messageid || !p_userid) {
//       return res
//         .status(400)
//         .json({ message: "Message ID and User ID are required." });
//     }

//     const result = await client.query(
//       `SELECT * FROM ins.fn_delete_message($1::BIGINT, $2::BIGINT)`,
//       [p_messageid, p_userid]
//     );

//     const response = result.rows[0].fn_delete_message;

//     if (!response) {
//       return res.status(400).json({ message: "Message could not be deleted." });
//     }

//     return res.status(200).json({
//       message: "Message deleted successfully",
//       data: response,
//       source: "db",
//     });
//   } catch (error) {
//     console.log("Failed to delete message", error);
//     return res.status(500).json({ message: "Internal Server Error" });
//   }
// };

export const updateUndoMessage = async (req, res) => {
  try {
    const { p_messageid, p_roleid, p_action  } = req.body;
    if (!p_messageid || !p_roleid || !p_action) {
      return res
        .status(400)
        .json({ message: "Message ID, Role ID, and Action are required." });
    }
    const result = await client.query(
      `CALL ins.usp_update_undomessage(
        $1::BIGINT,
        $2::SMALLINT,
        $3::TEXT,
        $4::BOOLEAN,
        $5::VARCHAR
      )`,
      [p_messageid, p_roleid, p_action, null, null]
    );
    const { p_status, p_message } = result.rows[0] || {};
    if (p_status) {
      return res.status(200).json({
        message: p_message,
        p_status,
      });
    } else {
      return res.status(400).json({ message: p_message, p_status });
    }
  } catch (error) {
    console.error("Failed to update message:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};