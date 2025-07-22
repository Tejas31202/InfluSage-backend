const express = require('express');
const routes = express.Router();
const roleController = require('../controller/RoleController');

routes.get('/all', roleController.getAllRoles);
routes.get('/:id', roleController.getRoleById);
routes.post('/', roleController.createRole);
// routes.put('/:id', roleController.updateRole);
// routes.delete('/:id', roleController.deleteRole);

module.exports = routes;