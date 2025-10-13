
import express from 'express';
const routes = express.Router();
import { getAdminPanelStatusList,getDashboardCountList,getRequestedUserList,getRequestedCampaignList,insertApprovedOrRejectedApplication} from '../controller/AdminPanelController.js';

routes.get("/admin-staus",getAdminPanelStatusList);
routes.get("/dashboard-count",getDashboardCountList);
routes.get("/user-request",getRequestedUserList);
routes.get("/campaign-request",getRequestedCampaignList);
routes.get("/dashboard-count",getDashboardCountList);
routes.post("/approved-or-rejected",insertApprovedOrRejectedApplication);

export default routes;