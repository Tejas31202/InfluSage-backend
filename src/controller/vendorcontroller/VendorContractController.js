import { client } from '../../config/Db.js';

export const getAllSelectedInfluencer = async (req, res) => {
    const vendor_id = req.user?.id
    const { campaign_id } = req.query;

    if (!campaign_id || !vendor_id) {
        return res.status(400).json({
            error: "campaign_id and vendor_id are required",
        });
    }
    try {
        const selectedInfluencer = await client.query(`select * from ins.fn_get_selectedinfluencers($1::bigint,$2::bigint)`,
            [campaign_id, vendor_id]);

        if (selectedInfluencer.rows.length === 0) {
            return res.status(404).json({ message: "Selected Influencer Not Found" });
        }

        const Result = selectedInfluencer.rows[0].fn_get_selectedinfluencers;

        return res.status(200).json({
            message: "Selected Influencer Successfully get",
            data: Result,
            source: "db"
        })



    } catch (error) {
        console.error("Selected Influencer Not Get", error);
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message
        });
    }

}