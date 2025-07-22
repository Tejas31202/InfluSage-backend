const express = require('express');
const routes = express.Router();
const UserController = require('../controller/UserController');

// Route: POST /api/login
routes.post('/login', UserController.loginUser);

routes.post('/register', UserController.registerUser)

module.exports = routes;

