import { client } from '../../config/Db.js';

export const influencerApproveOrRejectContract = async (req, res) => {
  const userId = req.user?.id || req.body.userId;

  if (!userId) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized: user not found",
    });
  }
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

    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [String(userId)]
    );
    const result = await client.query(
      `CALL ins.usp_update_contractstatus(
      $1::bigint,
      $2::bigint,
      $3::varchar(15),
      $4::smallint,
      $5::text
      );`,
      [p_influencerid, p_contractid, p_statusname, null, null]
    );
    await client.query("COMMIT");

    const row = result.rows?.[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;

    // ----------------- HANDLE p_status -----------------
    if (p_status === 1) {
      return res.status(200).json({
        message: p_message,
        p_status,
      });
    }
    else if (p_status === 0) {
      return res.status(400).json({
        message: p_message || "Validation failed",
        p_status,
      });
    }
    else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        message: "Something went wrong. Please try again later.",
        p_status: false,
      });
    }
    else {
      return res.status(500).json({
        message: "Unexpected database response",
        p_status: false,
      });
    }
  } catch (error) {
    console.error("error in influencerApproveOrRejectContract:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const uploadContentLink = async (req, res) => {
  const userId = req.user?.id || req.body.userId;
  if (!userId) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized: user not found",
    });
  }
  try {
    const p_influencerid = req.user?.id || req.body.p_influencerid;
    const { p_contractid, p_contentlinkjson } = req.body;

    if (!p_influencerid) {
      return res.status(400).json({ message: "p_influencerid is required" });
    }

    if (!p_contentlinkjson) {
      return res
        .status(400)
        .json({ message: "p_contractid and p_contentlinkjson are required" });
    }

    await client.query("BEGIN");
    await client.query(
          "SELECT set_config('app.current_user_id', $1, true)",
          [String(userId)]
        );
    const result = await client.query(
      `CALL ins.usp_upsert_contentlink(
      $1::bigint,
      $2::bigint,
      $3::json,
      $4::smallint,
      $5::text
      );`,
      [
        p_influencerid,
        p_contractid,
        JSON.stringify(p_contentlinkjson),
        null,
        null,
      ]
    );
    await client.query("COMMIT");

    const row = result.rows[0] || {};
    const p_status = Number(row.p_status);
    const p_message = row.p_message;  

    if (p_status === 1) {
      return res.status(200).json({
        status: true,
        message: p_message || "Content link uploaded successfully",
      });
    } else if (p_status ===0 ) {
      return res.status(400).json({
        status: false,
        message: p_message || "Failed to upload content link",
        
      });
    }
    else if (p_status === -1) {
      console.error("Stored Procedure Failure:", p_message);
      return res.status(500).json({
        status: false,
        message: "Something went wrong. Please try again later.",
      });
    }
    else {
      return res.status(500).json({
        status: false,
        message: p_message || "Unexpected database response",
      });
    }
  } catch (error) {
    console.error("error in uploadContentLink:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getInfluencerContractDetail = async (req, res) => {
  try {
    const p_influencerid = req.user?.id || req.query.p_influencerid;
    const p_campaignid = req.params.p_campaignid;
    if (!p_influencerid) {
      return res
        .status(400)
        .json({ message: "p_influencerid is required." });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_influencercontractdetails(
        $1::bigint,
        $2::bigint);`,
      [p_influencerid, p_campaignid]
    );

    const data = result.rows[0]?.fn_get_influencercontractdetails;
    if (data) {
      return res.status(200).json({
        message: "contract detail fetched successfully",
        data: data[0],
      });
    }
    return res.status(200).json({
      message: "No Contract Created",
      data: data,
    });
  } catch (error) {
    console.error("error in getInfluencerContractDetail:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};

export const getInfluencerUploadedContentLink = async (req, res) => {
  try {
    const p_influencerid = req.user?.id || req.query.p_influencerid;
    const p_campaignid = req.params.p_campaignid;
    if (!p_influencerid) {
      return res
        .status(400)
        .json({ message: "p_influencerid is required." });
    }

    const result = await client.query(
      `SELECT * FROM ins.fn_get_influencercontentlink(
        $1::bigint,
        $2::bigint);`,
      [p_influencerid, p_campaignid]
    );

    const data = result.rows[0].fn_get_influencercontentlink;
    return res.status(200).json({
      message: "content links fetched successfully",
      data: data,
    });
  } catch (error) {
    console.error("error in getInfluencerUploadedContentLink:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
}

export const getContractContentTypes = async (req, res) => {
  const { p_contractid  } = req.params;
   const p_influencerid  = req.user?.id || req.query.p_influencerid;
  if (!p_influencerid ) {
    return res.status(400).json({ error: "influencerId is required" });
  }

  try {
    const contractContentTypes = await client.query(`
        select  * from ins.fn_get_contractcontenttype($1::bigint,$2::bigint)`,
      [p_contractid, p_influencerid ]
    )
    const responseData = contractContentTypes.rows[0].fn_get_contractcontenttype[0];
    return res.status(200).json(responseData);
    
  } catch (error) {
    console.error("Error fetching contract content types:", error);
    return res.status(500).json({
      message: "Something went wrong. Please try again later.",
      error: error.message,
    });
  }
};
