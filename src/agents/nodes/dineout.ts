import { MealState } from "../state";
import { createAuthenticatedMcpClient } from "../../lib/mcp/client";

const DEFAULT_DINEOUT_ENDPOINT = "http://localhost:3001/mcp/v1/dineout";

export async function dineoutNode(state: MealState, config: any) {
  const token = config.configurable?.userToken;
  if (!token) {
    return {
      errors: [{ node: "dineout_node", message: "Missing user authentication token", recoverable: true }],
    };
  }

  const endpoint = process.env.SWIGGY_DINEOUT_MCP_URL || DEFAULT_DINEOUT_ENDPOINT;
  let client: any;

  try {
    client = await createAuthenticatedMcpClient(endpoint, token);
    const prompt = state.messages[state.messages.length - 1]?.content?.toString() || "meal";

    // Tool 1: Search restaurants
    const searchToolRes = await client.callTool({
      name: "search_restaurants",
      arguments: { query: prompt, location: state.userCoordinates },
    });

    if (!searchToolRes.content?.[0]?.text) {
      throw new Error("Empty response from search_restaurants tool");
    }
    const searchRes = JSON.parse(searchToolRes.content[0].text);

    // Tool 2: Check availability (party_size default to 2)
    const availabilityToolRes = await client.callTool({
      name: "check_table_availability",
      arguments: {
        restaurant_id: searchRes.restaurant_id,
        party_size: 2,
      },
    });

    if (!availabilityToolRes.content?.[0]?.text) {
      throw new Error("Empty response from check_table_availability tool");
    }
    const availabilityRes = JSON.parse(availabilityToolRes.content[0].text);

    if (!availabilityRes.available) {
      console.log(`[dineout_node] Table is not available at ${searchRes.restaurant_name}`);
      return { quotes: [] };
    }

    // Budget Cap filter
    if (state.budgetCap && searchRes.avg_cost_for_two > state.budgetCap) {
      console.log(`[dineout_node] Omitted quote because cost ₹${searchRes.avg_cost_for_two} exceeds budget limit ₹${state.budgetCap}`);
      return { quotes: [] };
    }

    return {
      quotes: [
        {
          type: "dineout" as const,
          title: searchRes.restaurant_name,
          subText: `Table for 2 available ${availabilityRes.next_slot} | est. ₹${searchRes.avg_cost_for_two} for two`,
          cost: searchRes.avg_cost_for_two,
          timeMinutes: availabilityRes.wait_minutes ?? 0,
          deepLinkUrl: availabilityRes.reservation_url,
          confidence: "high" as const,
        },
      ],
    };
  } catch (error: any) {
    console.error(`[dineout_node] Error: ${error.message}`);
    const cleanMessage = error.message?.replace(token, "[REDACTED_TOKEN]");
    return {
      errors: [
        {
          node: "dineout_node",
          message: cleanMessage || "Failed to process Dineout dining options",
          recoverable: false,
        },
      ],
    };
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore client close errors
      }
    }
  }
}
