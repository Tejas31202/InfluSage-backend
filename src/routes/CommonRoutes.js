import express from "express";
import {
  getRoles,
  getContentTypes,
  GetGender,
  GetLanguages,
  getCategories,
  getProviders,
  getPagination
} from "../controller/CommonController.js";

const routes = express.Router();

routes.get("/roles", getRoles);
routes.get("/content-type", getContentTypes);
routes.get("/genders", GetGender);
routes.get("/languages", GetLanguages);
routes.get("/categories", getCategories);
routes.get("/providers", getProviders);
routes.get('/pagination',getPagination);

export default routes;
