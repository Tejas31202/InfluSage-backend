import { client } from '../config/Db.js';


// export const insertNotification = async (req, res) => {

//     const {
//         p_notificationtypeid,
//         p_senderid,
//         p_receiverid,
//         p_campaignid,
//         p_status,
//         p_message
//     } = req.body;

//     if (!p_notificationtypeid || !p_senderid || !p_receiverid) {

//         return res.status(400).json({ message: "NotificationId and SenderId and ReceiverId Require.." })
//     }
//     try {
//         const Result = await client.query
//             (` call ins.usp_insert_notifications
//             (
//             $1::SMALLINT,
//             $2::bigint,
//             $3::bigint,
//             $4::bigint,
//             $5::boolean,
//             $6::text
//             )`,
//                 [p_notificationtypeid,
//                     p_senderid,
//                     p_receiverid,
//                     p_campaignid,
//                     null,
//                     null
//                 ]
//             )
//         console.log(Result.rows[0]);
//         const { p_status, p_message } = Result.rows[0];
//         if (p_status) {
//             return res.status(200).json({ message: p_message });
//         } else {
//             return res.status(400).json({ message: p_message });
//         }
//         return res.status(200).json({ message: p_message });
//         // io.to(p_receiverid.toString()).emit('new_notification', {
//         //     message: p_message,
//         //     notificationTypeId: p_notificationtypeid,
//         //     campaignId: p_campaignid,
//         //     unreadCount: Number(unreadCount)
//         // });
//     } catch (error) {
//         console.error('Error Create A Notification.')
//         return res.status(500).json({ message: "Internal Server Error" })
//     }
// };

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

