import express from 'express';
import authenticateUser from '../../middleware/AuthMiddleware.js';
import { vendorInsertFeedback } from '../../controller/vendorcontroller/VendorFeedBackController.js'

const routes = express.Router();

routes.post(
    "/feedback",
    authenticateUser(["Vendor"]),
    vendorInsertFeedback
)

export default routes;