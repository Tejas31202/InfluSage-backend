import { client } from '../../config/Db.js';

//...........ClientList.....................
export const getClientsList = async (req, res) => {

    const p_userid = req.user?.id;

    try {

        if (!p_userid) {
            return res.status(400).json({ message: 'User Id Require' })
        }

        const result = await client.query(
            `SELECT * FROM ins.fn_get_clients($1::BIGINT)`,
            [p_userid]
        )

        if (!result || result.rows.length === 0) {
            return res.status(404).json({ message: 'No Client Found' })
        }

        const clientList = result.rows[0].fn_get_clients[0];

        return res.status(200).json({
            message: 'clientList Fetched Successfully',
            data: clientList,
            source: 'db'
        }
        );

    } catch (error) {
        console.log('Error While Fetching clientList', error);
        return res.status(500).json({ message: 'Internal server Error' });
    }
};
//..................Get All Influencer Campaign..................
export const getInfluencerMyCampaign = async (req, res) => {

    const p_userid = req.user?.id;

    console.log(p_userid)

    try {

        if (!p_userid) {

            return res.status(400).json({ message: 'User Id Require' })
        }

        const {

            p_statuslabelid,
            p_providers,
            p_clients,
            p_status,
            p_maxbudget,
            p_minbudget,
            p_startdate,
            p_enddate,
            p_sortby,
            p_sortorder,
            p_pagenumber,
            p_pagesize,
            p_search

        } = req.query;

        const result = await client.query(
            `SELECT * FROM ins.fn_get_influencermycampaign(
            $1::bigint,
            $2::smallint,
            $3::json,
            $4::json,
            $5::json,
            $6::numeric,
            $7::numeric,
            $8::date,
            $9::date,
            $10::text,
            $11::text,
            $12::integer,
            $13::integer,
            $14::text)`,
            [
                p_userid,
                p_statuslabelid || null,
                p_providers || null,
                p_clients || null,
                p_status || null,
                p_maxbudget || null,
                p_minbudget || null,
                p_startdate || null,
                p_enddate || null,
                p_sortby || null,
                p_sortorder || 'DESC',
                p_pagenumber || 1,
                p_pagesize || 20,
                p_search || null
            ]
        )

        const influencerCampaign = result.rows[0].fn_get_influencermycampaign;

        return res.status(200).json({
            message: 'Influencer campaigns fetched successfully',
            data: influencerCampaign,
            source: 'db'
        })

    } catch (error) {
        console.log('Error Getting Influencer My Campaign', error);
        return res.status(500).json({ message: 'Internal server Error' });
    }
};
//.............Get SingleInfluencer Campaign.........................
export const getInfluencerMyCampaignDetails = async (req, res) => {

    const p_userid = req.user?.id || req.body.p_userid;

    const p_campaignid = req.params.p_campaignid;
    try {

        if (!p_userid || !p_campaignid) {
            return res.status(400).json({ message: 'User Id And Campaign Id are Require' })
        }

        const result = await client.query(
            `SELECT * FROM ins.fn_get_influencermycampaigndetails(
        $1::BIGINT,
        $2::BIGINT
        )`,
            [p_userid, p_campaignid]
        );

        if (!result || result.rows.length === 0) {
            return res.status(404).json({ message: 'Campaign Not Found' })
        }

        const influencerCampaign = result.rows[0].fn_get_influencermycampaigndetails[0];

        return res.status(200).json
            ({
                message: 'Campaign Fetched Successfully',
                data: influencerCampaign,
                source: 'db'
            });

    } catch (error) {
        console.log('Error Getting Influencer Details', error);
        return res.status(500).json({ message: 'Internal server Error' });
    }
};



