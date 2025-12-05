import { createClient } from '@supabase/supabase-js';
import { client } from '../config/Db.js';
import { io } from '../../app.js'
// import authenticateUser from '../middleware/AuthMiddleware.js';

// Create Supabase client once at the top
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const resolveUsername = async (req, res, next) => {
  const userId = req.user?.id || req.body?.userId;
  let username = "user";

  try {
    if (req.user?.name) {
      // Split by space and take first word
      username = req.user.name.split(" ")[0].trim();
    }

    //  Fallback: from request body
    else if (req.body?.firstName) {
      username = req.body.firstName.trim();
    }

    // Final fallback: from DB
    else {
      const dbUser = await client.query(
        "SELECT firstname FROM ins.users WHERE id=$1",
        [userId]
      );
      if (dbUser.rows[0]?.firstname) {
        username = dbUser.rows[0].firstname.trim();
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
  const { p_campaignapplicationid } = req.body;
  const p_userid = req.user?.id;


  if (!p_campaignapplicationid) {
    return res.status(400).json({
      message: "campaignapplicationid  Id Require",
    });
  }


  try {
    const result = await client.query(
      `call ins.usp_upsert_conversation(
        $1::bigint,
        $2::smallint,
        $3::text
       )`,
      [
        p_campaignapplicationid,
        null,
        null,
      ]
    );

    const row = result.rows[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    if (p_status === 1) {
      // Fetch notifications
      const notifRes = await client.query(
        `SELECT * FROM ins.fn_get_notificationlist($1::bigint, $2::boolean)`,
        [p_userid, null]
      );

      const notifyData = notifRes.rows[0]?.fn_get_notificationlist || [];

      // Emit notifications via socket
      if (notifyData.length === 0) {
          console.log("No notifications found.");
        } else {
          console.log(notifyData);
          const latest = notifyData[0];

          const toUserId = latest.receiverid;

          if (toUserId) {
            io.to(`user_${toUserId}`).emit("receiveNotification", notifyData);
            console.log("📩 Sent to:", toUserId);
          }
        }

      return res.status(200).json({
        status: true,
        message: p_message || "Conversation started successfully",
        source: "db",
      });
    } else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message || "Failed to start conversation",
        source: "db",
      });
    }
    
     else {
      return res.status(500).json({
        status: false,
        message: p_message || "Unexpected database response",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};

export const insertMessage = async (req, res) => {
  const { p_conversationid, p_roleid, p_messages, p_replyid, p_messageid, campaignid, campaignName, influencerId, influencerName, vendorId, vendorName } = req.body || {};
  const roleId = req.user?.roleId || p_roleid; // sender's role
  // const userId = req.user?.id; // sender's id

  let p_filepaths = null;
  if (req.files && req.files.length > 0) {
    const uploadedUrls = [];

    // Get role and user info
    const roleId = req.user?.roleId || p_roleid;
    const userId = req.user?.id;
    const username = req.username || "user";

    for (const file of req.files) {
      const timestamp = Date.now();
      const newFileName = `${timestamp}_${file.originalname}`;
      // const newFileName = `${file.originalname}`;

      let uniqueFileName = ""

      //Created Folder Path For Vendor And Influencer saved in vendor side
      if (Number(roleId) === 2) {
        uniqueFileName = `Vendor/${userId}/Campaigns/${campaignid}/Chat/${influencerId}/${newFileName}`;
      } else if ((Number(roleId) === 1)) {
        uniqueFileName = `Vendor/${vendorId}/Campaigns/${campaignid}/Chat/${userId}/${newFileName}`;
      }

      // Upload file to Supabase
      const { data, error } = await supabase.storage
        .from("uploads") // bucket name
        .upload(uniqueFileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: publicData } = supabase.storage
        .from("uploads")
        .getPublicUrl(uniqueFileName);

      uploadedUrls.push(publicData.publicUrl);
    }

    p_filepaths = uploadedUrls.join(",");
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
        $5::smallint, 
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
        p_messageid || null,
      ]
    );

    const row = result.rows[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    if (p_status === 1) {
      const recipientId = roleId === 1 ? vendorId : influencerId;

      io.to(String(p_conversationid)).emit("receiveMessage", {
        conversationid: p_conversationid,
        message: p_messages || "",
        filepaths: p_filepaths ? p_filepaths.split(",") : [],
        roleid: p_roleid,
        replyid: p_replyid || null,
        createddate: new Date().toISOString(),
        userid: req.user?.id,
        campaignid,
        influencerId,
        vendorId,
        readbyvendor: false,
        readbyinfluencer: false,
      });

      return res.status(200).json({
        status: p_status,
        message: p_message,
        source: "db",
        filePaths: p_filepaths ? p_filepaths.split(",") : [],
      });
    } else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message,
        source: "db",
      });
    } else if (p_status === -1) {
      return res.status(500).json({
        status: p_status,
        message: "Unexpected database error",
        source: "db",
      });
    } else {
      return res.status(500).json({
        status: p_status,
        message: "Unknown database response",
        source: "db",
      });
    }
  } catch (error) {
    console.error("Failed to upsert message:", error);
    return res.status(500).json({ message: error.message });
  }
};

//Get Conversations (Full)
export const getConversationsdetails = async (req, res) => {
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


export const updateUndoMessage = async (req, res) => {
  try {
    const { p_messageid, p_roleid, p_action } = req.body;
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
        $4::SMALLINT,
        $5::VARCHAR
      )`,
      [p_messageid, p_roleid, p_action, null, null]
    );
    const row = result.rows?.[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    // ----------------- HANDLE p_status -----------------
    if (p_status === 1) {
      return res.status(200).json({
        message: p_message || "Message updated successfully",
        p_status,
      });
    } 
    else if (p_status === 0) {
      return res.status(400).json({
        message: p_message || "Validation failed",
        p_status,
      });
    } 
    else if (p_status === -1) {
      return res.status(500).json({
        message: "Something went wrong. Please try again later.",
        p_status: false,
      });
    } 
    else {
      return res.status(500).json({
        message: "Unexpected database response",
        p_status: false,
      });
    }
  } catch (error) {
    console.error("Failed to update message:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const unreadMessageList = async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  try {
    if (!userId) {
      res.json({ message: "please enter userId" });
    }
    const result = await client.query(
      `SELECT * FROM ins.fn_get_unreadmessagelist($1::bigint);`,
      [userId]

    );
    const lists = result.rows[0].fn_get_unreadmessagelist;

    return res.status(200).json({
      message: "Unread message list fetched successfully",
      data: lists,
      source: "db",
    });

  } catch (error) {
    console.error("Failed to update message:", error);
    return res.status(500).json({ message: error.message });
  }
};