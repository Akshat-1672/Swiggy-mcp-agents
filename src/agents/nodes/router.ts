import { MealState } from "../state";

export function fanOutRouter(state: MealState): string[] {
  const lastMessage =
    state.messages[state.messages.length - 1]?.content?.toString().toLowerCase() || "";

  let cook = true;
  let delivery = true;
  let dineout = true;

  // Negation keywords/phrases
  const noCook =
    lastMessage.includes("don't want to cook") ||
    lastMessage.includes("dont want to cook") ||
    lastMessage.includes("no cooking") ||
    lastMessage.includes("no cook") ||
    lastMessage.includes("without cooking") ||
    lastMessage.includes("avoid cooking") ||
    lastMessage.includes("not cooking") ||
    lastMessage.includes("not cook");

  const noDelivery =
    lastMessage.includes("don't want delivery") ||
    lastMessage.includes("dont want delivery") ||
    lastMessage.includes("no delivery") ||
    lastMessage.includes("no order") ||
    lastMessage.includes("no ordering") ||
    lastMessage.includes("avoid delivery") ||
    lastMessage.includes("not delivery") ||
    lastMessage.includes("not order");

  const noDineout =
    lastMessage.includes("don't want to go out") ||
    lastMessage.includes("dont want to go out") ||
    lastMessage.includes("no dineout") ||
    lastMessage.includes("no dining") ||
    lastMessage.includes("no restaurant") ||
    lastMessage.includes("avoid going out") ||
    lastMessage.includes("stay home") ||
    lastMessage.includes("stay in");

  if (noCook) cook = false;
  if (noDelivery) delivery = false;
  if (noDineout) dineout = false;

  // Positive intents
  const wantsCook =
    lastMessage.includes("cook") ||
    lastMessage.includes("grocery") ||
    lastMessage.includes("instamart") ||
    lastMessage.includes("recipe") ||
    lastMessage.includes("ingredients") ||
    lastMessage.includes("homecooked");

  const wantsDelivery =
    lastMessage.includes("delivery") ||
    lastMessage.includes("order") ||
    lastMessage.includes("swiggy food") ||
    lastMessage.includes("deliver") ||
    lastMessage.includes("takeaway");

  const wantsDineout =
    lastMessage.includes("dineout") ||
    lastMessage.includes("restaurant") ||
    lastMessage.includes("dining out") ||
    lastMessage.includes("reservation") ||
    lastMessage.includes("table") ||
    lastMessage.includes("go out");

  // If there is any positive intent specify it, unless negated
  if (wantsCook || wantsDelivery || wantsDineout) {
    cook = wantsCook && !noCook;
    delivery = wantsDelivery && !noDelivery;
    dineout = wantsDineout && !noDineout;

    // Fallback if negation turns everything to false
    if (!cook && !delivery && !dineout) {
      if (wantsCook) cook = true;
      if (wantsDelivery) delivery = true;
      if (wantsDineout) dineout = true;
    }
  }

  const targets: string[] = [];
  if (cook) targets.push("cook_node");
  if (delivery) targets.push("delivery_node");
  if (dineout) targets.push("dineout_node");

  // Default fallback: if empty, run all options
  return targets.length > 0 ? targets : ["cook_node", "delivery_node", "dineout_node"];
}
