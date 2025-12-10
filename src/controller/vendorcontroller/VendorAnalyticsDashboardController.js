import { client } from "../../config/Db.js";

export const getVendorAnalyticsSummary = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const result = await client.query(
      "SELECT * FROM ins.fn_get_vendoranalytic($1::bigint);",
      [p_userid]
    );
  
    const data = result.rows[0].fn_get_vendoranalytic;
    return res.status(200).json({
      message: "Analytics summary retrieved successfully",
      data: data,
    });
  } catch (error) {
    console.error("error in getVendorAnalyticsSummary:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getPerformanceTimeline = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const labalid=req.query.labalid;
    const result = await client.query(
      "select * from ins.getPerformanceTimeline($1::bigint,$2::smallint);",
      [p_userid,labalid]
    );
    //this function return views,likes,comments,count base on filter like weekly/monthly/yearly
    const data = result.rows[0];
    return res.status(200).json({
      message: "Performance data over time retrieved successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getPerformanceTimeline:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getGraphFiltersDropdown=async (req, res) => {
  try {
    const result = await client.query(
      "select * from ins.getGraphFiltersDropdown();");
    //this function return filter list:-monthly,weekly,yearly
    const data = result.rows[0];
    return res.status(200).json({
      message: "Graph filter dropdown data fetched successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getGraphFiltersDropdown:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

