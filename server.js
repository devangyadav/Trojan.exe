// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.config.js";
import expenseRoutes from "./routes/expense.routes.js";
import { ApiError } from "./utils/ApiError.js";

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// NOTE: This sets a response header. ngrok's web warning is shown BEFORE your server for browser visits,
// so this line helps programmatic clients that respect the header, but won't change the browser first-visit warning.
app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

// ================== Expense Tracker API ==================
app.use("/api/expense", expenseRoutes);

// ================== MCP endpoint (single JSON-RPC handler) ==================
const AUTH_TOKEN = process.env.AUTH_TOKEN || my_secret_token;
const PHONE_NUMBER = process.env.PHONE_NUMBER;

// Helpful simple GET for probes (no auth) — many services do a quick GET before POST
app.get("/mcp", (req, res) => {
  res.json({ message: "MCP server online — use POST /mcp for JSON-RPC", status: "ok" });
});

app.post("/mcp", (req, res) => {
  // debug log to terminal — remove or reduce in production
  console.log("[MCP] incoming request:", { headers: req.headers, bodySummary: { method: req.body?.method, id: req.body?.id } });

  const authHeader = req.headers.authorization || "";
  // Validate Bearer token first (so Puch sees auth error if wrong)
  if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
    console.warn("[MCP] auth failed:", authHeader);
    return res.status(403).json({
      jsonrpc: "2.0",
      id: req.body?.id ?? null,
      error: { code: -32001, message: "Forbidden: Invalid or missing token" }
    });
  }

  const { id, method, params } = req.body || {};

  if (!id || !method) {
    return res.json({
      jsonrpc: "2.0",
      id: id || null,
      error: { code: -32600, message: "Invalid Request: Missing id or method" }
    });
  }

  // ---- initialize handshake ----
  if (method === "initialize") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "merged-mcp-server", version: "1.0.0" }
      }
    });
  }

  // ---- list tools ----
  if (method === "tools/list") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "validate",
            description: "Validates the bearer token",
            inputSchema: {
              type: "object",
              properties: { token: { type: "string" } },
              required: ["token"]
            }
          },
          {
            name: "hello",
            description: "Says hello to the user",
            inputSchema: {
              type: "object",
              properties: { name: { type: "string" } }
            }
          }
        ]
      }
    });
  }

  // ---- handle tool calls ----
  if (method === "tools/call") {
    const { name, arguments: args = {} } = params || {};

    // validate tool -> returns phone number if token arg matches
    if (name === "validate") {
      const tokenArg = args.token;
      if (!tokenArg) {
        return res.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "Missing required parameter: token" }
        });
      }

      if (tokenArg === AUTH_TOKEN) {
        return res.json({
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: PHONE_NUMBER }] }
        });
      } else {
        return res.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32001, message: "Invalid bearer token" }
        });
      }
    }

    // hello tool
    if (name === "hello") {
      const greeting = `Hello ${args.name || "World"}! This is my merged MCP + Expense server 🚀`;
      return res.json({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: greeting }], isError: false }
      });
    }
  }

  // ---- unknown method ----
  return res.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: "Method not found" }
  });
});

// ================== Common Error Handling ==================
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

// ================== Start Server ==================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
