// ============================================================
// MCP TOOL DEFINITIONS + IMPLEMENTATIONS
// These are the tools the AI agent can call via MCP
// ============================================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// ─── Tool Definitions ───────────────────────────────────────

export const TOOLS: MCPTool[] = [
  {
    name: "get_current_datetime",
    description:
      "Returns the current date and time in UTC. Use when the user asks about the current time, date, day of week, or anything time-related.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          description: "Output format: 'full' (default), 'date', 'time', or 'iso'",
          enum: ["full", "date", "time", "iso"],
        },
      },
    },
  },
  {
    name: "search_knowledge_base",
    description:
      "Search a curated knowledge base about Harrison Dudley-Rode — his background, projects, research, skills, and job search. Use when questions are asked about Harrison, his work, or his experience.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The search query. Be specific: e.g. 'published research papers', 'AI apps shipped', 'target companies'",
        },
        category: {
          type: "string",
          description: "Filter by category: 'background', 'projects', 'research', 'skills', 'job_search', or 'all'",
          enum: ["background", "projects", "research", "skills", "job_search", "all"],
        },
      },
      required: ["query"],
    },
  },
  {
    name: "calculate",
    description:
      "Evaluates a mathematical expression and returns the result. Use for any arithmetic, percentages, unit conversions, or numerical calculations. Do NOT use for estimation or approximate reasoning — only for exact computation.",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description:
            "A valid mathematical expression using standard operators: +, -, *, /, **, %, Math.sqrt(), Math.pow(), Math.round(), Math.floor(), Math.ceil(). Example: '(149000 + 202000) / 2' or 'Math.sqrt(144)'",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "analyze_text",
    description:
      "Analyzes a text snippet and returns: overall sentiment (positive/negative/neutral), tone descriptors, key themes, and a confidence score. Use when asked to analyze, evaluate, or describe the tone of a piece of text.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to analyze (max 1000 characters)",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "get_protocol_info",
    description:
      "Returns reference information about the Model Context Protocol (MCP) — its architecture, message types, use cases, and design principles. Use when questions are asked about MCP itself.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "Specific topic: 'overview', 'transport', 'message_types', 'tool_design', 'use_cases', or 'all'",
          enum: ["overview", "transport", "message_types", "tool_design", "use_cases", "all"],
        },
      },
      required: ["topic"],
    },
  },
];

// ─── Tool Implementations ────────────────────────────────────

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "get_current_datetime":
      return toolGetDatetime(args);
    case "search_knowledge_base":
      return toolSearchKnowledge(args);
    case "calculate":
      return toolCalculate(args);
    case "analyze_text":
      return toolAnalyzeText(args);
    case "get_protocol_info":
      return toolGetProtocolInfo(args);
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

// ─── Tool: get_current_datetime ───────────────────────────────

function toolGetDatetime(args: Record<string, unknown>): ToolResult {
  const format = (args.format as string) || "full";
  const now = new Date();

  const pad = (n: number) => String(n).padStart(2, "0");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"];

  let result: string;
  switch (format) {
    case "date":
      result = `${days[now.getUTCDay()]}, ${months[now.getUTCMonth()]} ${now.getUTCDate()}, ${now.getUTCFullYear()}`;
      break;
    case "time":
      result = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
      break;
    case "iso":
      result = now.toISOString();
      break;
    default:
      result = `${days[now.getUTCDay()]}, ${months[now.getUTCMonth()]} ${now.getUTCDate()}, ${now.getUTCFullYear()} at ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())} UTC`;
  }

  return { content: [{ type: "text", text: result }] };
}

// ─── Tool: search_knowledge_base ─────────────────────────────

