import { client } from "../config/Db.js";
import redis from "redis";
import { createClient } from '@supabase/supabase-js';

// Create Supabase client once at the top
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

export const getSubjectListByRole = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;

    if (!p_userid) {
      return res.status(400).json({ message: "User ID (p_userid) is required." });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_subjectlist($1::BIGINT);`,
      [p_userid]
    );
    const subjectList = result.rows[0].fn_get_subjectlist;

    return res.status(200).json({
      message: "Subject list fetched successfully",
      subjectList: subjectList,
    });
  } catch (error) {
    console.error("error in getSubjectListByRole:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const createTicketAndUpdateStatus = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;

    const { p_usersupportticketid, p_objectiveid, p_statusname } = req.body;

    if (!p_userid) {
      return res.status(400).json({
        message: "p_userid is required.",
      });
    }
    // Case 1: Creating a new ticket → requires objective + status
    if (!p_usersupportticketid) {
      if (!p_objectiveid || !p_statusname) {
        return res.status(400).json({
          message: "To create a ticket, p_objectiveid and p_statusname are required.",
        });
      }
    }

    // Case 2: Updating ticket status → requires ticketId + status
    if (p_usersupportticketid) {
      if (!p_statusname) {
        return res.status(400).json({
          message: "To update status, p_usersupportticketid and p_statusname are required.",
        });
      }
    }

    const result = await client.query(
      `CALL ins.usp_upsert_usersupportticket(
      $1::bigint,
      $2::bigint,
      $3::smallint,
      $4::varchar(10),
      $5::boolean,
      $6::varchar
      );`,
      [
        p_userid,
        p_usersupportticketid || null,
        p_objectiveid || null,
        p_statusname,
        null,
        null,
      ]
    );
    const { p_status, p_message } = result.rows[0];

    if (p_status) {
      return res.status(200).json({
        message: p_message,
        p_status,
      });
    } else {
      return res.status(400).json({ message: p_message, p_status });
    }
  } catch (error) {
    console.error("error in createTicketAndUpdateStatus:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const viewAllTicketByUserId = async (req, res) => {
  try {
    const p_userid= req.user?.id || req.query.userId;
  
    if (!p_userid ) {
      return res.status(400).json({ message: "p_userid  is required." });
    }
    const {p_statuslabelid,p_search}=req.query;
  
    const result = await client.query(
      `SELECT * FROM ins.fn_get_usersubjectlist(
      $1::bigint,
      $2::smallint,
      $3::text
      );`,
      [
        p_userid ,
        p_statuslabelid,
        p_search||null
      ]
    );
    const viewTicket = result.rows[0].fn_get_usersubjectlist;
    return res.status(200).json({
      message: "Ticket list fetched successfully.",
      viewTicket: viewTicket,
    });
  } catch (error) {
    console.error("error in viewAllTicketByUserId:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const openChatByTicketId = async (req, res) => {
  try {
    const p_userid  = req.user?.id || req.query.p_userid;
    const p_usersupportticketid  = req.params.p_usersupportticketid;
    const {p_limit,p_offset}=req.query;

    if(!p_usersupportticketid){
      return res.status(400).json({ message: "p_usersupportticketid is required." });
    }
    const result = await client.query(
      `SELECT * FROM ins.fn_get_usersupportticketmessages(
      $1::bigint,
      $2::bigint,
      $3::integer,
      $4::integer  
      );`,
      [
        p_usersupportticketid,
        p_userid,
        p_limit||20,
        p_offset||0
      ]
    );
    
    const data = result.rows[0].fn_get_usersupportticketmessages;
    return res.status(200).json({
      message: "Chat opened successfully for the selected ticket.",
      data: data,
    });
  } catch (error) {
    console.error("error in openChatByTicketId:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getTicketStatus = async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * FROM ins.fn_get_usersupportticketstatus()"
    );

    const status = result.rows;

    return res.status(200).json({
      message: "Successfully retrieved ticket statuses",
      status: status,
    });
  } catch (error) {
    console.error("error in getTicketStatus:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const sendSupportMessage = async (req, res) => {
  try {
    const p_senderid = req.user?.id || req.body.p_senderid;
    const { p_usersupportticketid, p_messages, p_replyid } = req.body;

    if (!p_senderid || !p_usersupportticketid ) {
      return res.status(400).json({
        message: "p_senderid , p_usersupportticketid are required.",
      });
    }

    if (!p_messages && !req.file) {
      return res.status(400).json({
        message: "Either a p_messages or an attachment is required.",
      });
     }

    // ----------------- FILE HANDLING -----------------
    let filePaths = [];
    const ticketFolder = `support_chat/ticket_${p_usersupportticketid}/`;

    // // Single file
    if (req.file) {
      const f = req.file;
      const fileName = `${req.user?.role}Id_${p_senderid}_${Date.now()}_${
        f.originalname
      }`;

      const { error } = await supabase.storage
        .from("uploads")
        .upload(`${ticketFolder}${fileName}`, f.buffer, {
          contentType: f.mimetype,
          upsert: false,
        });

      if (error) return res.status(500).json({ message: "File upload failed" });

      const { data: publicUrlData } = supabase.storage
        .from("uploads")
        .getPublicUrl(`${ticketFolder}${fileName}`);

      filePaths.push(publicUrlData.publicUrl);
    }

    const p_filepath = filePaths.length > 0 ? filePaths[0] : null;
    // ----------------- DB CALL -----------------
    const result = await client.query(
      `CALL ins.usp_insert_usersupportticketmessage(
        $1::bigint,
        $2::smallint,
        $3::text,
        $4::text,
        $5::boolean,
        $6::text,
        $7::bigint
      );`,
      [
        p_usersupportticketid,
        p_senderid,
        p_messages,
        p_filepath || null,
        null,
        null,
        p_replyid || null,
      ]
    );

    const { p_status, p_message } = result.rows[0] || {};

    if (p_status) {
      return res.status(200).json({
        message: p_message,
        p_status,
        filePaths: p_filepath,
      });
    } else {
      return res.status(400).json({ message: p_message, p_status });
    }
  } catch (error) {
    console.error("Error in sendSupportMessage:", error);
    return res.status(500).json({ message: error.message });
  }
};