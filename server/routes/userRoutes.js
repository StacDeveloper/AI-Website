import express from 'express';
import { auth } from '../middleware/auth.js';
import {
  GetPublishCreations,
  GetUserCreations,
  ToggleLikeCreation,
} from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.get('/get-user-creations', auth, GetUserCreations);
userRouter.get('/get-published-creations', auth, GetPublishCreations);
userRouter.post('/toggle-like-creations', auth, ToggleLikeCreation);

export default userRouter;