const KNOWLEDGE_BASE = {
  background: `
Harrison Dudley-Rode — Background:
- Master of Science in Exercise and Health (MSEH), Auckland University of Technology (AUT), New Zealand
- Research Associate at SPRINZ (Sport Performance Research Institute NZ)
- AI Ops Lead at Supermix (Vancouver, BC, Canada) — manages LLM systems, ships AI products
- Published researcher: 2 peer-reviewed papers + 1 meta-analysis in exercise physiology
- Career arc: sports scientist → published researcher → AI engineer
- Location: Vancouver, BC (IEC working holiday visa)
- Availability: Open to new opportunities, actively interviewing
- Email: harrison@dudleyrode.com
`,
  research: `
Harrison's Published Research:
1. "Carbohydrate ingestion during prolonged exercise blunts the reduction in power output at the moderate-to-heavy intensity transition" (2024, European Journal of Applied Physiology)
   - DOI: 10.1007/s00421-024-05687-w
   - Shows carbohydrate ingestion preserves VT1 (first ventilatory threshold) during prolonged exercise
   
2. "Durability of the moderate-to-heavy intensity transition can be predicted using readily available markers of physiological decoupling" (2025, EJAP)
   - DOI: 10.1007/s00421-025-05815-0
   - Shows cardiac decoupling predicts exercise durability — the mathematical basis for the Durability Analyzer app
   
3. "Carbohydrate ingestion during prolonged exercise and net skeletal muscle glycogen utilization: a meta-analysis" (2026, Journal of Applied Physiology)
   - Meta-analysis on carbohydrate effects on glycogen during endurance exercise
`,
  projects: `
Harrison's Portfolio Apps (22 shipped in ~90 days):
1. Durability Analyzer — cycling power durability from peer-reviewed methodology, Garmin FIT upload
2. beef (Workout Tracker) — gym tracker: CV rep counting, PR detection (Epley e1RM), CTL/ATL/TSB
3. FinanceFlow — CSV bank import, AI categorization, spending analytics
4. Snow Forecast CA — 50+ ski resorts scored out of 10 (fresh snow, snowpack, bluebird)
5. NZ Adventure Planner — hiking conditions: Open-Meteo weather + GeoNet seismic + Mapbox
6. NZ Real Estate Explorer — MBIE rental data, Mapbox visualization, suburb analytics
7. Clip Finder — AI YouTube highlight detector, timestamps, TikTok/LinkedIn recommendations
8. Interview Prep AI — paste JD → 12-15 tailored Q&A in streaming
9. Collab Whiteboard — real-time multi-user canvas with WebSockets
10. Rep Sensor — MediaPipe real-time rep counting, client-side ML
11. Job Tracker — Kanban application tracker
12. Currency App — exchange rates with historical charts
13. Mission Control — AI ops dashboard: GitHub health, activity log, git standup
14. LLM Pipeline Demo — 4-stage orchestration: Extract → Analyze → Synthesize → Act (with timing)
15. RAG Pipeline Demo — BM25 from scratch, chunk scoring, grounded generation with citations
16. AI Code Reviewer — 6-dimension structured review, severity scoring, streaming fix generation
17. Contract Analyzer — legal doc AI: risk flags, missing clauses, negotiation leverage points
18. Company Intel — company research dossier: tech stack, culture, smart interview questions
19. Research Analyzer — paper breakdown: findings with confidence, methodology critique
20. AthleteIQ — sports science AI backed by Harrison's published papers
21. DocIQ — document Q&A with exact citation requirements
22. AI Tool Use Demo — agentic loop with 5 tools, full trace UI (this app!)
`,
  skills: `
Harrison's Technical Skills:
- Languages: TypeScript, JavaScript, Python
- Frameworks: Next.js 15/16, React 19, Tailwind CSS, Framer Motion
- AI/ML: Claude API (streaming, tool-calling, MCP), LLM orchestration, RAG pipelines, MediaPipe
- Backend: Supabase, REST APIs, WebSockets, Server-Sent Events
- Visualization: Recharts, Mapbox GL JS
- DevOps: Vercel, GitHub, Hetzner VPS, Tailscale
- Research: Statistical analysis, meta-analysis, exercise physiology measurement
`,
  job_search: `
Harrison's Job Search (Feb 2026):
Target companies:
1. Clio — Senior Developer, Enterprise AI (Vancouver/Burnaby, $149-202K CAD) — 9/10 fit
   - Requires: MCP server config, LLM orchestration, retrieval systems, legal domain
   - Harrison has: MCP blog post + demo, RAG demo, contract analyzer, doc intelligence
2. Sanctuary AI — ML Engineer (Vancouver)
3. OpusClip — Software Engineer, Core AI & Growth ($150-200K) — clip-finder directly in their domain
4. Palantir — FDAI role
5. Human Agency — Senior SWE

Harrison is actively applying, available immediately for interviews.
`,
};

