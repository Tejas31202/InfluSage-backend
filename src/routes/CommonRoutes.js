import express from 'express';
import {
  getRoles,
  getContentTypes,
  getGenders,
  getLanguages,
  getCategories,
  getProviders,
} from '../controller/CommonController.js';

const routes = express.Router();

routes.get("/roles", getRoles);
routes.get("/content-type", getContentTypes);
routes.get("/genders", getGenders);
routes.get("/languages", getLanguages);
routes.get("/categories", getCategories);
routes.get("/providers", getProviders);

export default routes;
