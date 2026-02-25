import { TOOLS, executeTool } from "@/lib/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const ANTHROPIC_BASE = "https://api.anthropic.com/v1/messages";

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

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | unknown[];
};

async function callAnthropic(messages: AnthropicMessage[], tools: AnthropicTool[]) {
  const res = await fetch(ANTHROPIC_BASE, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }

  return res.json();
}

function encodeEvent(event: object): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event) + "\n");
}

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
            jsonrpc: "2.0", id: 1, method: "initialize",
            params: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: {}, roots: {} },
              clientInfo: { name: "mcp-server-demo-client", version: "1.0.0" },
            },
          };
          const initResponse = {
            jsonrpc: "2.0", id: 1,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: { tools: { listChanged: false } },
              serverInfo: { name: "mcp-server-demo", version: "1.0.0" },
            },
          };
          enqueue({ type: "trace", event: { type: "initialize", request: initRequest, response: initResponse } });

          // ─── MCP Phase 2: List Tools ─────────────────────────
          enqueue({ type: "trace", event: { type: "tools_list", tools: TOOLS } });
          await new Promise((r) => setTimeout(r, 150));

          // ─── MCP Phase 3: Agentic Tool Loop ─────────────────
          const anthropicTools: AnthropicTool[] = TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema as Record<string, unknown>,
          }));

          const conversationMessages: AnthropicMessage[] = messages.map(
            (m: { role: string; content: string }) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })
          );

          let callCount = 0;
          let continueLoop = true;

          while (continueLoop && callCount < 8) {
            callCount++;

            const response = await callAnthropic(conversationMessages, anthropicTools);

            // Log token usage
            enqueue({
              type: "trace",
              event: {
                type: "assistant_message",
                inputTokens: response.usage?.input_tokens ?? 0,
                outputTokens: response.usage?.output_tokens ?? 0,
                stopReason: response.stop_reason,
              },
            });

            const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
            let textContent = "";

            for (const block of response.content ?? []) {
              if (block.type === "text") {
                textContent += block.text;
              } else if (block.type === "tool_use") {
                toolCalls.push({ id: block.id, name: block.name, input: block.input });
              }
            }

            // Stream text word by word
            if (textContent) {
              const words = textContent.split(" ");
              for (const word of words) {
                enqueue({ type: "text", content: word + " " });
                await new Promise((r) => setTimeout(r, 12));
              }
            }

            if (toolCalls.length === 0 || response.stop_reason === "end_turn") {
              continueLoop = false;
              break;
            }

            // Add assistant response to history
            conversationMessages.push({ role: "assistant", content: response.content });

            // Execute tools
            const toolResults: unknown[] = [];

            for (const toolCall of toolCalls) {
              enqueue({
                type: "trace",
                event: { type: "tool_call", callId: toolCall.id, name: toolCall.name, arguments: toolCall.input },
              });

              const startTime = Date.now();
              const result = await executeTool(toolCall.name, toolCall.input);
              const durationMs = Date.now() - startTime;

              enqueue({
                type: "trace",
                event: {
                  type: "tool_result",
                  callId: toolCall.id,
                  name: toolCall.name,
                  result,
                  isError: result.isError ?? false,
                  durationMs,
                },
              });

              toolResults.push({
                type: "tool_result",
                tool_use_id: toolCall.id,
                content: result.content,
                is_error: result.isError,
              });

              await new Promise((r) => setTimeout(r, 80));
            }

            conversationMessages.push({ role: "user", content: toolResults });
          }

          enqueue({ type: "done" });
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          enqueue({ type: "error", message: msg });
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
