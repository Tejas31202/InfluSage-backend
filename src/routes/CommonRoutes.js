import express from "express";
import { getRoles } from "../controller/CommonController.js";


const routes = express.Router();

routes.get("/roles", getRoles);

export default routes;
