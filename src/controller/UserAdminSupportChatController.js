import { client } from "../config/Db.js";
import redis from "redis";
import { createClient } from '@supabase/supabase-js';
import {io} from "../../app.js"

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
      $5::smallint,
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

    if (p_status === 1) {
      return res.status(200).json({
        message: p_message,
        p_status,
      });
    }

    if (p_status === 0) {
      return res.status(400).json({
        message: p_message,
        p_status,
      });
    }

    if (p_status === -1) {
      return res.status(500).json({
        message: p_message,
        p_status,
      });
    }

    // Fallback (unknown p_status)
    return res.status(500).json({
      message: "Unknown database response",
      p_status,
    });
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
        p_offset||1
      ]
    );
    
    const data = result.rows[0].fn_get_usersupportticketmessages;
      io.to(`user_${p_userid}`).emit("sidebarTicketUpdate", {
        ticketId: p_usersupportticketid,
        readbyadmin: true,
        readbyuser: true,
      });
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

    const validate = await client.query(
      `select * from ins.fn_get_usersupportticketaccess($1::bigint,$2::bigint);`,
      [p_usersupportticketid, p_senderid]
    );

    const data = validate.rows[0].fn_get_usersupportticketaccess
    if (!data.status) { 
        return res.status(403).json({success:data.status,message: data.message });
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
        $5::smallint,
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

    const row = result.rows?.[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    // ----------------- HANDLE p_status -----------------
    if (p_status === 1) {
      // SOCKET EMIT
      io.to(`ticket_${p_usersupportticketid}`).emit("receiveSupportMessage", {
        ticketId: p_usersupportticketid,
        senderId: p_senderid,
        message: p_messages,
        file: p_filepath,
        replyId: p_replyid,
        lastmessagedate: new Date(),
        readbyuser: false,
      });

      let receiverId = null;
      if (data.userid && data.adminid) {
        receiverId = p_senderid === data.userid ? data.adminid : data.userid;
      } else if (data.receiverid) {
        receiverId = data.receiverid;
      }

      if (receiverId) {
        io.to(`user_${receiverId}`).emit("sidebarTicketUpdate", {
          ticketId: p_usersupportticketid,
          lastmessagedate: new Date(),
          readbyadmin: p_senderid === data.adminid,
          readbyuser: p_senderid === data.userid,
        });
      }

      return res.status(200).json({
        status: true,
        message: p_message || "Message sent successfully",
        filePaths: p_filepath,
      });
    } else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message || "Validation failed",
        filePaths: p_filepath,
      });
    } else if (p_status === -1) {
      return res.status(500).json({
        status: false,
        message: "Something went wrong. Please try again later.",
      });
    } else {
      return res.status(500).json({
        status: false,
        message: "Unexpected database response",
      });
    }
    } catch (error) {
      console.error("Error in sendSupportMessage:", error);
      return res.status(500).json({ message: error.message });
    }
  };