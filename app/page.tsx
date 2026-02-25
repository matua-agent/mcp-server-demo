"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Terminal, MessageCircle, Zap, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type TraceEventType =
  | "initialize"
  | "tools_list"
  | "tool_call"
  | "tool_result"
  | "assistant_message"
  | "thinking";

interface TraceEvent {
  id: string;
  type: TraceEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

// ─── Suggested Prompts ────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "What time is it right now?",
  "Tell me about Harrison's background and research",
  "What is 149000 + 202000 and then divide by 2?",
  "Analyze the tone of: 'We need to fix this critical bug immediately or we will lose the client'",
  "What is MCP and why does it matter for enterprise AI?",
  "Tell me about Harrison's most impressive projects",
  "Calculate the average salary: 149000 and 202000",
  "What companies is Harrison applying to?",
];

// ─── Tool Colors ──────────────────────────────────────────────

const TOOL_COLORS: Record<string, string> = {
  get_current_datetime: "#f59e0b",
  search_knowledge_base: "#3b82f6",
  calculate: "#22c55e",
  analyze_text: "#a78bfa",
  get_protocol_info: "#06b6d4",
};

const TOOL_ICONS: Record<string, string> = {
  get_current_datetime: "⏰",
  search_knowledge_base: "🔍",
  calculate: "🧮",
  analyze_text: "📊",
  get_protocol_info: "📡",
};

// ─── Components ───────────────────────────────────────────────

