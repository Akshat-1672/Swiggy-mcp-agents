import { MealState } from "../state";
import { AIMessage } from "@langchain/core/messages";

export async function synthesizerNode(state: MealState) {
  // If no quotes were collected
  if (state.quotes.length === 0) {
    // Check if budget filtering was the cause
    if (state.budgetCap !== undefined) {
      const budgetNote = `No options found within your budget limit of ₹${state.budgetCap}. Try increasing your budget cap.`;
      
      // Append warning if there were also service errors
      const errorSuffix = state.errors.length > 0 
        ? ` (Additionally, ${state.errors.length} service(s) failed: ${state.errors.map(e => e.node).join(", ")})`
        : "";
      
      return {
        messages: [new AIMessage(`${budgetNote}${errorSuffix}`)],
      };
    }

    // Check if everything failed with errors
    if (state.errors.length > 0) {
      const errDetails = state.errors.map(e => `${e.node} failed: ${e.message}`).join("; ");
      return {
        messages: [
          new AIMessage(
            `Unable to retrieve meal options due to system errors. Details: ${errDetails}`
          ),
        ],
      };
    }

    // Default empty match
    return {
      messages: [new AIMessage("I couldn't find any matching options across cooking, delivery, or dineout.")],
    };
  }

  // Sort quotes by cost ascending
  const sortedQuotes = [...state.quotes].sort((a, b) => a.cost - b.cost);
  
  const summaryMarkdown = sortedQuotes
    .map(
      (q, index) =>
        `${index + 1}. **${q.title}** (${q.type.toUpperCase()})\n` +
        `   - **Cost**: ₹${q.cost}\n` +
        `   - **Time**: ~${q.timeMinutes} mins\n` +
        `   - **Details**: ${q.subText}\n` +
        `   - [Proceed to Order/Reservation](${q.deepLinkUrl})`
    )
    .join("\n\n");

  let note = "";
  if (state.errors.length > 0) {
    const failedNodes = state.errors.map(e => e.node.replace("_node", "")).join(", ");
    note = `\n\n*Note: Options for [${failedNodes}] could not be loaded due to connection errors.*`;
  }

  const finalResponse = `Here is your synthesized comparison matrix, ordered by lowest cost:\n\n${summaryMarkdown}${note}`;

  return {
    messages: [new AIMessage(finalResponse)],
  };
}
