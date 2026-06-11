import { Router } from "express";
import * as ingest from "../controllers/ingest.controller";

const router = Router();
router.post("/", ingest.ingest);
router.post("/google-sheet", ingest.syncGoogleSheet);
router.get("/google-sheet", ingest.syncGoogleSheet);

export default router;
