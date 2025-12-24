import { client } from '../config/Db.js';

export const getAllNotification = async (req, res) => {
  const userId = req.user?.id;
  const limitedData = req.query?.limitedData;
  const p_role = "RECEIVER";
  if (!userId) {
    return res.status(400).json({ message: "user Id Required" });
  }

  const limitedFlag =
    limitedData === "true" ? true : limitedData === "false" ? false : null;

  try {
    const notification = await client.query(
      `select * from ins.fn_get_notificationlist
            ($1::bigint,$2::boolean,$3::text)`,
      [userId, limitedFlag, p_role]
    );
    const result = notification.rows[0]?.fn_get_notificationlist || [];
    return res.status(200).json({
      message:
        result.length > 0
          ? "Notifications fetched successfully"
          : "No notifications found",
      data: result,
    });
  } catch (error) {
    console.error("Error While Fetching Notification:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

