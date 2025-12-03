import express from 'express';
import authenticateUser from '../../middleware/AuthMiddleware.js';


import {
    getVendorCompleteProfilePercentage,
    getvendorperformancesummary
} from '../../controller/vendorcontroller/VendorDashboardController.js'

const routes = express.Router();

routes.get(
    "/dashboard/profile-completion-perctange",
    authenticateUser(["Vendor"]),
    getVendorCompleteProfilePercentage
);

routes.get(
    "/dashboard/performancesummary",
    authenticateUser(["Vendor"]),
    getvendorperformancesummary

)

export default routes;