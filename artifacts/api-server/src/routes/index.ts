import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import postsRouter from "./posts";
import followsRouter from "./follows";
import feedRouter from "./feed";
import commentsRouter from "./comments";
import storageRouter from "./storage";
import likesRouter from "./likes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(postsRouter);
router.use(followsRouter);
router.use(feedRouter);
router.use(commentsRouter);
router.use(storageRouter);
router.use(likesRouter);

export default router;
