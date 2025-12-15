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

export const getVendorCampaignOverview = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const result = await client.query(
      "select * from ins.getVendorCampaignOverview($1::bigint);",
      [p_userid]
    );
    //this function return campaignname,platforms,views,engagement,status 
    const data = result.rows[0];
    return res.status(200).json({
      message: "Campaign overview retrieved successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getVendorCampaignOverview:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getPerformanceTimeline = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    
    const p_filtertype =req.query.p_filtertype;
    
    if(!p_filtertype){
      res.status(400).json({message:"p_filtertype is required"})
    }
      // Allow only week / month / year
    const allowedFilters = ["week", "month", "year"];
    if (!p_filtertype || !allowedFilters.includes(p_filtertype)) {
      return res.status(400).json({
        message: "Invalid p_filtertype. Allowed values: week, month, year"
      });
    }
  
    const result = await client.query(
      "SELECT ins.fn_get_vendorperformanceovertime($1::bigint,$2::varchar(55));",
      [p_userid,p_filtertype ]
    );

    const data = result.rows[0].fn_get_vendorperformanceovertime;
   
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

export const getTopPerformingContent = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const p_filtertype=req.query.p_filtertype;

    if(!p_filtertype){
      res.status(400).json({message:"p_filtertype is required"})
    }
      // Allow only week / month / year
    const allowedFilters = ["week", "month", "year"];
    if (!p_filtertype || !allowedFilters.includes(p_filtertype)) {
      return res.status(400).json({
        message: "Invalid p_filtertype. Allowed values: week, month, year"
      });
    }
    const result = await client.query(
      "select * from ins.fn_get_vendortopperformingcontent($1::bigint,$2::varchar(15));",
      [p_userid,p_filtertype ]
    );
    
    const data = result.rows[0].fn_get_vendortopperformingcontent;

    return res.status(200).json({
      message: "Top-performing content fetched successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getTopPerformingContent:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getPlatformBreakdown = async (req, res) => {
  try {
    const p_userid = req.user?.id || req.query.p_userid;
    const { p_year, p_month } = req.query;
    if(!p_year){
      res.status(400).json({message:"p_year is required"})
    }
    const result = await client.query(
      " SELECT  * from ins.fn_get_vendorplatformbreakdown($1::bigint,$2::integer,$3::integer);",
      [
        p_userid,
        p_year, 
        p_month || null
      ]
    );
    const data = result.rows[0].fn_get_vendorplatformbreakdown;
    return res.status(200).json({
      message: "Platform breakdown data fetched successfully.",
      data: data,
    });
  } catch (error) {
    console.error("error in getPlatformBreakdown:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};
