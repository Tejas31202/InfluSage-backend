import { client } from '../config/Db.js';
import bcrypt from 'bcrypt';

export const changePassword = async (req, res) => {
  try {
    const p_userid = req.user?.id;
    const email = req.user?.email;
    if (!p_userid || !email) {
      return res
        .status(400)
        .json({ message: "p_userid and email are required" });
    }

    const { oldPassword, newPassword, confirmPassword } = req.body || {};
    if (!oldPassword || !newPassword || !confirmPassword) {
      res.status(400).json({
        message: "oldPassword,newPassword,confirmPassword are requied.",
      });
    }
    // Fetch existing password hash
    const userResult = await client.query(
      "SELECT passwordhash FROM ins.fn_get_loginpassword($1::VARCHAR);",
      [email]
    );
    const dbPasswordHash = userResult.rows[0].passwordhash;


    // Compare old password
    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      dbPasswordHash
    );
    if (!isOldPasswordValid) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from your current password",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New password and confirm password do not match",
      });
    }

    //  Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    const result = await client.query(
      `CALL ins.usp_change_userpassword(
      $1::bigint,
      $2::varchar,
      $3::varchar,
      $4::smallint,
      $5::text
    );`,
      [p_userid, dbPasswordHash, newPasswordHash, null, null]
    );

    const { p_status, p_message } = result.rows[0];
    if (p_status === 1) {
      return res.status(200).json({
        status: true,
        message: p_message,
        source: "db",
      });
    } else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message,
        source: "db",
      });
    }
    // Case 3: p_status = -1 → SP failed
    else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        status: false,
        message: "Something went wrong. Please try again later.",
      });
    } else {
      return res.status(500).json({
        status: false,
        message: p_message || "Unexpected database response",
      });
    }
  } catch (error) {
    console.error("Error in changePassword:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getdeleteAccountReason = async (req, res) => {
  const p_userid = req.user.id;
  if (!p_userid) return res.status(400).json({ Message: "User Id Required For get Delete Reasons." })
  try {
    const delAccountReason = await client.query(`select * from ins.fn_get_deleteaccountreasons()`);
    const reasonRes = delAccountReason.rows;
    return res.status(200).json({ Message: "Sucessfully get reason for del account.", data: reasonRes })
  } catch (error) {
    console.log("Error in Getting Delete Account Reason", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}

export const deleteAccount = async (req, res) => {
  const p_userid = req.user?.id || req.query.p_userid;
  if (!p_userid) return res.status(400).json({ message: "User Id Required For Delete Account" });
  try {
    const delAccount = await client.query(
      `CALL ins.usp_delete_user($1::BIGINT,$2::SMALLINT,$3::TEXT)`,
      [p_userid, null, null]
    );
    const { p_status, p_message } = delAccount.rows[0];
    if (p_status === 1) {
      return res.status(200).json({
        status: true,
        message: p_message,
        source: "db",
      });
    } else if (p_status === 0) {
      return res.status(400).json({
        status: false,
        message: p_message,
        source: "db",
      });
    }
    // Case 3: p_status = -1 → SP failed
    else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        status: false,
        message: "Something went wrong. Please try again later.",
      });
    } else {
      return res.status(500).json({
        status: false,
        message: p_message || "Unexpected database response",
      });
    }
  } catch (error) {
    console.error("Error in changePassword:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
