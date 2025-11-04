import { client } from '../../config/Db.js';



export const getVendorCompleteProfilePercentage = async (req, res) => {
    try {
        const p_userid = req.user?.id || req.body.p_userid;

        if (!p_userid) {
            return res.status(400).json({
                message: "User ID is required to fetch profile completion percentage.",
            });
        }

        const result = await client.query(
            "SELECT * FROM ins.fn_complete_vendorprofilepercentage($1::bigint)",
            [p_userid]
        );

        console.log("result==>", result)

        if (result.rowCount === 0 || !result.rows[0]) {
            return res.status(404).json({
                message: "No data found for the given user.",
            });
        }

        const percentage = result.rows[0].fn_complete_vendorprofilepercentage;
        return res.status(200).json({
            message: "Profile completion percentage fetched successfully.",
            percentage: percentage,
            source: "db",
        });
    } catch (error) {
        console.error("Error in getVendorProfileCompletionPercentage:", error);
        return res.status(500).json({
            message: error.message,
        });
    }
};


