import { client } from "../config/Db.js";
import redis from "redis";

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
    const p_userid  = req.user?.id || req.body.p_userid ;

    const {p_usersupportticketid ,p_objectiveid, p_statusname} = req.body;

    if (!p_userid) {
      return res.status(400).json({
        message: "p_userid is required.",
      });
    }
    if (!p_objectiveid&&!p_statusname) {
      return res.status(400).json({
        message: "p_objectiveid and p_statusname are required.",
      });
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
        p_usersupportticketid||null,
        p_objectiveid||null,
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

export const openChatByTicketIdForUser = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const ticketID = req.body.ticketID;

    const result = await client.query(
      `SELECT * from ins.openChatByTicketIdForUser(
      $1::smallint,
      $2::smallint
      );`,
      [userId, ticketID]
    );
    const data = result.rows[0];
    return res.status(200).json({
      message: "Chat opened successfully for the selected ticket.",
      data: data,
    });
  } catch (error) {
    console.error("error in openChatByTicketIdForUser:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

// export const changeTicketStatus = async (req, res) => {
//   try {
//     const userId = req.user?.id || req.body.userId;
//     const { ticketID, statusname } = req.body;
//     const result = await client.query(
//       `CALL ins.usp_changeTicketStatus(
//           $1::bigint,
//           $2::bigint,
//           $3::varchar,
//           $4::boolean,
//           $5::varchar
//          );`,
//       [userId, ticketID, statusname || "close"]
//     );
//     const { p_status, p_message } = result.rows[0];
//     if (p_status) {
//       return res.status(200).json({
//         message: p_message,
//         p_status,
//       });
//     } else {
//       return res.status(400).json({ message: p_message, p_status });
//     }
//   } catch (error) {
//     console.error("error in changeTicketStatus:", error);
//     return res.status(500).json({
//       message: error.message,
//     });
//   }
// };

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

// export const claimTicketByAdmin = async (req, res) => {
//   try {
//     const adminId = req.user?.id || req.body.adminId;
//     const ticketId = req.body.tikcketId;

//     if (!adminId) {
//       return res.status(400).json({
//         message: "adminId is required.",
//       });
//     }
//     if (!ticketId) {
//       return res.status(400).json({
//         message: "tikcketId is required.",
//       });
//     }

//     const result = await client.query(
//       `CALL ins.usp_changeTicketStatus(
//           $1::bigint,
//           $2::bigint,
//           $3::boolean,
//           $4::varchar
//          );`,
//       [adminId, ticketId, null, null]
//     );
//     const { p_status, p_message } = result.rows[0];
//     if (p_status) {
//       return res.status(200).json({
//         message: p_message,
//         p_status,
//       });
//     } else {
//       return res.status(400).json({ message: p_message, p_status });
//     }
//   } catch (error) {
//     console.error("error in claimTicketByAdmin:", error);
//     return res.status(500).json({
//       message: error.message,
//     });
//   }
// };

export const openChatByTicketIdForAdmin = async (req, res) => {
  try {
    const adminId = req.user?.id || req.body.adminId;
    const ticketId = req.body.ticketId;

    if (!adminId) {
      return res.status(400).json({ message: "adminId is required." });
    }
    if (!ticketId) {
      return res.status(400).json({ message: "ticketId is required." });
    }

    const result = await client.query(
      `SELECT * FROM ins.openChatByTicketIdForAdmin(
        $1::bigint,
        $2::bigint,
        $3::boolean,
        $4::varchar
      );`,
      [adminId, ticketId, null, null]
    );

    const data = result.rows[0];

    return res.status(200).json({
      message: "Chat opened successfully for the claimed ticket.",
      data: data,
    });
  } catch (error) {
    console.error("error in openChatByTicketIdForAdmin:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

// export const resolveTicketByAdmin = async (req, res) => {
//   try {
//     const adminId = req.user?.id||req.body.adminId;

//     const { ticketId } = req.body;
//       if (!adminId) {
//       return res.status(400).json({ message: "adminId is required." });
//     }
//     if (!ticketId) {
//       return res.status(400).json({ message: "ticketId is required." });
//     }
//     const result = await client.query(
//       "CALL ins.usp_resolveTicket($1::bigint,$2::bigint)",
//       [adminId, ticketId,null,null]
//     );
//    const { p_status, p_message } = result.rows[0];
//     if (p_status) {
//       return res.status(200).json({
//         message: p_message,
//         p_status,
//       });
//     } else {
//       return res.status(400).json({ message: p_message, p_status });
//     }
//   } catch (error) {
//     console.error("Error in resolveTicketByAdmin:", error);
//     return res.status(500).json({ message: error.message });
//   }
// };

export const supportMessageSend = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { tikcketId, p_roleid, p_messages } = req.body;
    let p_filepaths = null;

    // ✅ Validation
    if (!userId || !tikcketId || !p_roleid) {
      return res.status(400).json({
        message: "userId, tikcketId, and p_roleid are required.",
      });
    }

    // ✅ Map role id → string (for folder naming)
    const roleName =
      Number(p_roleid) === 1
        ? "influencer"
        : Number(p_roleid) === 2
        ? "vendor"
        : Number(p_roleid) === 4
        ? "admin"
        : "unknown";

    // ✅ Handle single file upload (if exists)
    if (req.file) {
      const file = req.file;
      const folderPath = `support_chat/ticket_${tikcketId}/`;
      const timestamp = Date.now();
      const fileName = `${roleName}Id_${userId}_${timestamp}_${file.originalname}`;

      // Upload to Supabase
      const { data, error } = await supabase.storage
        .from("uploads")
        .upload(`${folderPath}${fileName}`, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        console.error("Supabase upload error:", error);
        return res.status(500).json({ message: "File upload failed." });
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("uploads")
        .getPublicUrl(`${folderPath}${fileName}`);

      p_filepaths = publicUrlData.publicUrl;
    }

    //Insert message into DB (stored procedure)
    const result = await client.query(
      `
      CALL ins.usp_upsert_message(
        $1::bigint,
        $2::bigint,
        $3::smallint,
        $4::text,
        $5::text,
        $6::boolean,
        $7::text
      )
      `,
      [
        userId,
        tikcketId,
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
        fileUrls: uploadedFiles,
        p_status,
      });
    } else {
      return res.status(400).json({
        message: p_message,
        p_status,
      });
    }
  } catch (error) {
    console.error("Error in supportMessageSend:", error);
    return res.status(500).json({ message: error.message });
  }
};