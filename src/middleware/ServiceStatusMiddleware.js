import { getAppStatus } from "../service/ConfigServiceStatus.js";

export const serviceStatusMiddleware = async (req, res, next) => {
  try {
    const status = await getAppStatus();

    if (status === "off") {
      return res.status(200).json({
        message: "Influsage service temporarily unavailable. Please try again later.",
        status:false
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};