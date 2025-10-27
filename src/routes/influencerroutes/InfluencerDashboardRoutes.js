import express from "express";
import {
  getInfluencerDesboardCountList,
  getInfluencerProfileCompletionPercentage,
  getAllToDoList,
  getSingleToDo,
  deleteSingleToDo,
} from "../../controller/influencercontroller/InfluencerDashboardController.js";
import authenticateUser from "../../middleware/AuthMiddleware.js";

const routes = express.Router();

routes.get("/dashboard/counts", getInfluencerDesboardCountList);
routes.get(
  "/dashboard/profile-completion",
  authenticateUser(["Influencer"]),
  getInfluencerProfileCompletionPercentage
);
routes.get("/dashboard/todo-list", getAllToDoList);
routes.get("/dashboard/todo/:id", getSingleToDo);
routes.delete("/dashboard/todo/:id", deleteSingleToDo);

export default routes;
