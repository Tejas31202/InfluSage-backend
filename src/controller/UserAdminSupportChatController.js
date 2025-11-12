import { client } from "../config/Db.js";
import redis from "redis";

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

export const getSubjectListByRole = async (req, res) => {
  try {
    const roleId = req.user?.role || req.query.roleId;

    if (!roleId) {
      return res.status(400).json({ message: "roleId is required." });
    }

    const result = await client.query(
      `SELECT * from ins.getSubjectListByRole($1::smallint);`,
      [roleId]
    );
    const subjectList = result.rows[0];

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

export const createNewTicket = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { subjectId, priority, status, assign } = req.body;

    const result = await client.query(
      `CALL ins.usp_createticketforinfluandvender(
      $1::bigint,
      $2::bigint,
      $3::varchar,
      $4::varchar,
      $5::bigint,
      $6::boolean,
      $7::varchar
      );`,
      [
        userId,
        subjectId,
        priority || null,
        status || "Open",
        assign || null,
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
    console.error("error in createNewTicket:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const viewAllTicketByUserId = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    if (!userId) {
      return res.status(400).json({ message: "userId is required." });
    }
    const result = await client.query(
      "SELECT * from ins.viewAllTicketByUserId($1::smallint);",
      [userId]
    );
    const viewTicket = result.rows[0];
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

export const changeTicketStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;
    const { ticketID, statusname } = req.body;
    const result = await client.query(
      `CALL ins.usp_changeTicketStatus(
          $1::bigint,
          $2::bigint,
          $3::varchar,
          $4::boolean,
          $5::varchar
         );`,
      [userId, ticketID, statusname || "close"]
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
    console.error("error in changeTicketStatus:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};
