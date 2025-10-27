import express from "express";
import {
  getInfluencerDashsboardCountList,
  getInfluencerProfileCompletionPercentage,
  getAllToDoList,
  getSingleToDo,
  deleteSingleToDo,
} from "../../controller/influencercontroller/InfluencerDashboardController.js";
import authenticateUser from "../../middleware/AuthMiddleware.js";

const routes = express.Router();

routes.get("/dashboard/counts",authenticateUser(["Influencer"]),getInfluencerDashsboardCountList);
routes.get(
  "/dashboard/profile-completion",
  authenticateUser(["Influencer"]),
  getInfluencerProfileCompletionPercentage
);
routes.get("/dashboard/todo-list", getAllToDoList);
routes.get("/dashboard/todo/:id", getSingleToDo);
routes.delete("/dashboard/todo/:id", deleteSingleToDo);

export default routes;
