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

// ================== Expense Tracker Routes ==================
app.use("/api/expense", expenseRoutes);

// ================== MCP Endpoint ==================
app.post("/mcp", (req, res) => {
  const { id, method, params } = req.body;

  // Basic validation of MCP request
  if (!id || !method) {
    return res.json({
      jsonrpc: "2.0",
      id: id || null,
      error: { code: -32600, message: "Invalid Request: Missing id or method" }
    });
  }

  // Init handshake
  if (method === "initialize") {
    return res.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: "merged-mcp-server",
          version: "1.0.0"
        }
      }
    });
  }

  // List tools
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

  // Handle tool calls
  if (method === "tools/call") {
    const { name, arguments: args = {} } = params || {};

    // ====== validate tool ======
    if (name === "validate") {
      const token = args.token;

      if (!token) {
        return res.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32602,
            message: "Missing required parameter: token"
          }
        });
      }

      // token validation , 
      const validToken = process.env.AUTH_TOKEN || "my_secret_token";
      const phoneNumber = process.env.PHONE_NUMBER || "919876543210";

      if (token === validToken) {
        return res.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: phoneNumber }]
          }
        });
      } else {
        return res.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32001,
            message: "Invalid bearer token"
          }
        });
      }
    }

    // ====== hello tool ======
    if (name === "hello") {
      const greeting = `Hello ${args.name || "World"}! This is my merged MCP + Expense server 🚀`;
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: greeting }],
          isError: false
        }
      });
    }
  }

  // Unknown method
  return res.json({
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: "Method not found" }
  });
});

//  Error Handling Middleware 
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }
  res.status(500).json({ success: false, message: "Internal Server Error" });
});

// Start Server 
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
