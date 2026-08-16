import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { EventSource } from "eventsource";

// Polyfill EventSource for Node.js server-side environment
if (typeof window === "undefined" && !globalThis.EventSource) {
  globalThis.EventSource = EventSource as any;
}

export async function createAuthenticatedMcpClient(
  serverUrl: string,
  userToken: string
): Promise<Client> {
  const transport = new SSEClientTransport(new URL(serverUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
      },
    },
  });

  const client = new Client(
    { name: "antigravity-meal-engine", version: "1.0.0" },
    { capabilities: {} }
  );

  // Implement a 10-second connection handshake timeout
  const connectPromise = client.connect(transport);
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`MCP Client connection handshake timed out for server: ${serverUrl}`));
    }, 10000);
  });

  try {
    await Promise.race([connectPromise, timeoutPromise]);
  } catch (error) {
    // Prevent memory and connection leaks on timeout/failure
    try {
      await transport.close();
    } catch {
      // Ignore transport close errors
    }
    throw error;
  }

  return client;
}
