import { StateGraph, START, END } from "@langchain/langgraph";
import { MealStateAnnotation } from "./state";
import { fanOutRouter } from "./nodes/router";
import { cookNode } from "./nodes/cook";
import { deliveryNode } from "./nodes/delivery";
import { dineoutNode } from "./nodes/dineout";
import { synthesizerNode } from "./nodes/synthesizer";

const graph = new StateGraph(MealStateAnnotation)
  .addNode("cook_node", cookNode)
  .addNode("delivery_node", deliveryNode)
  .addNode("dineout_node", dineoutNode)
  .addNode("synthesizer", synthesizerNode)
  .addConditionalEdges(START, fanOutRouter)
  .addEdge("cook_node", "synthesizer")
  .addEdge("delivery_node", "synthesizer")
  .addEdge("dineout_node", "synthesizer")
  .addEdge("synthesizer", END);

export const compiledWorkflow = graph.compile();
