import { client } from '../../config/db.js';

import redis from 'redis';

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);


// For All Campaign Details
export const GetAllCampaign = async (req, res) => {
    try {

        // For Converting Data String Into Int Float etc
        const p_providerid = req.query.p_providerid ? parseInt(req.query.p_providerid, 10) : null;
        const p_contenttype = req.query.p_contenttype ? parseInt(req.query.p_contenttype, 10) : null;
        const p_language = req.query.p_language ? parseInt(req.query.p_language, 10) : null;
        const p_maxbudget = req.query.p_maxbudget ? parseFloat(req.query.p_maxbudget) : null;
        const p_minbudget = req.query.p_minbudget ? parseFloat(req.query.p_minbudget) : null;

        console.log('Input params:', { p_providerid, p_contenttype, p_language, p_maxbudget, p_minbudget });

        //Get Data From DB
        const result = await client.query(
            'SELECT ins.fn_get_browsecampaignjson($1, $2::smallint, $3, $4, $5)',
            [p_providerid, p_contenttype, p_language, p_maxbudget, p_minbudget]
        );

            console.log('DB result:', result.rows);

        const data = result.rows[0]?.fn_get_browsecampaignjson;

        if (!data) {
            return res.status(404).json({ message: 'Campaign not found.' });
        }

        return res.status(200).json({
            data,
            source: 'db'
        });

    } catch (error) {
        console.error('Error fetching Camapign Details:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

//For Selected Camapign Details
export const GetCampaignDetails = async (req, res) => {

    try {

        const { campaignId } = req.params;

        const result = await client.query(
            'select * from ins.fn_get_browsecampaigndetailsjson($1)',
            [campaignId]
        );



        //Check From DB Not Found Campaign
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Campaign not found.' });
        }


        const campaignDetails = result.rows[0];

        return res.status(200).json({ data: campaignDetails, source: 'db' });

    } catch (error) {

        console.error('Error fetching campaign details:', error);
        res.status(500).json({ message: 'Internal Server Error' });

    }
}

//For Apply Campaign
export const ApplyNowCampaign = async (req, res) => {

    try {
        const { campaignId } = req.params;
        const {
            amount,
            deliveredDate,
            proposalDescription,
            portfolio,
            installments
        } = req.body;

        // Check Campaign id Exist Or Not
        if (!campaignId) {
            return res.status(400).json({ message: 'Campaign ID is required.' });
        }

        //Check Amount , Date , Description , Portfolio Filled 
        if (!amount || !deliveredDate || !proposalDescription || !portfolio) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }


        // All Data Store In ApplicationData
        const applicationData = {
            campaignId,
            amount,
            deliveredDate,
            proposalDescription,
            portfolio,
            installments: installments || []
        };
        //store data in redis
        const redisKey = `applyCampaign:${campaignId}`;

        // await redisClient.setex(redisKey, JSON.stringify(applicationData));

        //temp working store redis above code not store
        await redisClient.set(redisKey, JSON.stringify(applicationData), {});


        //Save TO DB

        //temaparary after sp create then add here
        // const result = await client.query(
        //     " SP Call Save DB",
        //     [campaignid, JSON.stringify(applicationData)]
        // );

        //for testing when sp created thn remove this
        console.log('Simulating DB save:', campaignId, applicationData);
        // const result = { rowCount: 1 };  // mock success response




        return res.status(200).json({ message: 'Application saved successfully', source: 'db and redis' });


    } catch (error) {
        console.error('Error applying to campaign:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }



}


//For Filter Options this for demo  front end work this
// export const GetFilterPlateform = async (req, res) => {
//     try {
//         const { platform } = req.query;

//         const result = await client.query(
//             'SELECT * FROM ins.fn_get_browsecampaignjson($1, $2, $3, $4, $5)',
//             [null, null, null, null, null]
//         );

//         let campaigns = result.rows;

//         //Filter For Selected Plateform If User Require
//         if (platform) {
//             const allowedPlatforms = ['instagram', 'facebook', 'tiktok', 'youtube'];


//             const platformsToFilter = platform
//                 .split(',')
//                 .map(p => p.trim().toLowerCase());

//             // Validate all platforms
//             const invalidPlatforms = platformsToFilter.filter(p => !allowedPlatforms.includes(p));
//             if (invalidPlatforms.length > 0) {
//                 return res.status(400).json({ message: `Invalid platform(s) specified: ${invalidPlatforms.join(', ')}` });
//             }

//             // Filter campaigns where campaign.platform is in the selected platforms list
//             campaigns = campaigns.filter(c =>
//                 c.platform && platformsToFilter.includes(c.platform.toLowerCase())
//             );
//         }


//         if (campaigns.length === 0) {
//             return res.status(404).json({ message: 'Campaign not found.' });
//         }

//         return res.status(200).json({
//             data: campaigns,
//             source: 'db',
//             filter: platform || 'all'
//         });

//     } catch (error) {
//         console.error('Error fetching filtered campaigns:', error);
//         return res.status(500).json({ message: 'Internal Server Error' });
//     }
// };


export const AppliedCampaign = async (req, res) => {
    try {

        const redisKey = 'appliedCampaigns';

        // Try to get data from Redis
        const cachedData = await redisClient.get(redisKey);

        if (cachedData) {
            // If data found in Redis, parse and return it
            return res.status(200).json({
                data: JSON.parse(cachedData),
                source: 'redis',
            });
        }

        // Data Not Available In Radis Then Fetch From DB
        // const result = await client.query("get data from db sp write here");

        const result = await client.query('CALL SP HERE FOR APPLIED CAMPAIGN ');


        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No applied campaigns found.' });
        }

        // Store The Data In Radis
        await redisClient.set(redisKey, JSON.stringify(result.rows));


        // Return data from DB
        return res.status(200).json({
            data: result.rows,
            source: 'db',
        });
    } catch (error) {
        console.error('Error fetching applied campaigns:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};


export const SaveCampaign = async (req, res) => {

    try {

        const { campaignId, userId } = req.body;

        if (!campaignId || !userId) {
            return res.status(400).json({ message: 'User ID and Campaign ID are required.' });
        }

        //comment (// const CheckCampaign = await client.query(`SELECT * FROM ins.fn_get_savedcampaignjson($1)`, [userid])

        // //Check Campaign Available and also Check If Available Campaign Same or Not
        // const alreadySaved = CheckCampaign.rows.some(
        //     (row) => row.campaignid === campaignid && row.applied === true
        // );

        // if (alreadySaved) {
        //     return res.status(200).json({ message: 'You have already save to this campaign.' });
        // })

        const SaveCampaign = await client.query(`CALL ins.sp_insert_savedcampaign($1::bigint,$2::bigint, $3, $4)`, [userId, campaignId, null, null]);

        return res.status(201).json({
            message: 'Campaign application saved successfully.',
            data: SaveCampaign.rows[0],
            source: 'db'
        });

    } catch (error) {
        console.error('Error saving campaign application:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}

export const GetSaveCampaign = async (req, res) => {

    try {

        const { userId } = req.params;
        if (!userId) {

            return res.status(400).json({ message: "User Id Required." })
        }
        const result = await client.query(`SELECT * FROM ins.fn_get_savedcampaignjson($1)`, [userId])

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Campaign not found.' });
        }


        const savedcampaign = result.rows[0];

        return res.status(200).json({ data: savedcampaign, source: 'db' });

    } catch (error) {
        console.error('Error saving campaign application:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }

}


