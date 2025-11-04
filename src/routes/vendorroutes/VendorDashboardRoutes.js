import express from 'express';
import authenticateUser from '../../middleware/AuthMiddleware.js';


import {
    getVendorCompleteProfilePercentage
} from '../../controller/vendorcontroller/VendorDashboardController.js'

const routes = express.Router();

routes.get(
    "/dashboard/profile-completion-perctange",
    authenticateUser(["Vendor"]),
    getVendorCompleteProfilePercentage
);

export default routes;