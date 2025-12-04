import express from 'express';
import {
  getInfluencerDashsboardCountList,
  getInfluencerProfileCompletionPercentage,
  getToDoList,
  insertOrEditOrDeleteToDo,
  getInfluencerFeedBack
} from '../../controller/influencercontroller/InfluencerDashboardController.js';
import authenticateUser from '../../middleware/AuthMiddleware.js';

const routes = express.Router();

routes.get("/dashboard/counts",
  authenticateUser(["Influencer"]),
  getInfluencerDashsboardCountList
);

routes.get(
  "/dashboard/profile-completion",
  authenticateUser(["Influencer"]),
  getInfluencerProfileCompletionPercentage
);

routes.get(
  "/dashboard/todo-list",
  authenticateUser(["Influencer"]),
  getToDoList
);

routes.post(
  "/dashboard/todo/insert-edit-delete",
  authenticateUser(["Influencer"]),
  insertOrEditOrDeleteToDo
);
routes.get(
  "/dashboard/getfeedback",
  getInfluencerFeedBack
)


export default routes;
