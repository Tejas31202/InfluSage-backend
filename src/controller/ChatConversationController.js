// src/services/chatService.js
import { client } from "../config/Db.js";

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

//..................CREATE CONVERSATION.................
export const createConversation = async (req, res) => {
  try {
    const {
      p_senderid,
      p_senderrole,
      p_receiverid,
      p_receiverrole,
      p_message,
    } = req.body;

    if (!p_senderid || !p_receiverid) {
      return res
        .status(400)
        .json({ message: "Sender and Receiver ID are required." });
    }

    const result = await client.query(  
      `SELECT * FROM ins.fn_create_conversation(
        $1::BIGINT,
        $2::VARCHAR,
        $3::BIGINT,
        $4::VARCHAR,
        $5::TEXT
      )`,
      [p_senderid, p_senderrole, p_receiverid, p_receiverrole, p_message]
    );

    return res.status(200).json({
      message: "Conversation created successfully",
      data: result.rows[0].fn_create_conversation,
      source: "db",
    });
  } catch (error) {
    console.error("Failed to create conversation", error);

    // If SP throws restriction error
    if (error.message.includes("Influencer cannot message")) {
      return res.status(403).json({ message: error.message });
    }

    return res.status(500).json({ message: "Internal Server Error" });
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
  const { p_conversationid, p_roleid, p_messages } = req.body || {};

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
      `CALL ins.usp_insert_message(
        $1::bigint, 
        $2::smallint, 
        $3::text, 
        $4::text, 
        $5::boolean, 
        $6::text
      )`,
      [
        p_conversationid,
        p_roleid,
        p_messages || null,
        p_filepaths || null,
        null,
        null,
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

 

//..................SEND MESSAGE.................
export const sendMessage = async (req, res) => {
  try {
    const { p_conversationid, p_senderid, p_message, p_type } = req.body;

    if (!p_conversationid || !p_senderid || !p_message) {
      return res
        .status(400)
        .json({
          message: "Conversation ID, Sender ID, and Message are required.",
        });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_send_message(
        $1::BIGINT,
        $2::BIGINT,
        $3::TEXT,
        $4::VARCHAR
      )`,
      [p_conversationid, p_senderid, p_message, p_type || "text"]
    );

    const message = result.rows[0].fn_send_message;

    if (!message) {
      return res.status(400).json({ message: "Message could not be sent." });
    }

    return res.status(200).json({
      message: "Message sent successfully",
      data: message,
      source: "db",
    });
  } catch (error) {
    console.log("Failed to send message", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

//..................GET MESSAGES.................
export const getMessages = async (req, res) => {
  try {
    const { p_conversationid } = req.query;

    if (!p_conversationid) {
      return res.status(400).json({ message: "Conversation ID is required." });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_messages($1::BIGINT)`,
      [p_conversationid]
    );

    const messages = result.rows[0].fn_get_messages;

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
export const deleteMessage = async (req, res) => {
  try {
    const { p_messageid, p_userid } = req.body;

    if (!p_messageid || !p_userid) {
      return res
        .status(400)
        .json({ message: "Message ID and User ID are required." });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_delete_message($1::BIGINT, $2::BIGINT)`,
      [p_messageid, p_userid]
    );

    const response = result.rows[0].fn_delete_message;

    if (!response) {
      return res.status(400).json({ message: "Message could not be deleted." });
    }

    return res.status(200).json({
      message: "Message deleted successfully",
      data: response,
      source: "db",
    });
  } catch (error) {
    console.log("Failed to delete message", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