function TraceEventCard({ event }: { event: TraceEvent }) {
  const [expanded, setExpanded] = useState(false);

  const renderContent = () => {
    switch (event.type) {
      case "initialize":
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--text-dim)] bg-[var(--muted)] px-2 py-0.5 rounded">
                initialize
              </span>
              <span className="text-xs text-[var(--text-muted)]">Protocol handshake</span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Client negotiated protocolVersion 2024-11-05 · capabilities: tools, roots
            </p>
            {expanded && (
              <div className="mt-2 space-y-2">
                <div>
                  <p className="text-xs font-mono text-[var(--accent-light)] mb-1">→ Request</p>
                  <pre className="text-xs font-mono text-[var(--text-dim)] bg-[var(--bg)] rounded p-2 overflow-x-auto">
                    {JSON.stringify((event.data as {request?: unknown}).request, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-mono text-[var(--tool-light)] mb-1">← Response</p>
                  <pre className="text-xs font-mono text-[var(--text-dim)] bg-[var(--bg)] rounded p-2 overflow-x-auto">
                    {JSON.stringify((event.data as {response?: unknown}).response, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );

      case "tools_list":
        const tools = ((event.data as {tools?: unknown}).tools as Array<{name: string; description: string}>) || [];
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--text-dim)] bg-[var(--muted)] px-2 py-0.5 rounded">
                tools/list
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {tools.length} tools registered
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {tools.map((t) => (
                <span
                  key={t.name}
                  className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{
                    background: `${TOOL_COLORS[t.name] || "#666"}22`,
                    color: TOOL_COLORS[t.name] || "#aaa",
                    border: `1px solid ${TOOL_COLORS[t.name] || "#666"}44`,
                  }}
                >
                  {TOOL_ICONS[t.name]} {t.name}
                </span>
              ))}
            </div>
            {expanded && (
              <div className="mt-2 space-y-2">
                {tools.map((t) => (
                  <div key={t.name} className="bg-[var(--bg)] rounded p-2">
                    <p className="text-xs font-mono" style={{ color: TOOL_COLORS[t.name] }}>
                      {TOOL_ICONS[t.name]} {t.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{t.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case "tool_call":
        const callData = event.data as {name: string; arguments: unknown; callId: string};
        const callColor = TOOL_COLORS[callData.name] || "#666";
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: `${callColor}22`, color: callColor, border: `1px solid ${callColor}44` }}
              >
                tools/call
              </span>
              <span className="text-xs font-mono" style={{ color: callColor }}>
                {TOOL_ICONS[callData.name]} {callData.name}
              </span>
            </div>
            <pre className="text-xs font-mono text-[var(--text-dim)] bg-[var(--bg)] rounded p-2 overflow-x-auto">
              {JSON.stringify(callData.arguments, null, 2)}
            </pre>
          </div>
        );

      case "tool_result":
        const resultData = event.data as {name: string; result: {content: Array<{text: string}>}; isError: boolean; durationMs: number; callId: string};
        const resultColor = resultData.isError ? "#ef4444" : (TOOL_COLORS[resultData.name] || "#666");
        const resultText = resultData.result?.content?.[0]?.text || "";
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: `${resultColor}22`, color: resultColor, border: `1px solid ${resultColor}44` }}
              >
                {resultData.isError ? "error" : "result"}
              </span>
              <span className="text-xs font-mono" style={{ color: resultColor }}>
                {TOOL_ICONS[resultData.name]} {resultData.name}
              </span>
              <span className="text-xs text-[var(--text-muted)] ml-auto">{resultData.durationMs}ms</span>
            </div>
            <p className="text-xs text-[var(--text-dim)] font-mono bg-[var(--bg)] rounded p-2 whitespace-pre-wrap">
              {resultText.length > 300 ? resultText.slice(0, 300) + "..." : resultText}
            </p>
          </div>
        );

      case "assistant_message":
        const msgData = event.data as {inputTokens: number; outputTokens: number; stopReason: string};
        return (
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-mono">
            <span>↑ {msgData.inputTokens} tokens in</span>
            <span>↓ {msgData.outputTokens} tokens out</span>
            <span className="ml-auto">{msgData.stopReason}</span>
          </div>
        );

      default:
        return (
          <pre className="text-xs font-mono text-[var(--text-muted)] overflow-x-auto">
            {JSON.stringify(event.data, null, 2)}
          </pre>
        );
    }
  };

  const isExpandable = event.type === "initialize" || event.type === "tools_list";

  return (
    <div
      className="rounded-lg p-3 animate-trace-in"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">{renderContent()}</div>
        {isExpandable && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors shrink-0 mt-0.5"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)] font-mono mt-1.5">
        {new Date(event.timestamp).toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        })}
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [traceEvents, setTraceEvents] = useState<TraceEvent[]>([]);
  const [currentResponse, setCurrentResponse] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [sessionTokens, setSessionTokens] = useState({ in: 0, out: 0 });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const traceEndRef = useRef<HTMLDivElement>(null);
  const traceCountRef = useRef(0);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentResponse]);

  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [traceEvents]);

  const addTraceEvent = useCallback((type: TraceEventType, data: Record<string, unknown>) => {
    const id = `${Date.now()}-${traceCountRef.current++}`;
    setTraceEvents((prev) => [...prev, { id, type, timestamp: Date.now(), data }]);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: ChatMessage = { role: "user", content: text.trim() };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setIsLoading(true);
      setCurrentResponse("");
      setShowSuggestions(false);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: newMessages }),
        });

        if (!res.ok || !res.body) throw new Error("API error");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);

              if (event.type === "text") {
                accumulated += event.content;
                setCurrentResponse(accumulated);
              } else if (event.type === "trace") {
                const te = event.event;
                addTraceEvent(te.type, te);
                // Update token counters
                if (te.type === "assistant_message") {
                  setSessionTokens((prev) => ({
                    in: prev.in + (te.inputTokens || 0),
                    out: prev.out + (te.outputTokens || 0),
                  }));
                }
              } else if (event.type === "done") {
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: accumulated },
                ]);
                setCurrentResponse("");
              } else if (event.type === "error") {
                throw new Error(event.message);
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
          },
        ]);
        setCurrentResponse("");
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, addTraceEvent]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "var(--bg)" }}
    >
      {/* Header */}
      <header
        className="shrink-0 px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse-dot" />
            <span className="text-xs font-mono text-[var(--text-muted)]">MCP server running</span>
          </div>
          <span className="text-[var(--border)]">·</span>
          <span className="text-xs font-mono text-[var(--text-muted)]">5 tools registered</span>
          <span className="text-[var(--border)]">·</span>
          <span className="text-xs font-mono text-[var(--text-muted)]">claude-haiku-4-5</span>
        </div>
        <div className="flex items-center gap-3">
          {(sessionTokens.in > 0 || sessionTokens.out > 0) && (
            <span className="text-xs font-mono text-[var(--text-muted)]">
              ↑{sessionTokens.in} ↓{sessionTokens.out} tokens
            </span>
          )}
          <a
            href="https://github.com/matua-agent/mcp-server-demo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors flex items-center gap-1"
          >
            GitHub <ExternalLink size={10} />
          </a>
          <a
            href="https://dudleyrode.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-[var(--accent-light)] hover:text-[var(--accent)] transition-colors"
          >
            dudleyrode.com
          </a>
        </div>
      </header>

      {/* Main: two-panel layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Chat Panel */}
        <div
          className="flex flex-col flex-1 min-w-0"
          style={{ borderRight: "1px solid var(--border)" }}
        >
          {/* Chat header */}
          <div
            className="shrink-0 px-4 py-2.5 flex items-center gap-2"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
          >
            <MessageCircle size={14} className="text-[var(--accent-light)]" />
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Chat</span>
            <span className="text-xs text-[var(--text-muted)] ml-auto">
              Ask anything — the protocol trace is on the right
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center pb-8">
                <div className="mb-6">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 mx-auto"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
                  >
                    <Zap size={28} style={{ color: "var(--accent-light)" }} />
                  </div>
                  <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--text)" }}>
                    MCP Server Demo
                  </h1>
                  <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
                    Watch the Model Context Protocol in action. Every tool call, JSON-RPC message,
                    and protocol event is shown live in the trace panel.
                  </p>
                </div>

                {showSuggestions && (
                  <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                    {SUGGESTED_PROMPTS.slice(0, 6).map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => sendMessage(prompt)}
                        className="text-left text-xs p-3 rounded-lg transition-colors hover:opacity-80"
                        style={{
                          background: "var(--surface2)",
                          border: "1px solid var(--border)",
                          color: "var(--text-dim)",
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex animate-slide-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed`}
                  style={
                    msg.role === "user"
                      ? {
                          background: "var(--accent)",
                          color: "white",
                        }
                      : {
                          background: "var(--surface2)",
                          border: "1px solid var(--border)",
                          color: "var(--text)",
                        }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {currentResponse && (
              <div className="flex justify-start animate-slide-in">
                <div
                  className="max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed"
                  style={{
                    background: "var(--surface2)",
                    border: "1px solid var(--accent)",
                    color: "var(--text)",
                  }}
                >
                  {currentResponse}
                  <span
                    className="inline-block w-0.5 h-3.5 ml-0.5 animate-pulse-dot"
                    style={{ background: "var(--accent-light)", verticalAlign: "middle" }}
                  />
                </div>
              </div>
            )}

            {isLoading && !currentResponse && (
              <div className="flex justify-start">
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex gap-1 items-center">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="text-xs text-[var(--text-muted)] ml-2 font-mono">
                      calling tools...
                    </span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div
            className="shrink-0 p-4"
            style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}
          >
            <div
              className="flex gap-2 rounded-xl p-2"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question — try asking about the time, Harrison's background, or a calculation..."
                rows={1}
                className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed"
                style={{
                  color: "var(--text)",
                  caretColor: "var(--accent-light)",
                  minHeight: "28px",
                  maxHeight: "120px",
                }}
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input.trim()}
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                style={{
                  background: input.trim() && !isLoading ? "var(--accent)" : "var(--muted)",
                  color: input.trim() && !isLoading ? "white" : "var(--text-muted)",
                }}
              >
                <Send size={14} />
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2 text-center font-mono">
              Enter to send · Shift+Enter for newline
            </p>
          </div>
        </div>

        {/* Right: Protocol Trace Panel */}
        <div
          className="flex flex-col shrink-0"
          style={{ width: "420px", background: "var(--surface)" }}
        >
          {/* Trace header */}
          <div
            className="shrink-0 px-4 py-2.5 flex items-center gap-2"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <Terminal size={14} className="text-[var(--tool-light)]" />
            <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
              Protocol Trace
            </span>
            {traceEvents.length > 0 && (
              <span
                className="text-xs font-mono px-2 py-0.5 rounded ml-auto"
                style={{
                  background: "var(--muted)",
                  color: "var(--text-muted)",
                }}
              >
                {traceEvents.length} events
              </span>
            )}
          </div>

          {/* Trace events */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {traceEvents.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center pb-8 px-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
                >
                  <Terminal size={20} style={{ color: "var(--text-muted)" }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--text-dim)" }}>
                  No events yet
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Send a message to watch the MCP protocol in action. Every JSON-RPC message will
                  appear here in real time.
                </p>
                <div className="mt-4 text-left w-full space-y-1">
                  <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                    You'll see:
                  </p>
                  {[
                    ["initialize", "Protocol handshake"],
                    ["tools/list", "Tool discovery"],
                    ["tools/call", "Tool execution"],
                    ["tool result", "Raw tool output"],
                    ["token usage", "Cost metrics"],
                  ].map(([label, desc]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span
                        className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "var(--muted)", color: "var(--text-dim)" }}
                      >
                        {label}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {traceEvents.map((event) => (
              <TraceEventCard key={event.id} event={event} />
            ))}
            <div ref={traceEndRef} />
          </div>

          {/* Trace footer */}
          <div
            className="shrink-0 px-4 py-3"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  JSON-RPC 2.0 over HTTP
                </span>
              </div>
              <a
                href="https://spec.modelcontextprotocol.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono flex items-center gap-1 transition-colors hover:opacity-70"
                style={{ color: "var(--tool-light)" }}
              >
                MCP spec <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
