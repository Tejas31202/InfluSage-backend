import express from "express";
import { getRoles ,getContentTypes} from "../controller/CommonController.js";


const routes = express.Router();

routes.get("/roles", getRoles);
routes.get("/content-type",getContentTypes)

export default routes;
