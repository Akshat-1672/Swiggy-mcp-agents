import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const app = express();
app.use(express.json());

// Enable CORS for testing
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Helper function to extract token and log request
function checkAuth(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn(`[WARN] Missing or invalid Authorization header on ${req.path}`);
  } else {
    // Redacted token logging
    const token = authHeader.replace("Bearer ", "");
    const masked = token.length > 8 ? token.substring(0, 4) + "..." + token.substring(token.length - 4) : "***";
    console.log(`[AUTH] Authenticated request with token: ${masked}`);
  }
}

// -------------------------------------------------------------
// 1. Swiggy Food MCP Server
// -------------------------------------------------------------
const foodServer = new Server(
  { name: "swiggy-food-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const foodTransports = new Map<string, SSEServerTransport>();

foodServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_menu",
        description: "Search restaurant menu items based on query and location.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Food item or cuisine description" },
            location: {
              type: "object",
              properties: {
                lat: { type: "number" },
                lng: { type: "number" },
              },
              required: ["lat", "lng"],
            },
          },
          required: ["query", "location"],
        },
      },
      {
        name: "update_food_cart",
        description: "Update the delivery food cart and get total payable and ETA.",
        inputSchema: {
          type: "object",
          properties: {
            restaurant_id: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item_id: { type: "string" },
                  quantity: { type: "number" },
                },
                required: ["item_id", "quantity"],
              },
            },
          },
          required: ["restaurant_id", "items"],
        },
      },
    ],
  };
});

foodServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.log(`[Food Tool Call] ${name}`, args);

  if (name === "search_menu") {
    const query = (args?.query as string) || "meal";
    const isLowCarb = query.toLowerCase().includes("carb") || query.toLowerCase().includes("salad") || query.toLowerCase().includes("healthy");
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            restaurant_id: "rest_food_101",
            restaurant_name: isLowCarb ? "The Keto Kitchen" : "Gourmet Garden Bistro",
            recommended_item_id: isLowCarb ? "item_keto_salad" : "item_classic_burger_meal",
            avg_cost_for_two: isLowCarb ? 450 : 350,
          }),
        },
      ],
    };
  }

  if (name === "update_food_cart") {
    const itemId = (args?.items as any)?.[0]?.item_id || "item_generic";
    const isKeto = itemId.includes("keto");
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total_payable: isKeto ? 380 : 290,
            eta_minutes: 25,
            checkout_url: "https://www.swiggy.com/checkout/food/rest_food_101?cart=success",
          }),
        },
      ],
    };
  }

  throw new Error(`Tool not found: ${name}`);
});

app.get("/mcp/v1/food", async (req, res) => {
  checkAuth(req);
  console.log("[Food MCP] Client connecting over SSE...");
  const transport = new SSEServerTransport("/mcp/v1/food/message", res);
  foodTransports.set(transport.sessionId, transport);
  
  res.on("close", () => {
    console.log(`[Food MCP] Client closed connection for session ${transport.sessionId}`);
    foodTransports.delete(transport.sessionId);
  });

  await foodServer.connect(transport);
});

app.post("/mcp/v1/food/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = foodTransports.get(sessionId);
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send("No food session found");
  }
});


// -------------------------------------------------------------
// 2. Instamart MCP Server
// -------------------------------------------------------------
const instamartServer = new Server(
  { name: "swiggy-instamart-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const instamartTransports = new Map<string, SSEServerTransport>();

instamartServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "suggest_recipe",
        description: "Suggest a list of grocery ingredients and prep details based on query.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Desired meal or dietary goal" },
          },
          required: ["query"],
        },
      },
      {
        name: "price_grocery_basket",
        description: "Price the suggested grocery items and get delivery ETA.",
        inputSchema: {
          type: "object",
          properties: {
            items: { type: "array", items: { type: "string" } },
            location: {
              type: "object",
              properties: {
                lat: { type: "number" },
                lng: { type: "number" },
              },
              required: ["lat", "lng"],
            },
          },
          required: ["items", "location"],
        },
      },
    ],
  };
});

instamartServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.log(`[Instamart Tool Call] ${name}`, args);

  if (name === "suggest_recipe") {
    const query = (args?.query as string) || "meal";
    const isLowCarb = query.toLowerCase().includes("carb") || query.toLowerCase().includes("salad") || query.toLowerCase().includes("healthy");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            recipe_name: isLowCarb ? "Grilled Salmon Salad Bowl" : "Classic Italian Pasta Carbonara",
            prep_minutes: isLowCarb ? 15 : 20,
            ingredients: isLowCarb 
              ? ["Fresh Salmon Fillet", "Organic Baby Spinach", "Avocado", "Cherry Tomatoes", "Olive Oil Dressing"]
              : ["Spaghetti", "Pancetta", "Eggs", "Pecorino Romano", "Black Pepper"],
          }),
        },
      ],
    };
  }

  if (name === "price_grocery_basket") {
    const items = (args?.items as string[]) || [];
    const isSalmon = items.some(item => item.toLowerCase().includes("salmon") || item.toLowerCase().includes("spinach"));
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total_payable: isSalmon ? 490 : 250,
            delivery_eta_minutes: 12,
            checkout_url: "https://www.swiggy.com/instamart?cart=basket_im_01",
          }),
        },
      ],
    };
  }

  throw new Error(`Tool not found: ${name}`);
});

app.get("/mcp/v1/instamart", async (req, res) => {
  checkAuth(req);
  console.log("[Instamart MCP] Client connecting over SSE...");
  const transport = new SSEServerTransport("/mcp/v1/instamart/message", res);
  instamartTransports.set(transport.sessionId, transport);
  
  res.on("close", () => {
    console.log(`[Instamart MCP] Client closed connection for session ${transport.sessionId}`);
    instamartTransports.delete(transport.sessionId);
  });

  await instamartServer.connect(transport);
});

app.post("/mcp/v1/instamart/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = instamartTransports.get(sessionId);
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send("No instamart session found");
  }
});


// -------------------------------------------------------------
// 3. Swiggy Dineout MCP Server
// -------------------------------------------------------------
const dineoutServer = new Server(
  { name: "swiggy-dineout-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const dineoutTransports = new Map<string, SSEServerTransport>();

dineoutServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_restaurants",
        description: "Search dining restaurants based on query and location.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string" },
            location: {
              type: "object",
              properties: {
                lat: { type: "number" },
                lng: { type: "number" },
              },
              required: ["lat", "lng"],
            },
          },
          required: ["query", "location"],
        },
      },
      {
        name: "check_table_availability",
        description: "Check table reservation slots for a restaurant and party size.",
        inputSchema: {
          type: "object",
          properties: {
            restaurant_id: { type: "string" },
            party_size: { type: "number" },
          },
          required: ["restaurant_id", "party_size"],
        },
      },
    ],
  };
});

dineoutServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.log(`[Dineout Tool Call] ${name}`, args);

  if (name === "search_restaurants") {
    const query = (args?.query as string) || "dining";
    const isLowCarb = query.toLowerCase().includes("carb") || query.toLowerCase().includes("salad") || query.toLowerCase().includes("healthy");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            restaurant_id: "rest_dine_202",
            restaurant_name: isLowCarb ? "Green Leaf Cafe & Grill" : "Rustic Romano Italian Ristorante",
            avg_cost_for_two: isLowCarb ? 600 : 800,
          }),
        },
      ],
    };
  }

  if (name === "check_table_availability") {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            available: true,
            next_slot: "8:00 PM Tonight",
            wait_minutes: 0,
            reservation_url: "https://www.swiggy.com/dineout/reserve/rest_dine_202?slots=avail",
          }),
        },
      ],
    };
  }

  throw new Error(`Tool not found: ${name}`);
});

app.get("/mcp/v1/dineout", async (req, res) => {
  checkAuth(req);
  console.log("[Dineout MCP] Client connecting over SSE...");
  const transport = new SSEServerTransport("/mcp/v1/dineout/message", res);
  dineoutTransports.set(transport.sessionId, transport);
  
  res.on("close", () => {
    console.log(`[Dineout MCP] Client closed connection for session ${transport.sessionId}`);
    dineoutTransports.delete(transport.sessionId);
  });

  await dineoutServer.connect(transport);
});

app.post("/mcp/v1/dineout/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = dineoutTransports.get(sessionId);
  if (transport) {
    await transport.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).send("No dineout session found");
  }
});


// -------------------------------------------------------------
// Start Unified Server
// -------------------------------------------------------------
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`[Unified Swiggy Mock MCP Server] running on http://localhost:${PORT}`);
  console.log(`[SSE Endpoint 1] http://localhost:${PORT}/mcp/v1/food`);
  console.log(`[SSE Endpoint 2] http://localhost:${PORT}/mcp/v1/instamart`);
  console.log(`[SSE Endpoint 3] http://localhost:${PORT}/mcp/v1/dineout`);
});
