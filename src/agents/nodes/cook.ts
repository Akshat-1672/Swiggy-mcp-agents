import { MealState } from "../state";
import { createAuthenticatedMcpClient } from "../../lib/mcp/client";

const DEFAULT_INSTAMART_ENDPOINT = "http://localhost:3001/mcp/v1/instamart";

export async function cookNode(state: MealState, config: any) {
  const token = config.configurable?.userToken;
  if (!token) {
    return {
      errors: [{ node: "cook_node", message: "Missing user authentication token", recoverable: true }],
    };
  }

  const endpoint = process.env.SWIGGY_INSTAMART_MCP_URL || DEFAULT_INSTAMART_ENDPOINT;
  let client: any;

  try {
    client = await createAuthenticatedMcpClient(endpoint, token);
    const prompt = state.messages[state.messages.length - 1]?.content?.toString() || "meal";

    // Tool 1: Suggest recipe ingredients and prep details
    const recipeToolRes = await client.callTool({
      name: "suggest_recipe",
      arguments: { query: prompt },
    });

    if (!recipeToolRes.content?.[0]?.text) {
      throw new Error("Empty response from suggest_recipe tool");
    }
    const recipeRes = JSON.parse(recipeToolRes.content[0].text);

    // Tool 2: Price grocery basket
    const basketToolRes = await client.callTool({
      name: "price_grocery_basket",
      arguments: {
        items: recipeRes.ingredients,
        location: state.userCoordinates,
      },
    });

    if (!basketToolRes.content?.[0]?.text) {
      throw new Error("Empty response from price_grocery_basket tool");
    }
    const basketRes = JSON.parse(basketToolRes.content[0].text);

    // Budget Cap filter
    if (state.budgetCap && basketRes.total_payable > state.budgetCap) {
      console.log(`[cook_node] Omitted quote because cost ₹${basketRes.total_payable} exceeds budget limit ₹${state.budgetCap}`);
      return { quotes: [] };
    }

    return {
      quotes: [
        {
          type: "cook" as const,
          title: recipeRes.recipe_name,
          subText: `${recipeRes.prep_minutes} min prep + ${basketRes.delivery_eta_minutes} min grocery delivery`,
          cost: basketRes.total_payable,
          timeMinutes: recipeRes.prep_minutes + basketRes.delivery_eta_minutes,
          deepLinkUrl: basketRes.checkout_url,
          confidence: "high" as const,
        },
      ],
    };
  } catch (error: any) {
    console.error(`[cook_node] Error: ${error.message}`);
    const cleanMessage = error.message?.replace(token, "[REDACTED_TOKEN]");
    return {
      errors: [
        {
          node: "cook_node",
          message: cleanMessage || "Failed to process Instamart grocery cooking options",
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
