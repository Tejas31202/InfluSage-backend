import { client } from '../../config/Db.js';

export const getAllSelectedInfluencer = async (req, res) => {
  const vendor_id = req.user?.id;
  const { campaign_id } = req.query;

  if (!campaign_id || !vendor_id) {
    return res.status(400).json({
      message: "campaign_id and vendor_id are required",
    });
  }
  try {
    const selectedInfluencer = await client.query(
      `select * from ins.fn_get_selectedinfluencers($1::bigint,$2::bigint)`,
      [campaign_id, vendor_id]
    );

    if (selectedInfluencer.rows.length === 0) {
      return res.status(404).json({ message: "Selected Influencer Not Found" });
    }

    const Result = selectedInfluencer.rows[0].fn_get_selectedinfluencers;

    return res.status(200).json({
      message: "Selected influencers retrieved successfully.",
      data: Result,
      source: "db",
    });
  } catch (error) {
    console.error("error in getAllSelectedInfluencer", error);
    return res.status(500).json({
      error: error.message,
    });
  }
};

export const createOrEditContract = async (req, res) => {
  try {
    const {
      p_campaignapplicationid,
      p_contractid,
      p_contractjson,
      p_contenttypejson,
    } = req.body;

    if (!p_campaignapplicationid) {
      return res.status(400).json({
        message: "p_campaignapplicationid is required.",
      });
    }
    if (!p_contractjson || !p_contenttypejson) {
      return res.status(400).json({
        message: "p_contractjson and p_contenttypejson are required.",
      });
    }
    const result = await client.query(
      `CALL ins.usp_upsert_contractdetails(
      $1::bigint,
      $2::bigint,
      $3::json,
      $4::json,
      $5::boolean,
      $6::text
      );`,
      [
        p_campaignapplicationid,
        p_contractid || null,
        JSON.stringify(p_contractjson),
        JSON.stringify(p_contenttypejson),
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
    console.error("error in createOrEditContract:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};

export const getContractDetailByContractId = async (req,res)=>{
     try {
    const p_userid = req.user?.id || req.query.p_userid;
    const p_contractid =req.params.p_contractid ;

    if (!p_userid||!p_contractid) {
      return res.status(400).json({ message: "p_userid and p_contractid are required." });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_contractdetails($1::bigint,$2::bigint);`,
      [p_contractid,p_userid]
    );
    const data = result.rows[0].fn_get_contractdetails;

    return res.status(200).json({
      message: "contract detail fetched successfully",
      data: data,
    });
  } catch (error) {
    console.error("error in getSubjectListByRole:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
}

export const influencerApproveOrRejectContract = async (req, res) => {
  try {
    const p_influencerid = req.user?.id || req.body.p_influencerid;
    const { p_contractid, p_statusname } = req.body;

    if (!p_influencerid) {
      return res.status(400).json({ message: "p_influencerid is required" });
    }

    if (!p_contractid || !p_statusname) {
      return res
        .status(400)
        .json({ message: "p_contractid and p_statusname are required" });
    }

    const result = await client.query(
      `CALL ins.usp_update_contractstatus(
      $1::bigint,
      $2::bigint,
      $3::varchar(15),
      $4::boolean,
      $5::text
      );`,
      [p_influencerid, p_contractid, p_statusname, null, null]
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
    console.error("error in createOrEditContract:", error);
    return res.status(500).json({
      message: error.message,
    });
  }
};