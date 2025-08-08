const express = require('express');
const routes = express.Router();
const VendorPDController  = require('../controller/VendorPDController');
const authenticateUser = require("../middleware/AuthMiddleware");


routes.get("/vendor-categories", VendorPDController.getVendorCategories)

routes.get("/company-sizes", VendorPDController.getCompanySizes)

routes.get("/influencer-tiers", VendorPDController.getInfluencerTiers)

routes.post("/complete-vendor-profile",  VendorPDController.completeVendorProfile)

routes.get('/profile/:userId', authenticateUser, VendorPDController.getVendorProfile)

routes.get('/objectives', VendorPDController.getObjectives);




routes.get('/:email' , VendorPDController.getUserNameByEmail);

module.exports = routes;