function toolSearchKnowledge(args: Record<string, unknown>): ToolResult {
  const query = (args.query as string) || "";
  const category = (args.category as string) || "all";

  let content = "";

  if (category === "all") {
    content = Object.values(KNOWLEDGE_BASE).join("\n");
  } else {
    content = KNOWLEDGE_BASE[category as keyof typeof KNOWLEDGE_BASE] || "Category not found.";
  }

  // Simple keyword relevance: highlight relevant sections
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const lines = content.split("\n").filter((line) => {
    if (!line.trim()) return false;
    const lower = line.toLowerCase();
    return queryWords.some((w) => lower.includes(w));
  });

  const result = lines.length > 0 ? lines.join("\n") : content.substring(0, 500) + "...";

  return {
    content: [
      {
        type: "text",
        text: `Knowledge base results for "${query}" (category: ${category}):\n\n${result}`,
      },
    ],
  };
}

// ─── Tool: calculate ─────────────────────────────────────────

function toolCalculate(args: Record<string, unknown>): ToolResult {
  const expression = (args.expression as string) || "";

  // Safe evaluation: whitelist of allowed characters/functions
  const safe = expression.replace(/\s/g, "");
  const allowed = /^[0-9+\-*/().,%\s]|Math\.(sqrt|pow|round|floor|ceil|abs|min|max|log|PI)/g;

  // Rough safety check: reject anything that looks like code injection
  const cleaned = safe.replace(allowed, "");
  if (/[a-zA-Z]/.test(cleaned)) {
    return {
      content: [
        {
          type: "text",
          text: `Error: Expression contains unsafe characters. Only arithmetic operators and Math methods are allowed. Expression was: ${expression}`,
        },
      ],
      isError: true,
    };
  }

  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expression})`)();
    return {
      content: [
        {
          type: "text",
          text: `${expression} = ${typeof result === "number" ? result.toLocaleString() : result}`,
        },
      ],
    };
  } catch (e) {
    return {
      content: [
        {
          type: "text",
          text: `Error evaluating expression: ${e instanceof Error ? e.message : "Unknown error"}. Expression was: ${expression}`,
        },
      ],
      isError: true,
    };
  }
}

// ─── Tool: analyze_text ──────────────────────────────────────

function toolAnalyzeText(args: Record<string, unknown>): ToolResult {
  const text = (args.text as string) || "";
  if (!text.trim()) {
    return { content: [{ type: "text", text: "No text provided for analysis." }], isError: true };
  }

  const truncated = text.substring(0, 1000);
  const words = truncated.toLowerCase().split(/\s+/);

  // Simple heuristic sentiment analysis
  const positiveWords = ["great", "excellent", "amazing", "good", "positive", "success", "love",
    "impressive", "outstanding", "brilliant", "wonderful", "best", "perfect", "proud", "exciting",
    "innovative", "achieve", "accomplished", "exceptional", "valuable", "strong", "clear", "easy"];
  const negativeWords = ["bad", "poor", "terrible", "failure", "problem", "issue", "difficult",
    "complex", "wrong", "mistake", "error", "fail", "broken", "confused", "unclear", "hard",
    "challenge", "struggle", "concern", "risk", "warning", "danger"];
  const technicalWords = ["algorithm", "api", "data", "system", "model", "code", "function",
    "protocol", "architecture", "performance", "latency", "token", "embedding", "vector", "neural",
    "training", "inference", "schema", "endpoint", "stream", "async", "query", "index"];
  const formalWords = ["therefore", "however", "furthermore", "additionally", "consequently",
    "regarding", "pursuant", "hereby", "whereas", "notwithstanding", "shall", "obligation"];

  let posScore = 0, negScore = 0, techScore = 0, formalScore = 0;
  words.forEach((w) => {
    if (positiveWords.some((p) => w.includes(p))) posScore++;
    if (negativeWords.some((n) => w.includes(n))) negScore++;
    if (technicalWords.some((t) => w.includes(t))) techScore++;
    if (formalWords.some((f) => w.includes(f))) formalScore++;
  });

  const total = words.length;
  const sentiment = posScore > negScore + 1 ? "positive" : negScore > posScore + 1 ? "negative" : "neutral";
  const confidence = Math.min(
    Math.round((Math.abs(posScore - negScore) / Math.max(total * 0.05, 1)) * 100),
    92
  );

  const tones: string[] = [];
  if (techScore / total > 0.04) tones.push("technical");
  if (formalScore / total > 0.02) tones.push("formal");
  if (text.includes("?")) tones.push("inquisitive");
  if (text.includes("!")) tones.push("emphatic");
  if (techScore === 0 && formalScore === 0) tones.push("conversational");

  const themes = [];
  if (techScore > 2) themes.push("technology/engineering");
  if (words.some((w) => ["research", "study", "data", "analysis", "results"].includes(w))) themes.push("analytical");
  if (words.some((w) => ["build", "ship", "product", "deploy", "launch"].includes(w))) themes.push("product development");
  if (words.some((w) => ["ai", "model", "llm", "claude", "gpt"].includes(w))) themes.push("artificial intelligence");

  const result = {
    sentiment,
    confidence: `${Math.max(confidence, 45)}%`,
    tones: tones.length > 0 ? tones : ["neutral"],
    themes: themes.length > 0 ? themes : ["general"],
    stats: {
      wordCount: total,
      positivePhrases: posScore,
      negativePhrases: negScore,
      technicalTerms: techScore,
    },
  };

  return {
    content: [
      {
        type: "text",
        text: `Text Analysis Results:\n${JSON.stringify(result, null, 2)}`,
      },
    ],
  };
}

// ─── Tool: get_protocol_info ─────────────────────────────────

const PROTOCOL_INFO = {
  overview: `
