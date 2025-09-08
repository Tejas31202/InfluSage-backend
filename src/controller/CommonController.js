import { client } from "../config/db.js";

export const getRoles = async (req, res) => {
  try {
    const result = await client.query(`SELECT * FROM ins.get_roles()`);

    // rows array aayega roles ka
    return res.status(200).json({
      status: true,
      message: "Roles fetched successfully",
      data: result.rows,
    });
  } catch (error) {
    console.error("❌ Error fetching roles:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

export const getContentTypes=async(req,res)=>{

    try {
    const result = await client.query(
      "SELECT * from ins.fn_get_contenttypes();"
    );

    return res.status(200).json({
      contentType: result.rows,
      source: "db",
    });
  } catch (error) {
    console.error("Error fetching GetCampaignObjectives:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch GetCampaignObjectives" });
  }
}

