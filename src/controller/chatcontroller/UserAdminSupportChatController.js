import { client } from '../../config/Db.js';
import Redis from "../../utils/RedisWrapper.js";
import { createClient } from '@supabase/supabase-js';
import { io } from '../../../app.js';
import { HTTP, SP_STATUS } from '../../utils/Constants.js';

// Create Supabase client once at the top
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// const Redis = redis.createClient({ url: process.env.REDIS_URL });
// Redis.connect().catch(console.error);

export const getSubjectListByRole = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;

    if (!p_userid) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "User ID (p_userid) is required." });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_subjectlist($1::BIGINT);`,
      [p_userid]
    );
    const subjectList = result.rows[0].fn_get_subjectlist;

    return res.status(HTTP.OK).json({
      message: "Subject list fetched successfully",
      subjectList: subjectList,
    });
  } catch (error) {
    console.error("error in getSubjectListByRole:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const createTicketAndUpdateStatus = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;

    const { p_usersupportticketid, p_objectiveid, p_statusname } = req.body;

    if (!p_userid) {
      return res.status(HTTP.BAD_REQUEST).json({
        message: "p_userid is required.",
      });
    }
    // Case 1: Creating a new ticket → requires objective + status
    if (!p_usersupportticketid) {
      if (!p_objectiveid || !p_statusname) {
        return res.status(HTTP.BAD_REQUEST).json({
          message: "To create a ticket, p_objectiveid and p_statusname are required.",
        });
      }
    }

    // Case 2: Updating ticket status → requires ticketId + status
    if (p_usersupportticketid) {
      if (!p_statusname) {
        return res.status(HTTP.BAD_REQUEST).json({
          message: "To update status, p_usersupportticketid and p_statusname are required.",
        });
      }
    }

    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(p_userid)]
    );
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
    await client.query("COMMIT");
    const { p_status, p_message } = result.rows[0];


    if (p_status === SP_STATUS.SUCCESS) {
      try {
        const p_role = "SENDER";
        const notification = await client.query(
          `SELECT * FROM ins.fn_get_notificationlist($1::bigint, $2::boolean, $3::text)`,
          [p_userid, null, p_role]
        );
        const notifyData =
          notification.rows[0]?.fn_get_notificationlist || [];
        if (notifyData.length > 0) {
          const latest = notifyData[0];
          const toUserId = latest.receiverid;
          if (toUserId) {
            io.to(`notification_${toUserId}`).emit(
              "receiveNotification",
              latest
            );
            console.log(`Notification sent to user_${toUserId}`);
          }
        }
      } catch (error) {
        console.error("Notification error:", error);
      }
      return res.status(HTTP.OK).json({
        status: true,
        message: p_message || "Contract created/updated successfully",
        source: "db",
      });
    }
    if (p_status === SP_STATUS.VALIDATION_FAIL) {
      return res.status(HTTP.BAD_REQUEST).json({
        message: p_message,
        p_status,
      });
    }
    if (p_status === SP_STATUS.ERROR) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(HTTP.INTERNAL_ERROR).json({
        message: "Something went wrong. Please try again later.",
        p_status,
      });
    }
    // Fallback (unknown p_status)
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Unknown database response",
      p_status,
    });
  } catch (error) {
    console.error("error in createTicketAndUpdateStatus:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const viewAllTicketByUserId = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.userId;

    if (!p_userid) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "p_userid  is required." });
    }
    const { p_statuslabelid, p_search } = req.query;

    const result = await client.query(
      `SELECT * FROM ins.fn_get_usersubjectlist(
      $1::bigint,
      $2::smallint,
      $3::text
      );`,
      [
        p_userid,
        p_statuslabelid,
        p_search || null
      ]
    );
    const viewTicket = result.rows[0].fn_get_usersubjectlist;
    return res.status(HTTP.OK).json({
      message: "Ticket list fetched successfully.",
      viewTicket: viewTicket,
    });
  } catch (error) {
    console.error("error in viewAllTicketByUserId:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const openChatByTicketId = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const p_usersupportticketid = req.params.p_usersupportticketid;
    const { p_limit, p_offset } = req.query;

    if (!p_usersupportticketid) {
      return res.status(HTTP.BAD_REQUEST).json({ message: "p_usersupportticketid is required." });
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
        p_limit || 20,
        p_offset || 1
      ]
    );

    const data = result.rows[0].fn_get_usersupportticketmessages;
    io.to(`user_${p_userid}`).emit("sidebarTicketUpdate", {
      ticketId: p_usersupportticketid,
      readbyadmin: true,
      readbyuser: true,
    });
    return res.status(HTTP.OK).json({
      message: "Chat opened successfully for the selected ticket.",
      data: data,
    });
  } catch (error) {
    console.error("error in openChatByTicketId:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getTicketStatus = async (req, res) => {
  try {
    const result = await client.query(
      "SELECT * FROM ins.fn_get_usersupportticketstatus()"
    );

    const status = result.rows;

    return res.status(HTTP.OK).json({
      message: "Successfully retrieved ticket statuses",
      status: status,
    });
  } catch (error) {
    console.error("error in getTicketStatus:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

// const MAX_FILE_UPLOAD = 1; // Max 1 file
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
export const sendSupportMessage = async (req, res) => {
  const userId = req.user?.id || req.body.userId;

  if (!userId) {
    return res.status(HTTP.UNAUTHORIZED).json({
      status: false,
      message: "Unauthorized: user not found",
    });
  }

  try {
    const p_senderid = req.user?.id || req.body.p_senderid;
    const { p_usersupportticketid, p_messages, p_replyid } = req.body;

    if (!p_senderid || !p_usersupportticketid) {
      return res.status(HTTP.BAD_REQUEST).json({
        message: "p_senderid , p_usersupportticketid are required.",
      });
    }

    if (!p_messages && !req.file) {
      return res.status(HTTP.BAD_REQUEST).json({
        message: "Either a p_messages or an attachment is required.",
      });
    }

    const validate = await client.query(
      `select * from ins.fn_get_usersupportticketaccess($1::bigint,$2::bigint);`,
      [p_usersupportticketid, p_senderid]
    );

    const data = validate.rows[0].fn_get_usersupportticketaccess
    if (!data.status) {
      return res.status(HTTP.FORBIDDEN).json({ success: data.status, message: data.message });
    }

    // ----------------- FILE HANDLING -----------------
    let filePaths = [];
    const ticketFolder = `support_chat/ticket_${p_usersupportticketid}/`;

    // // Single file
    if (req.file) {
      const f = req.file;
      const fileName = `${req.user?.role}Id_${p_senderid}_${Date.now()}_${f.originalname
        }`;
        if (f.size > MAX_FILE_SIZE) {
          return res
            .status(HTTP.BAD_REQUEST)
            .json({ message: `File ${f.originalname} exceeds maximum size of 25 MB` });
        }

      const { error } = await supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .upload(`${ticketFolder}${fileName}`, f.buffer, {
          contentType: f.mimetype,
          upsert: false,
        });

      if (error) return res.status(HTTP.INTERNAL_ERROR).json({ message: "File upload failed" });

      const { data: publicUrlData } = supabase.storage
        .from(process.env.SUPABASE_BUCKET)
        .getPublicUrl(`${ticketFolder}${fileName}`);

      filePaths.push(publicUrlData.publicUrl);
    }

    const p_filepath = filePaths.length > 0 ? filePaths[0] : null;
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId)]
    );
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
    await client.query("COMMIT");

    const row = result.rows?.[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;
    const p_messageid = Number(row.p_messageid);
    // ----------------- HANDLE p_status -----------------
    if (p_status === SP_STATUS.SUCCESS) {
      // SOCKET EMIT
      io.to(`ticket_${p_usersupportticketid}`).emit("receiveSupportMessage", {
        ticketId: p_usersupportticketid,
        messageId: p_messageid,
        senderId: p_senderid,
        message: p_messages,
        file: p_filepath,
        replyId: p_replyid ?? null,
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

      return res.status(HTTP.OK).json({
        status: true,
        message: p_message || "Message sent successfully",
        messageId: p_messageid,
        filePaths: p_filepath,
      });
    } else if (p_status === SP_STATUS.VALIDATION_FAIL) {
      return res.status(HTTP.BAD_REQUEST).json({
        status: false,
        message: p_message || "Validation failed",
        filePaths: p_filepath,
      });
    } else if (p_status === SP_STATUS.ERROR) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(HTTP.INTERNAL_ERROR).json({
        status: false,
        message: "Something went wrong. Please try again later.",
      });
    } else {
      return res.status(HTTP.INTERNAL_ERROR).json({
        status: false,
        message: "Unexpected database response",
      });
    }
  } catch (error) {
    console.error("Error in sendSupportMessage:", error);
    return res.status(HTTP.INTERNAL_ERROR).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};