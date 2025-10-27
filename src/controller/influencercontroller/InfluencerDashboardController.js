import { client } from '../../config/Db.js'

export const getInfluencerDashsboardCountList = async (req, res) => {
  try {
    const p_userid=req.user?.id||req.body.p_userid;
    const result = await client.query("SELECT * FROM ins.fn_get_influencerdashboard($1::bigint);",[p_userid]);

    const countList = result.rows[0].fn_get_influencerdashboard;

    return res.status(200).json({
      message: "Fetched getInfluencerDesboardCountList.",
      data: countList,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getInfluencerDesboardCountList:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getInfluencerProfileCompletionPercentage = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.body.p_userid;
    const result = await client.query("SELECT * FROM ins.fn_complete_influencerprofilepercentage($1::bigint);",[p_userid]);

    const percentage = result.rows[0].fn_complete_influencerprofilepercentage;

    return res.status(200).json({
      message: "Profile completion percentage fetched successfully.",
      percentage: percentage,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getInfluencerProfileCompletionPercentage:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getAllToDoList = async (req, res) => {
  try {
    const userId=req.user?.id||req.body.userId;
    const result = await client.query("SELECT * FROM ins.fn_get_influencer_todolist();",[userId]);

    const todoList = result.rows;

    return res.status(200).json({
      message: "Fetched getAllToDoList.",
      data: todoList,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getAllToDoList:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

export const getSingleToDo = async (req, res) => {
  try {
    const userId=req.user?.id||req.body.userId;
    const todoId=req.body.todoId
    const result = await client.query("SELECT * FROM ins.fn_get_influencer_todo($1::smallint,$2::smallint);",[userId,todoId]);

    const todo = result.rows;

    return res.status(200).json({
      message: "Fetched getSingleToDo.",
      data: todo,
      source: "db",
    });
  } catch (error) {
    console.error("Error in getSingleToDo:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

export const deleteSingleToDo = async (req, res) => {
  try {
    const userId=req.user?.id||req.body.userId;
    const todoId=req.body.todoId
    const result = await client.query("delete * FROM ins.fn_get_influencer_todo($1::smallint,$2::smallint);",[userId,todoId]);

    const {p_status,p_message} = result.rows;

    if (p_status) {
      return res
        .status(200)
        .json({ message: p_message,source: "db" });
    } else {
      return res.status(400).json({ message: p_message, p_status });
    }

  } catch (error) {
    console.error("Error in getSingleToDo:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

export const insertOrEditToDO = async (req,res) =>{
 try {
    const userId=req.user?.id||req.body.userId;
    const todoId=req.body.todoId||null;
    const {title,date}=req.body;
    const result = await client.query("call ins.fn_get_influencer_todo($1::smallint,$2::smallint);",[userId,todoId,title,date]);

    const {p_status,p_message} = result.rows;

    if (p_status) {
      return res
        .status(200)
        .json({ message: p_message,source: "db" });
    } else {
      return res.status(400).json({ message: p_message, p_status });
    }

  } catch (error) {
    console.error("Error in getSingleToDo:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}