import { client } from '../../config/db.js';

import redis from 'redis';

const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

console.log("Campaign Controlle Called")
// For All Campaign Details
export const GetAllCampaign = async (req, res) => {
    console.log("get function call")
    try {
        //Get Data From DB
        const result = await client.query(
            'SELECT * FROM ins.fn_get_browsecampaignjson($1, $2, $3, $4, $5)',
            [null, null, null, null, null]
        );

        //Check For SP Send Data OR Not
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Campaign not found.' });
        }
        return res.status(200).json({
            data: result.rows,
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

        const { campaignid } = req.params;

        const result = await client.query(
            'SELECT * FROM ins.fn_get_campaignnumber($1)',
            [campaignid]
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
        const { campaignid } = req.params;
        const {
            amount,
            deliveredDate,
            proposalDescription,
            portfolio,
            installments
        } = req.body;

        // Check Campaign id Exist Or Not
        if (!campaignid) {
            return res.status(400).json({ message: 'Campaign ID is required.' });
        }

        //Check Amount , Date , Description , Portfolio Filled 
        if (!amount || !deliveredDate || !proposalDescription || !portfolio) {
            return res.status(400).json({ message: 'Missing required fields.' });
        }


        // All Data Store In ApplicationData
        const applicationData = {
            campaignid,
            amount,
            deliveredDate,
            proposalDescription,
            portfolio,
            installments: installments || []
        };


        //store data in redis
        const redisKey = `applyCampaign:${campaignid}`;

        // await redisClient.setex(redisKey, JSON.stringify(applicationData));

        //temp working store redis above code not store
        await redisClient.set(redisKey, JSON.stringify(applicationData), {});


        //Save TO DB

        //temaparary after sp create then add here
        // const result = await client.query(
        //     " SP Call Save DB",
        //     [campaignid, JSON.stringify(applicationData)]
        // );

        //for testing 
        console.log('Simulating DB save:', campaignid, applicationData);
        const result = { rowCount: 1 };  // mock success response




        return res.status(200).json({ message: 'Application saved successfully', source: 'db and redis' });


    } catch (error) {
        console.error('Error applying to campaign:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }



}


//For Filter Options
export const GetFilterPlateform = async (req, res) => {
    try {
        const { platform } = req.query;

        const result = await client.query(
            'SELECT * FROM ins.fn_get_browsecampaignjson($1, $2, $3, $4, $5)',
            [null, null, null, null, null]
        );

        let campaigns = result.rows;

        //Filter For Selected Plateform If User Require
        if (platform) {
            const allowedPlatforms = ['instagram', 'facebook', 'tiktok', 'youtube'];


            const platformsToFilter = platform
                .split(',')
                .map(p => p.trim().toLowerCase());

            // Validate all platforms
            const invalidPlatforms = platformsToFilter.filter(p => !allowedPlatforms.includes(p));
            if (invalidPlatforms.length > 0) {
                return res.status(400).json({ message: `Invalid platform(s) specified: ${invalidPlatforms.join(', ')}` });
            }

            // Filter campaigns where campaign.platform is in the selected platforms list
            campaigns = campaigns.filter(c =>
                c.platform && platformsToFilter.includes(c.platform.toLowerCase())
            );
        }


        if (campaigns.length === 0) {
            return res.status(404).json({ message: 'Campaign not found.' });
        }

        return res.status(200).json({
            data: campaigns,
            source: 'db',
            filter: platform || 'all'
        });

    } catch (error) {
        console.error('Error fetching filtered campaigns:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
};


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

    const result = await client.query('SELECT * FROM ins.fn_get_applied_campaigns()');


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



