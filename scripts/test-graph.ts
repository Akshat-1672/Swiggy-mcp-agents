import { spawn } from "child_process";
import { compiledWorkflow } from "../src/agents/graph";
import { HumanMessage } from "@langchain/core/messages";

// Configure local test environment variables
process.env.SWIGGY_FOOD_MCP_URL = "http://localhost:3001/mcp/v1/food";
process.env.SWIGGY_INSTAMART_MCP_URL = "http://localhost:3001/mcp/v1/instamart";
process.env.SWIGGY_DINEOUT_MCP_URL = "http://localhost:3001/mcp/v1/dineout";

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("=== Starting Multi-Agent Optimization Engine Tests ===");

  // 1. Programmatically start the local Mock MCP Server
  console.log("[Test] Spawning Unified Mock MCP Server on port 3001...");
  const server = spawn("npx", ["tsx", "scripts/start-mocks.ts"], {
    shell: true,
  });

  // Log server outputs for debugging
  server.stdout?.on("data", (data) => {
    console.log(`[Mock Server] ${data.toString().trim()}`);
  });

  server.stderr?.on("data", (data) => {
    console.error(`[Mock Server Error] ${data.toString().trim()}`);
  });

  // Give the server 2.5 seconds to start up and bind to port 3001
  await wait(2500);

  let success = true;

  try {
    // -------------------------------------------------------------
    // Test Scenario 1: Standard Search (All nodes should succeed)
    // -------------------------------------------------------------
    console.log("\n[Test Scenario 1] Running standard request: 'Low carb salad under 500'...");
    
    const stream1 = await compiledWorkflow.stream(
      {
        messages: [new HumanMessage("Low carb salad under 500")],
        userCoordinates: { lat: 12.9716, lng: 77.5946 },
        budgetCap: 500,
        quotes: [],
        errors: [],
      },
      { configurable: { userToken: "test_oauth_token_scenario_1" } }
    );

    let collectedQuotes: any[] = [];
    let collectedErrors: any[] = [];
    for await (const chunk of stream1) {
      const node = Object.keys(chunk)[0];
      console.log(`  -> Node [${node}] finished executing`);
      const update = (chunk as any)[node];
      if (update.quotes) collectedQuotes.push(...update.quotes);
      if (update.errors) collectedErrors.push(...update.errors);
    }

    console.log(`[Result] Collected ${collectedQuotes.length} quote(s).`);
    collectedQuotes.forEach((q: any) => {
      console.log(`  - Option: ${q.title} (${q.type}) - Cost: ₹${q.cost}, Time: ${q.timeMinutes} mins`);
    });

    if (collectedQuotes.length === 0) {
      console.error("FAIL: Expected at least one quote to be returned.");
      success = false;
    } else {
      console.log("PASS: Scenario 1 succeeded.");
    }

    // -------------------------------------------------------------
    // Test Scenario 2: Hard Budget Cap Filter
    // -------------------------------------------------------------
    console.log("\n[Test Scenario 2] Running budget capped request (budgetCap = 300)...");
    
    const stream2 = await compiledWorkflow.stream(
      {
        messages: [new HumanMessage("Keto dinner option")],
        userCoordinates: { lat: 12.9716, lng: 77.5946 },
        budgetCap: 300,
        quotes: [],
        errors: [],
      },
      { configurable: { userToken: "test_oauth_token_scenario_2" } }
    );

    let collectedQuotes2: any[] = [];
    for await (const chunk of stream2) {
      const node = Object.keys(chunk)[0];
      const update = (chunk as any)[node];
      if (update.quotes) collectedQuotes2.push(...update.quotes);
    }

    console.log(`[Result] Collected ${collectedQuotes2.length} quote(s) within ₹300.`);
    collectedQuotes2.forEach((q: any) => {
      console.log(`  - Option: ${q.title} (${q.type}) - Cost: ₹${q.cost}`);
      if (q.cost > 300) {
        console.error(`FAIL: Option exceeds budget cap of 300: ${q.title} (₹${q.cost})`);
        success = false;
      }
    });

    if (success) {
      console.log("PASS: Scenario 2 budget cap filtering succeeded.");
    }

    // -------------------------------------------------------------
    // Test Scenario 3: Missing Token / Recoverable Error
    // -------------------------------------------------------------
    console.log("\n[Test Scenario 3] Running request with missing user token...");
    
    const stream3 = await compiledWorkflow.stream(
      {
        messages: [new HumanMessage("Quick lunch")],
        userCoordinates: { lat: 12.9716, lng: 77.5946 },
        quotes: [],
        errors: [],
      },
      { configurable: {} }
    );

    let collectedErrors3: any[] = [];
    for await (const chunk of stream3) {
      const node = Object.keys(chunk)[0];
      const update = (chunk as any)[node];
      if (update.errors) collectedErrors3.push(...update.errors);
    }

    console.log(`[Result] System Errors detected:`, collectedErrors3);
    
    if (collectedErrors3.length === 0) {
      console.error("FAIL: Expected validation/token errors to be recorded in State.");
      success = false;
    } else if (collectedErrors3.some((e: any) => e.message.toLowerCase().includes("token") && e.recoverable)) {
      console.log("PASS: Scenario 3 successfully captured recoverable token error.");
    } else {
      console.error("FAIL: Error caught does not match expectation.");
      success = false;
    }

  } catch (err: any) {
    console.error("FAIL: Unexpected runtime error during test execution:", err);
    success = false;
  } finally {
    // 3. Gracefully kill the server process when tests are done
    console.log("\n[Test] Shutting down Mock MCP Server...");
    server.kill();
    await wait(1000);
  }

  if (success) {
    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");
    process.exit(0);
  } else {
    console.error("\n=== SOME TESTS FAILED ===");
    process.exit(1);
  }
}

runTests();
