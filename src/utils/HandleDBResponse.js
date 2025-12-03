import STATUS from "../utils/MessageStatusMap.js";

export const handleDbResponse = (res, p_status, p_code, p_message, data = null) => {
  
  //  Rule 1: DB returns p_status = false → Always 500
  if (p_status === false) {
    return res.status(STATUS.ERROR).json({
      status: false,
      message: p_message || "Internal server error"
    });
  }

  //  Rule 2: p_status = true → Use p_code mapping
  const statusCode = STATUS[p_code] || STATUS.OK;

  return res.status(statusCode).json({
    status: true,
    message: p_message,
    data: data || null
  });
};
