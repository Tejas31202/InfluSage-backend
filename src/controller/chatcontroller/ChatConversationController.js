import { createClient } from '@supabase/supabase-js';
import { client } from '../../config/Db.js';
import { io } from '../../../app.js';
import { HTTP, SP_STATUS } from '../../utils/Constants.js';

// Create Supabase client once at the top
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const startConversation = async (req, res) => {
  const { p_campaignapplicationid } = req.body;
  const p_userid = req.user?.id;

  if (!p_campaignapplicationid) {
    return res.status(HTTP.BAD_REQUEST).json({
      message: "campaignapplicationid  Id Require",
    });
  }

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(p_userid)]
    );
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
    await client.query("COMMIT");

    const row = result.rows[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;
    const p_role = 'SENDER';

    if (p_status === SP_STATUS.SUCCESS) {
      // Fetch notifications
      const notifRes = await client.query(
        `SELECT * FROM ins.fn_get_notificationlist($1::bigint, $2::boolean, $3::text)`,
        [p_userid, null, p_role]
      );

      const notifyData = notifRes.rows[0]?.fn_get_notificationlist || [];

      // Emit notifications via socket
      if (notifyData.length === 0) {
        return;
      }
      const latest = notifyData[0];
      const toUserId = latest.receiverid;
      if (!toUserId) return;

      io.to(`user_${toUserId}`).emit("receiveNotification", notifyData);

      return res.status(HTTP.OK).json({
        status: true,
        message: p_message || "Conversation started successfully",
        source: "db",
      });
    } else if (p_status === SP_STATUS.VALIDATION_FAIL) {
      return res.status(HTTP.BAD_REQUEST).json({
        status: false,
        message: p_message || "Failed to start conversation",
        source: "db",
      });
    }

    else {
      return res.status(HTTP.INTERNAL_ERROR).json({
        status: false,
        message: p_message || "Unexpected database response",
      });
    }
  } catch (error) {
    console.error("error in startConversation:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const insertMessage = async (req, res) => {
  const userId = req.user?.id || req.body.userId;

  if (!userId) {
    return res.status(HTTP.UNAUTHORIZED).json({
      status: false,
      message: "Unauthorized: user not found",
    });
  }

  const {
    p_conversationid,
    p_roleid,
    p_messages,
    p_replyid,
    p_messageid,
    campaignid,
    influencerId,
    vendorId,
    tempId,
  } = req.body || {};

  let p_filepaths = null;

  /* ---------------- FILE UPLOAD ---------------- */
  if (req.files && req.files.length > 0) {
    const uploadedUrls = [];
    const roleId = req.user?.roleId || p_roleid;

    for (const file of req.files) {
      const timestamp = Date.now();
      const newFileName = `${timestamp}_${file.originalname}`;
      let uniqueFileName = "";

      if (Number(roleId) === 2) {
        uniqueFileName = `Vendor/${userId}/Campaigns/${campaignid}/Chat/${influencerId}/${newFileName}`;
      } else if (Number(roleId) === 1) {
        uniqueFileName = `Vendor/${vendorId}/Campaigns/${campaignid}/Chat/${userId}/${newFileName}`;
      }

      const { error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(uniqueFileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) throw error;

      const { data: publicData } = supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(uniqueFileName);

      uploadedUrls.push(publicData.publicUrl);
    }

    p_filepaths = uploadedUrls.join(",");
  } else if (req.body.p_filepath) {
    p_filepaths = req.body.p_filepath;
  }

  if (!p_conversationid || !p_roleid) {
    return res.status(HTTP.BAD_REQUEST).json({
      message: "conversationId and roleId are required",
    });
  }

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId)]
    );

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

    await client.query("COMMIT");

    const row = result.rows?.[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    /*  IMPORTANT FIX: real DB message ID */
    const newMessageId = row.p_messageid;

    if (p_status === SP_STATUS.SUCCESS) {
      const entityResult = await client.query(
        `SELECT * FROM ins.get_entity_details($1::bigint, $2::text)`,
        [userId, "user"]
      );

      const entityDetails = entityResult.rows[0] || {};

      /* ---------------- SOCKET PAYLOAD ---------------- */
      const payload = {
        tempId,
        messageid: newMessageId, // ✅ REAL DB ID
        is_deleted: false,
        conversationid: p_conversationid,
        message: p_messages || "",
        filepaths: p_filepaths ? p_filepaths.split(",") : [],
        roleid: p_roleid,
        replyid: p_replyid || null,
        createddate: new Date().toISOString(),
        userid: userId,
        campaignid,
        influencerId,
        vendorId,
        name: entityDetails?.name || "",
        photopath: entityDetails?.photopath || "",

        /* IMPORTANT FIX: correct read flags */
        readbyvendor: Number(p_roleid) === 2,
        readbyinfluencer: Number(p_roleid) === 1,
      };

      /* ---------------- SOCKET EMIT ---------------- */
      io.to(String(p_conversationid)).emit("receiveMessage", payload);

      return res.status(200).json({
        status: p_status,
        message: p_message,
        tempId,
        messageid: newMessageId,
        filePaths: payload.filepaths,
        source: "db",
      });
    }

    if (p_status === SP_STATUS.VALIDATION_FAIL) {
      return res.status(HTTP.BAD_REQUEST).json({
        status: false,
        message: p_message,
        source: "db",
      });
    }

    return res.status(HTTP.INTERNAL_ERROR).json({
      status: p_status,
      message: "Unexpected database response",
      source: "db",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to upsert message:", error);

    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
 
//Get Conversations (Full)
export const getConversationsdetails = async (req, res) => {
  try {
    const p_userid = req.user?.id;
    const { p_search = "" } = req.query || {};

    if (!p_userid) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "User ID is required." });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_conversationdetails($1::BIGINT, $2::TEXT)`,
      [p_userid, p_search]
    );

    if (!result?.rows?.length || !result.rows[0]?.fn_get_conversationdetails) {
      return res.status(HTTP.NOT_FOUND).json({ message: "No conversations found" });
    }

    const conversations = result.rows[0].fn_get_conversationdetails;

    return res.status(HTTP.OK).json({
      message: "Conversations fetched successfully",
      data: conversations,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { p_conversationid, p_roleid, p_limit, p_offset } = req.query;
    if (!p_conversationid) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "Conversation ID is required." });
    }

    // Parse limit and offset, but allow null
    const limit = p_limit !== undefined && p_limit !== "" ? parseInt(p_limit, 20) : null;
    const offset = p_offset !== undefined && p_offset !== "" ? parseInt(p_offset, 0) : null;

    if (isNaN(limit) && limit !== null) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "Invalid limit value" });
    }
    if (isNaN(offset) && offset !== null) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "Invalid offset value" });
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
      return res.status(HTTP.NOT_FOUND).json({ message: "No messages found." });
    }

    return res.status(HTTP.OK).json({
      message: "Messages fetched successfully",
      data: messages,
      source: "db",
    });
  } catch (error) {
    console.error("Failed to get messages", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const updateUndoMessage = async (req, res) => {
  const userId = req.user?.id || req.body.userId;

  if (!userId) {
    return res.status(HTTP.UNAUTHORIZED).json({
      status: false,
      message: "Unauthorized: user not found",
    });
  }
  try {
    const { p_messageid, p_roleid, p_action } = req.body;
    if (!p_messageid || !p_roleid || !p_action) {
      return res
        .status(HTTP.BAD_REQUEST)
        .json({ message: "Message ID, Role ID, and Action are required." });
    }

    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId)]
    );
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
    await client.query("COMMIT");
    const row = result.rows?.[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    // ----------------- HANDLE p_status -----------------
    if (p_status === SP_STATUS.SUCCESS) {
      return res.status(HTTP.OK).json({
        message: p_message || "Message updated successfully",
        p_status,
      });
    }
    else if (p_status === SP_STATUS.VALIDATION_FAIL) {
      return res.status(HTTP.BAD_REQUEST).json({
        message: p_message || "Validation failed",
        p_status,
      });
    }
    else if (p_status === SP_STATUS.ERROR) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(HTTP.INTERNAL_ERROR).json({
        message: "Something went wrong. Please try again later.",
        p_status: false,
      });
    }
    else {
      return res.status(HTTP.INTERNAL_ERROR).json({
        message: "Unexpected database response",
        p_status: false,
      });
    }
  } catch (error) {
    console.error("Failed to update message:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const unreadMessageList = async (req, res) => {
  const userId = req.user?.id || req.body.userId;

  try {
    if (!userId) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "please enter userId" });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_unreadmessagelist($1::bigint);`,
      [userId]
    );
    const lists = result.rows?.[0]?.fn_get_unreadmessagelist ?? [];

    return res.status(HTTP.OK).json({
      message: "Unread message list fetched successfully",
      data: lists,
      source: "db",
    });

  } catch (error) {
    console.error("Failed to fetch unread messages:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
