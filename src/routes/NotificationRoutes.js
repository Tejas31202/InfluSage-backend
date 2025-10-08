import express from 'express';
import authenticateUser from '../middleware/AuthMiddleware.js';


const routes = express.Router();


import {
    getallNotification
} from '../controller/NotificationController.js';


routes.get('/getallnotification',authenticateUser(["Vendor","Influencer",]),getallNotification);



export default routes;