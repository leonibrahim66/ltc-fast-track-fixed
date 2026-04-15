import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { handleMtnWebhook } from "../mtn-webhook";
import { startTransactionMonitor, stopTransactionMonitor } from "../transaction-monitor";
import pawapayWebhookRouter from "../webhooks/pawapay";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ── CORS ──────────────────────────────────────────────────────────────────────
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Digest",
    );
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // ── Body parsers ──────────────────────────────────────────────────────────────
  //
  // RULE: express.json() is registered ONCE globally. It handles all JSON routes
  // including /deposit and /refund. Do NOT add any other body parser globally.
  //
  // The PawaPay /callback route needs the raw bytes for Content-Digest signature
  // verification. We use express.raw() scoped ONLY to that path — it does NOT
  // interfere with express.json() on other routes because each route only runs
  // the middleware registered for its path.
  //
  // The MTN webhook also needs raw bytes for HMAC-SHA256 verification — same
  // approach: express.raw() scoped only to /api/mtn/webhook.

  // express.raw() for MTN webhook — captures raw Buffer into req.body
  app.use(
    "/api/mtn/webhook",
    express.raw({ type: "*/*", limit: "10mb" }),
  );

  // express.raw() for PawaPay signed callback ONLY — captures raw Buffer into req.body
  // Deposit and refund use express.json() below (no raw needed there).
  app.use(
    "/api/payments/pawapay/callback",
    express.raw({ type: "*/*", limit: "10mb" }),
  );

  // Global JSON parser — handles all other routes including /deposit and /refund
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ── Routes ────────────────────────────────────────────────────────────────────
  registerOAuthRoutes(app);

  // MTN MoMo Webhook — POST /api/mtn/webhook
  // req.body is a raw Buffer (from express.raw above) — handleMtnWebhook reads it directly
  app.post("/api/mtn/webhook", handleMtnWebhook);

  // PawaPay Webhooks:
  //   POST /api/payments/pawapay/deposit   — req.body is parsed JSON (express.json)
  //   POST /api/payments/pawapay/refund    — req.body is parsed JSON (express.json)
  //   POST /api/payments/pawapay/callback  — req.body is raw Buffer (express.raw)
  //   GET  /api/payments/pawapay/health    — no body
  app.use("/api/payments/pawapay", pawapayWebhookRouter);

  // Global health check — always returns 200 even if DB is down
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // tRPC
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // ── Global error handler ──────────────────────────────────────────────────────
  app.use(
    (
      err: Error,
      _req: import("express").Request,
      res: import("express").Response,
      _next: import("express").NextFunction,
    ) => {
      console.error("[Express] Unhandled error:", err.stack ?? err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Internal server error" });
      }
    },
  );

  // ── Start server ──────────────────────────────────────────────────────────────
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    startTransactionMonitor();
  });

  const shutdown = () => {
    stopTransactionMonitor();
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer().catch(console.error);
