import Anthropic from "@anthropic-ai/sdk";
import { TOOLS, executeTool } from "@/lib/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to real tools via the Model Context Protocol (MCP).

When answering questions:
- Use tools proactively when they can provide accurate, real-time, or specific information
- For time/date questions → use get_current_datetime
- For questions about Harrison → use search_knowledge_base
- For any math or calculations → use calculate (never estimate arithmetic)
- For text analysis requests → use analyze_text
- For MCP/protocol questions → use get_protocol_info
- Chain multiple tool calls when needed (e.g., search + calculate)

After using tools, synthesize the results into a clear, conversational response. Don't just repeat the raw tool output — explain what it means.

The user is watching the MCP protocol trace in real-time. They can see every tool call and response. Your tool usage IS the demonstration.`;

// Stream event encoding
function encodeEvent(event: object): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event) + "\n");
}

type MCPTraceEvent =
  | { type: "initialize"; request: object; response: object }
  | { type: "tools_list"; tools: object[] }
  | { type: "tool_call"; callId: string; name: string; arguments: object }
  | { type: "tool_result"; callId: string; name: string; result: object; isError: boolean; durationMs: number }
  | { type: "assistant_message"; inputTokens: number; outputTokens: number }
  | { type: "thinking"; text: string };

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const enqueue = (event: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        };

        try {
          // ─── MCP Phase 1: Initialize ─────────────────────────
          const initRequest = {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {}, roots: {} },
              clientInfo: { name: "mcp-server-demo-client", version: "1.0.0" },
            },
          };
          const initResponse = {
            jsonrpc: "2.0",
            id: 1,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: { listChanged: false } },
              serverInfo: { name: "mcp-server-demo", version: "1.0.0" },
            },
          };
          const traceInit: MCPTraceEvent = { type: "initialize", request: initRequest, response: initResponse };
          enqueue({ type: "trace", event: traceInit });

          // ─── MCP Phase 2: List Tools ─────────────────────────
          const toolsListRequest = { jsonrpc: "2.0", id: 2, method: "tools/list" };
          const toolsListResponse = { jsonrpc: "2.0", id: 2, result: { tools: TOOLS } };
          const traceList: MCPTraceEvent = { type: "tools_list", tools: TOOLS };
          enqueue({ type: "trace", event: traceList });

          // Brief delay to make the trace feel live
          await new Promise((r) => setTimeout(r, 150));

          // ─── MCP Phase 3: Agentic Tool Loop ─────────────────
          const anthropicTools: Anthropic.Tool[] = TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
          }));

          const conversationMessages: Anthropic.MessageParam[] = messages.map(
            (m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })
          );

          let callCount = 0;
          let continueLoop = true;

          while (continueLoop && callCount < 8) {
            callCount++;

            // Non-streaming call to get structured tool use decisions
            const response = await client.messages.create({
              model: "claude-3-5-haiku-20241022",
              max_tokens: 2048,
              system: SYSTEM_PROMPT,
              tools: anthropicTools,
              messages: conversationMessages,
            });

            // Log token usage
            enqueue({
              type: "trace",
              event: {
                type: "assistant_message",
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
                stopReason: response.stop_reason,
              },
            });

            // Collect text and tool calls from this response
            const toolCalls: Anthropic.ToolUseBlock[] = [];
            let textContent = "";

            for (const block of response.content) {
              if (block.type === "text") {
                textContent += block.text;
              } else if (block.type === "tool_use") {
                toolCalls.push(block);
              }
            }

            // Stream any text content
            if (textContent) {
              // Stream text word by word for visual effect
              const words = textContent.split(" ");
              for (const word of words) {
                enqueue({ type: "text", content: word + " " });
                await new Promise((r) => setTimeout(r, 12));
              }
            }

            // Process tool calls
            if (toolCalls.length === 0 || response.stop_reason === "end_turn") {
              continueLoop = false;
              break;
            }

            // Add assistant's response to conversation
            conversationMessages.push({
              role: "assistant",
              content: response.content,
            });

            // Execute each tool call
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const toolCall of toolCalls) {
              const callId = toolCall.id;
              const toolName = toolCall.name;
              const toolArgs = toolCall.input as Record<string, unknown>;

              // Emit tool call trace
              enqueue({
                type: "trace",
                event: {
                  type: "tool_call",
                  callId,
                  name: toolName,
                  arguments: toolArgs,
                },
              });

              // Execute the tool
              const startTime = Date.now();
              const result = await executeTool(toolName, toolArgs);
              const durationMs = Date.now() - startTime;

              // Emit tool result trace
              enqueue({
                type: "trace",
                event: {
                  type: "tool_result",
                  callId,
                  name: toolName,
                  result,
                  isError: result.isError ?? false,
                  durationMs,
                },
              });

              toolResults.push({
                type: "tool_result",
                tool_use_id: callId,
                content: result.content,
                is_error: result.isError,
              });

              // Small delay between tool executions for visual clarity
              await new Promise((r) => setTimeout(r, 80));
            }

            // Add tool results to conversation
            conversationMessages.push({
              role: "user",
              content: toolResults,
            });
          }

          enqueue({ type: "done" });
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          const errType = err?.constructor?.name ?? "UnknownError";
          const keyPresent = !!process.env.ANTHROPIC_API_KEY;
          enqueue({
            type: "error",
            message: `${errType}: ${msg} | key_present=${keyPresent}`,
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
