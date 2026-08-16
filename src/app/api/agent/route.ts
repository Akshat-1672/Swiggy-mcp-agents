import { NextRequest } from "next/server";
import { compiledWorkflow } from "@/agents/graph";
import { HumanMessage } from "@langchain/core/messages";

export const maxDuration = 60; // Seconds

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { prompt, location, token, budgetCap } = body;

    if (!prompt || !location || !token) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: prompt, location, token" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Stream the LangGraph execution
          const eventStream = await compiledWorkflow.stream(
            {
              messages: [new HumanMessage(prompt)],
              userCoordinates: location,
              budgetCap: budgetCap ? Number(budgetCap) : undefined,
              quotes: [],
              errors: [],
            },
            { configurable: { userToken: token } }
          );

          for await (const chunk of eventStream) {
            const activeNode = Object.keys(chunk)[0];
            const rawPayload = (chunk as any)[activeNode];
            const eventData = JSON.stringify({ node: activeNode, stateUpdate: rawPayload });
            controller.enqueue(encoder.encode(`data: ${eventData}\n\n`));
          }
        } catch (err: any) {
          console.error("[API Stream Error]", err);
          const errData = JSON.stringify({ error: err.message || "Execution error in graph stream" });
          controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
        } finally {
          controller.close();
        }
      },
      cancel() {
        console.log("[API Stream] Connection cancelled by client");
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[API Endpoint Error]", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
