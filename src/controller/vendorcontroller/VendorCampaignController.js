import { client } from "../../config/db.js";
// import authenticateUser from "../../middleware/AuthMiddleware.js";
import redis from 'redis';
 
const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);
 
 
export const createMyCampaign = async(req,res)=>{
     const userId=req.user?.id||req.body.userId
     const {campaignid,objectivejson,vendorinfojson,campaignjson,campaignfilejason,contenttypejson}=req.body
     const redisKey=`createCampaign${userId}`  
 
  try {
     // Fetch existing data from Redis
    let existingData = await redisClient.get(redisKey);
    existingData = existingData ? JSON.parse(existingData) : {};
 
   // Merge new incoming data with existing Redis data
    const mergedData = {
      ...existingData,
      ...(objectivejson && { objectivejson }),
      ...(vendorinfojson && { vendorinfojson }),
      ...(campaignjson && { campaignjson }),
      ...(campaignfilejason && { campaignfilejason }),
      ...(contenttypejson && { contenttypejson }),
      is_completed: false
    };
 
    // Store updated data in Redis (no TTL)
    await redisClient.set(redisKey, JSON.stringify(mergedData));
 
    // Check if all parts are present
    const allPartsPresent =
      mergedData.objectivejson &&
      mergedData.vendorinfojson &&
      mergedData.campaignjson &&
      mergedData.campaignfilejason &&
      mergedData.contenttypejson;
 
      if (!allPartsPresent) {
      return res.status(200).json({
        message: "Partial data stored in Redis",
        source: "redis"
      });
    }
 
  await client.query('BEGIN');
    const result = await client.query(
      `CALL ins.sp_upsert_campaigndetails(
        $1::BIGINT,$2::BIGINT $3::JSON, $4::JSON, $5::JSON, $6::JSON, $7::JSON, $8::BOOLEAN, $9::TEXT)`,
      [
        userId,
        campaignid,
        JSON.stringify(mergedData.objectivejson),
        JSON.stringify(mergedData.vendorinfojson),
        JSON.stringify(mergedData.campaignjson),
        JSON.stringify(mergedData.campaignfilejason),
        JSON.stringify(mergedData.contenttypejson),
        null, // Assuming these are optional
        null // Assuming these are optional
      ]
    );
   
     await client.query('COMMIT');
 
      const { p_status, p_message } = result.rows[0];
      if (p_status) {
          // Clear Redis
        await redisClient.del(redisKey);
        return res.status(200).json({ message: p_message });
      } else {
        return res.status(400).json({ message: p_message });
      }
 
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("complete vendor profile error:", error);
 
      return res.status(500).json({ message: error.message });
    }
  };