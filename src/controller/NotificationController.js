import { client } from '../config/Db.js';



//..................Get All Notification List............................
export const getallNotification = async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(400).json({ message: 'user Id Required' });
    }
    try {
        const notification = await client.query(
            `select * from ins.fn_get_notificationlist
            ($1::bigint)`,
            [userId]
        );
        const result = notification.rows[0]?.fn_get_notificationlist;
        if (!result || result.length === 0) {
            return res.status(404).json({ message: 'No notifications found.' });
        }
        return res.status(200).json({
            message: 'Notification Fetched Sucessfully',
            data: result
        })
    } catch (error) {
        console.error('Error While Fetching Notification')
        return res.status(500).json({ message: 'Internal Server Error' })
    }
};

