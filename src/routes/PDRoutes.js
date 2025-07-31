const express = require('express');
const routes = express.Router();
const PDController  = require('../controller/PDController');
const authenticateUser = require("../middleware/AuthMiddleware");


// POST request to complete user profile
routes.post('/complete-profile',authenticateUser, PDController.completeUserProfile);
routes.get('/profile/:userId',authenticateUser, PDController.getUserProfile);

routes.get('/:email' , PDController.getUserNameByEmail);

module.exports = routes;
