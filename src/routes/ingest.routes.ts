import { Router } from "express";
import * as ingest from "../controllers/ingest.controller";

const router = Router();
router.post("/", ingest.ingest);

export default router;
