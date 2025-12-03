import express from 'express';
import authenticateUser from '../../middleware/AuthMiddleware.js';


import {
    getVendorCompleteProfilePercentage,
<<<<<<< HEAD
    getvendorperformancesummary
=======
    getTotalVendorCampaigns,
    getCampaignSummary,
    getVendorRecentCampaigns,
    getVendorRecentApplications
>>>>>>> 91a7ef2b9aaa64f135a85bd23aef731f2d3f3886
} from '../../controller/vendorcontroller/VendorDashboardController.js'

const routes = express.Router();

routes.get(
    "/dashboard/profile-completion-perctange",
    authenticateUser(["Vendor"]),
    getVendorCompleteProfilePercentage
);

routes.get(
<<<<<<< HEAD
    "/dashboard/performancesummary",
    authenticateUser(["Vendor"]),
    getvendorperformancesummary

)
=======
    "/dashboard/total-campaigns",
    authenticateUser(["Vendor"]),
    getTotalVendorCampaigns
);

routes.get(
    "/dashboard/campaign-summary",
    authenticateUser(["Vendor"]),
    getCampaignSummary
);

routes.get(
    "/dashboard/recent-campaigns",
    authenticateUser(["Vendor"]),
    getVendorRecentCampaigns
);

routes.get(
    "/dashboard/recent-applications",
    authenticateUser(["Vendor"]),
    getVendorRecentApplications
);
>>>>>>> 91a7ef2b9aaa64f135a85bd23aef731f2d3f3886

export default routes;