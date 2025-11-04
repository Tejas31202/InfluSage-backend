
import express from 'express';
const routes = express.Router();
import { 
    getUserStatusList,
    getCampaignStatusList,
    getDashboardCountList,
    getRequestedUserList,
    getRequestedCampaignList,
    insertApprovedOrRejectedApplication,
    getUserDetails
} from '../controller/AdminPanelController.js';
import authenticateUser from '../middleware/AuthMiddleware.js'

routes.get("/dashboard/user-status",authenticateUser(["Admin"]),getUserStatusList);
routes.get("/dashboard/campaign-status",authenticateUser(["Admin"]),getCampaignStatusList);
routes.get("/dashboard",authenticateUser(["Admin"]),getDashboardCountList);
routes.get("/dashboard/user-requests",authenticateUser(["Admin"]),getRequestedUserList);
routes.get("/dashboard/campaign-requests",authenticateUser(["Admin"]),getRequestedCampaignList);
routes.post("/dashboard/approved-or-rejected",authenticateUser(["Admin"]),insertApprovedOrRejectedApplication);
routes.get("/dashboard/user-detail",getUserDetails);
export default routes;