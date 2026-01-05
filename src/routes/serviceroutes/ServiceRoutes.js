import express from 'express';
import { serviceStatusMiddleware } from '../../middleware/ServiceStatusMiddleware.js';

const routes = express.Router();

routes.get("/app-status",serviceStatusMiddleware, (req, res) => {
  res.status(200).json({
    status:true
  });
});

export default routes;