Model Context Protocol (MCP) — Overview:
MCP is an open protocol developed by Anthropic that standardizes how AI applications communicate with external tools, data sources, and services. It defines a client-server architecture where:
- MCP Servers expose tools, resources, and prompts
- MCP Clients (AI applications) discover and use these capabilities
- The protocol is model-agnostic: any LLM can use MCP tools

Key benefit: MCP separates tool capability from AI model. You build a tool once, and any MCP-compatible AI can use it. This is "USB for AI capabilities."
`,
  transport: `
MCP Transport Layers:
1. stdio — Standard input/output streams (for local MCP servers, CLI tools)
   - Server reads JSON-RPC messages from stdin, writes responses to stdout
   - Used for: local dev tools, filesystem access, code execution

2. HTTP + SSE (Server-Sent Events) — For remote/web MCP servers
   - Client sends requests via HTTP POST
   - Server streams responses via SSE
   - Used for: web services, APIs, cloud-deployed tools
   - This demo uses HTTP transport for web accessibility

3. WebSocket — Bidirectional for real-time servers (in development)
`,
  message_types: `
MCP JSON-RPC 2.0 Message Types:
1. initialize — Client announces capabilities, server responds with its capabilities + tool list
   Request: {method: "initialize", params: {protocolVersion, capabilities, clientInfo}}
   Response: {protocolVersion, capabilities, serverInfo}

2. tools/list — Client requests available tools
   Request: {method: "tools/list"}
   Response: {tools: [{name, description, inputSchema}]}

3. tools/call — Client calls a specific tool
   Request: {method: "tools/call", params: {name, arguments}}
   Response: {content: [{type: "text", text: "..."}], isError?: boolean}

4. resources/list, resources/read — Access data resources (files, DB, APIs)
5. prompts/list, prompts/get — Access pre-defined prompt templates
6. ping — Health check
`,
  tool_design: `
MCP Tool Design Principles:
1. Single responsibility — each tool does one thing well
2. Precise descriptions — the description is what the AI uses to decide when to call the tool
   - Bad: "calculator" with description "does math"
   - Good: "calculate" with description "evaluates mathematical expressions; use when exact arithmetic is needed rather than approximate reasoning"
3. Explicit constraints — say what NOT to use the tool for
4. Typed inputs — JSON Schema enforces parameter types and required fields
5. Structured errors — return errors in isError:true responses, not exceptions
6. Idempotency — tool calls with same args should return same result (where possible)
`,
  use_cases: `
MCP Use Cases:
- Enterprise document processing: connect AI to document repositories, legal databases, contracts
- Code intelligence: give AI access to codebase search, test runners, linters
- Data analysis: connect AI to databases, analytics APIs, spreadsheets
- Personal agents: calendar, email, task management, web search
- Developer tools: package registries, documentation search, CI/CD systems
- Scientific research: instrument data, literature search, calculation engines

MCP is directly relevant to:
- Clio's Enterprise AI team (document intelligence, legal databases)
- Any AI system that needs verified, real-time, or external data
`,
};

function toolGetProtocolInfo(args: Record<string, unknown>): ToolResult {
  const topic = (args.topic as string) || "overview";

  let content: string;
  if (topic === "all") {
    content = Object.values(PROTOCOL_INFO).join("\n");
  } else {
    content = PROTOCOL_INFO[topic as keyof typeof PROTOCOL_INFO] || "Topic not found.";
  }

  return { content: [{ type: "text", text: content.trim() }] };
}
