import { MealState } from "../state";
import { createAuthenticatedMcpClient } from "../../lib/mcp/client";

const DEFAULT_FOOD_ENDPOINT = "http://localhost:3001/mcp/v1/food";

export async function deliveryNode(state: MealState, config: any) {
  const token = config.configurable?.userToken;
  if (!token) {
    return {
      errors: [{ node: "delivery_node", message: "Missing user authentication token", recoverable: true }],
    };
  }

  const endpoint = process.env.SWIGGY_FOOD_MCP_URL || DEFAULT_FOOD_ENDPOINT;
  let client: any;

  try {
    client = await createAuthenticatedMcpClient(endpoint, token);
    const prompt = state.messages[state.messages.length - 1]?.content?.toString() || "meal";

    // Tool 1: Search menu and find recommendation
    const searchToolRes = await client.callTool({
      name: "search_menu",
      arguments: { query: prompt, location: state.userCoordinates },
    });

    if (!searchToolRes.content?.[0]?.text) {
      throw new Error("Empty response from search_menu tool");
    }
    const searchRes = JSON.parse(searchToolRes.content[0].text);

    // Tool 2: Add recommended item to food cart and fetch total pricing and ETA
    const cartToolRes = await client.callTool({
      name: "update_food_cart",
      arguments: {
        restaurant_id: searchRes.restaurant_id,
        items: [{ item_id: searchRes.recommended_item_id, quantity: 1 }],
      },
    });

    if (!cartToolRes.content?.[0]?.text) {
      throw new Error("Empty response from update_food_cart tool");
    }
    const cartRes = JSON.parse(cartToolRes.content[0].text);

    // Budget Cap filter
    if (state.budgetCap && cartRes.total_payable > state.budgetCap) {
      console.log(`[delivery_node] Omitted quote because cost ₹${cartRes.total_payable} exceeds budget limit ₹${state.budgetCap}`);
      return { quotes: [] };
    }

    return {
      quotes: [
        {
          type: "delivery" as const,
          title: searchRes.restaurant_name,
          subText: `Delivered via Swiggy Food | ${cartRes.eta_minutes} mins away`,
          cost: cartRes.total_payable,
          timeMinutes: cartRes.eta_minutes,
          deepLinkUrl: cartRes.checkout_url,
          confidence: "high" as const,
        },
      ],
    };
  } catch (error: any) {
    console.error(`[delivery_node] Error: ${error.message}`);
    // Clean headers or token info from logs if captured
    const cleanMessage = error.message?.replace(token, "[REDACTED_TOKEN]");
    return {
      errors: [
        {
          node: "delivery_node",
          message: cleanMessage || "Failed to process Swiggy Food order options",
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
