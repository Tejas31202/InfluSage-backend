
import express from 'express';
const routes = express.Router();
import { 
    getUserStatusList,
    getCampaignStatusList,
    getDashboardCountList,
    getRequestedUserList,
    getRequestedCampaignList,
    insertApprovedOrRejectedApplication
} from '../controller/AdminPanelController.js';

routes.get("/dashboard/user-status",getUserStatusList);
routes.get("/dashboard/campaign-status",getCampaignStatusList);
routes.get("/dashboard",getDashboardCountList);
routes.get("/dashboard/user-requests",getRequestedUserList);
routes.get("/dashboard/campaign-requests",getRequestedCampaignList);
routes.post("/dashboard/approved-or-rejected",insertApprovedOrRejectedApplication);

export default routes;