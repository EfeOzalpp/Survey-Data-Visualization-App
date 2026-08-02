import cluster from "node:cluster";
import express from "express";
import { join } from "node:path";
import { streamDocument } from "../server-rendering/streamDocument";
import { runPrimary } from "./cluster/primary";
import { CLUSTER_MODE } from "./cluster/clusterMode";
import { startWorkerLoadReporting } from "./cluster/workerLoadReporter";
import { loadTestStatsRoute, resetLoadTestStatsRoute } from "./load-testing/loadTestStats"; // load-testing
import { LOAD_TEST_MODE } from "./load-testing/loadTestMode"; // load-testing
import { gamificationCopyRoute } from "./routes/gamificationCopy";
import { infoMediaRoute } from "./routes/infoMedia";
import { saveSoloMessageRoute } from "./routes/saveSoloMessage";
import { saveUserResponseRoute } from "./routes/saveUserResponse";
import { surveyResponseStreamRoute } from "./routes/surveyResponseStream";

if (CLUSTER_MODE && cluster.isPrimary) {
  runPrimary();
} else {
  startWorkerLoadReporting();

  const app = express();

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";

  if (process.env.TRUST_PROXY === "1") {
    app.set("trust proxy", 1);
  }

  // This parses JSON request bodies and makes them available as req.body for POST handlers.
  app.use(express.json({ limit: "8kb" }));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.get("/api/survey-responses/stream", (req, res) => { void surveyResponseStreamRoute(req, res); });
  app.get("/api/gamification-copy", (req, res) => { void gamificationCopyRoute(req, res); });
  app.get("/api/info-media", (req, res) => { void infoMediaRoute(req, res); });
  app.post("/api/save-user-response", (req, res) => { void saveUserResponseRoute(req, res); });
  app.post("/api/save-solo-message", (req, res) => { void saveSoloMessageRoute(req, res); });

  // load-testing: only mounted when LOAD_TEST_MODE=true, so it's absent from real production.
  if (LOAD_TEST_MODE) {
    app.get("/api/debug/load-test-stats", (req, res) => { void loadTestStatsRoute(req, res); });
    app.post("/api/debug/load-test-stats/reset", (req, res) => { void resetLoadTestStatsRoute(req, res); });
  }

  if (process.env.NODE_ENV === "production") {
    // process.cwd() is the directory where the Node process was started.
    const clientDist = join(process.cwd(), "dist");

    // Serve built JS/CSS/image files directly, but do not auto-serve index.html.
    // App document requests should flow through the streaming SSR document.
    app.use(express.static(clientDist, { index: false }));

    // Fallback page route: any non-API/static GET request receives the app HTML.
    // This stays last so specific API routes and static assets get first chance.
    app.get("*", (_req, res, next) => {
      void streamDocument({
        clientDist,
        next,
        res,
      }).catch(next);
    });
  }

  const server = app.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${String(port)}`);
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Cannot start server: http://${host}:${String(port)} is already in use. ` +
          "Stop the existing process or set PORT to another value before running npm start."
      );
      process.exit(1);
    }

    throw error;
  });
}
