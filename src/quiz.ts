// ---------------------------------------------------------------------------
// Recall drill question bank. Every question is authored against the section
// bodies in content.ts / content2.ts — if a section's claims change, re-check
// its questions here. Prompt, options, and explain are trusted HTML authored
// in this repo (same contract as Section.body).
// ---------------------------------------------------------------------------

export interface QuizQuestion {
  id: string; // stable key — SRS state in localStorage hangs off this
  sectionId: string; // Section.id this question drills
  prompt: string;
  options: string[];
  answer: number; // index into options
  explain: string; // shown after answering
}

export const questionBank: QuizQuestion[] = [
  // L0 — mental model ------------------------------------------------------
  {
    id: "mental-model-1",
    sectionId: "mental-model",
    prompt: "In Anthropic's taxonomy, what separates an <em>agent</em> from a <em>workflow</em>?",
    options: [
      "Workflows use one LLM call; agents use several",
      "In a workflow, code decides the steps; in an agent, the LLM directs its own process and tool use",
      "Agents run in production; workflows are for prototyping",
      "Workflows can't call tools",
    ],
    answer: 1,
    explain:
      "Workflows orchestrate LLMs through predefined code paths. Agents dynamically direct their own process and tool usage, deciding how to accomplish the task.",
  },
  {
    id: "mental-model-2",
    sectionId: "mental-model",
    prompt: "The single most repeated piece of advice in Anthropic's agent guidance is to…",
    options: [
      "always use the most capable model available",
      "start multi-agent and simplify later",
      "find the simplest solution possible, adding complexity only when it measurably helps",
      "fine-tune before you prompt",
    ],
    answer: 2,
    explain:
      "Many production \"agent\" problems are better solved by one well-prompted call with retrieval, or a fixed workflow. Autonomy trades latency and cost — make that trade deliberately.",
  },
  {
    id: "mental-model-3",
    sectionId: "mental-model",
    prompt: "The <em>augmented LLM</em> — the atomic building block of agentic systems — is an LLM plus which three capabilities?",
    options: [
      "Planning, reflection, critique",
      "Retrieval, tools, memory",
      "Routing, voting, chaining",
      "RAG, fine-tuning, distillation",
    ],
    answer: 1,
    explain:
      "Retrieval (pull in information), tools (act on the world), memory (persist state). An agent is that augmented LLM running in a loop: gather context → act → verify → repeat.",
  },

  // L1 — patterns -----------------------------------------------------------
  {
    id: "patterns-1",
    sectionId: "patterns",
    prompt: "Subtasks can't be predicted in advance and must be broken down and delegated dynamically. Which pattern is that?",
    options: ["Prompt chaining", "Parallelization", "Routing", "Orchestrator–workers"],
    answer: 3,
    explain:
      "Orchestrator–workers: a central LLM decomposes the task, delegates to workers, and synthesizes. Unlike parallelization, the subtasks aren't known ahead of time — this is the backbone of most serious multi-agent systems.",
  },
  {
    id: "patterns-2",
    sectionId: "patterns",
    prompt: "Parallelization comes in two flavors. Which pair?",
    options: [
      "Sectioning and voting",
      "Mapping and reducing",
      "Branching and merging",
      "Scatter and gather",
    ],
    answer: 0,
    explain:
      "Sectioning runs independent subtasks simultaneously (speed); voting runs the same task multiple times and aggregates (confidence via diverse attempts).",
  },
  {
    id: "patterns-3",
    sectionId: "patterns",
    prompt: "Evaluator–optimizer is the right pattern when…",
    options: [
      "latency is the top priority",
      "you have clear evaluation criteria and iteration genuinely improves output",
      "the task fans out into independent subtasks",
      "no automated evaluation is possible",
    ],
    answer: 1,
    explain:
      "One LLM generates, another evaluates against criteria and demands revisions in a loop — worth its cost only when the criteria are clear and iteration measurably helps.",
  },
  {
    id: "patterns-4",
    sectionId: "patterns",
    prompt: "Anthropic's practical advice on frameworks for these patterns:",
    options: [
      "Adopt the most popular orchestration framework for maintainability",
      "Implement directly against the API or Agent SDK — abstraction-heavy frameworks obscure prompts and tool calls, and debugging is most of the work",
      "Frameworks are required for routing and voting",
      "Only use frameworks that ship evals",
    ],
    answer: 1,
    explain:
      "The most successful systems use simple, composable patterns rather than heavy frameworks. Frameworks that hide the actual prompts and tool calls make debugging — which is most of the work — much harder.",
  },

  // L2 — context engineering ------------------------------------------------
  {
    id: "context-1",
    sectionId: "context",
    prompt: "\"Context rot\" is…",
    options: [
      "model weights degrading between versions",
      "accuracy degrading as the context window fills — every low-signal token competes with the signal",
      "stale data in a vector store",
      "prompts drifting as teams edit them",
    ],
    answer: 1,
    explain:
      "Attention is a finite budget. The goal is the smallest set of high-signal tokens that maximizes the likelihood of the outcome you want.",
  },
  {
    id: "context-2",
    sectionId: "context",
    prompt: "Just-in-time retrieval means…",
    options: [
      "pre-loading every relevant document before the run",
      "caching embeddings at request time",
      "giving the agent tools to fetch what it needs when it needs it — identifiers are cheap, contents are expensive",
      "retrying retrieval whenever the model hallucinates",
    ],
    answer: 2,
    explain:
      "Instead of front-loading everything, hand the agent search / file-read / glob-grep tools and let it load contents lazily. Paths and identifiers cost almost nothing; contents burn the attention budget.",
  },
  {
    id: "context-3",
    sectionId: "context",
    prompt: "Beyond parallelism, what's the key reason to push exploration into a subagent?",
    options: [
      "Subagents are cheaper per token",
      "Context isolation — failed attempts and noise never contaminate the main window; only a condensed summary returns",
      "Subagents can use tools the main agent can't",
      "It avoids rate limits",
    ],
    answer: 1,
    explain:
      "Token-hungry exploration happens in a separate context window that returns only a summary — the main context stays clean for reasoning.",
  },

  // L3 — tool design --------------------------------------------------------
  {
    id: "tool-design-1",
    sectionId: "tool-design",
    prompt: "How should tool names, descriptions, and parameter docs be treated?",
    options: [
      "As API documentation for humans",
      "As part of the prompt — engineered with the same care",
      "As metadata the model ignores",
      "As auto-generated boilerplate",
    ],
    answer: 1,
    explain:
      "Tool descriptions are prompts. The model reads them on every turn, and they steer which tool gets called and how.",
  },
  {
    id: "tool-design-2",
    sectionId: "tool-design",
    prompt: "A tool that dumps 50&nbsp;KB of JSON is a problem chiefly because…",
    options: [
      "it exceeds API response limits",
      "it costs more to execute",
      "JSON parsing becomes unreliable",
      "it floods the attention budget and degrades every subsequent decision",
    ],
    answer: 3,
    explain:
      "Tools should return concise, high-signal output — paginated, filtered, truncated with a pointer to get more. Context discipline (L2) applies to tool output too.",
  },
  {
    id: "tool-design-3",
    sectionId: "tool-design",
    prompt: "The \"bash is all you need\" lesson from the Claude Code team says…",
    options: [
      "shell access makes other tools unnecessary in every domain",
      "a general-purpose shell plus file tools often beats large collections of bespoke narrow tools, because models know bash deeply and compose it freely",
      "bash is safer than specialized tools",
      "MCP servers should be reimplemented as shell scripts",
    ],
    answer: 1,
    explain:
      "Add specialized tools only where bash genuinely can't do the job, or where you need control and safety.",
  },
  {
    id: "tool-design-4",
    sectionId: "tool-design",
    prompt: "Why do error messages deserve design attention in agent tools?",
    options: [
      "They're how agents self-correct — \"file is read-only, copy to /tmp first\" beats \"Error 13\"",
      "They're logged for compliance",
      "Models refuse to continue after generic errors",
      "They reduce token usage",
    ],
    answer: 0,
    explain:
      "Meaningful errors are the agent's feedback channel. A precise, actionable error turns a dead end into a recoverable step.",
  },

  // TB — toolbox ------------------------------------------------------------
  {
    id: "toolbox-1",
    sectionId: "toolbox",
    prompt: "Which built-in Claude Code tool is the multi-agent primitive?",
    options: ["<code>Bash</code>", "<code>TodoWrite</code>", "<code>Task</code>", "<code>Grep</code>"],
    answer: 2,
    explain:
      "<code>Task</code> spawns a subagent in its own context window — the primitive under both subagents (L4.4) and multi-agent architectures (L5).",
  },
  {
    id: "toolbox-2",
    sectionId: "toolbox",
    prompt: "The rule of thumb for choosing between bash, MCP, and custom API tools:",
    options: [
      "MCP for everything — it's the standard",
      "bash + file tools for local scriptable work; MCP for external systems with auth, state, or APIs; custom tools only when building your own agent with tight control of the surface",
      "custom tools first, bash as a fallback",
      "whichever minimizes token usage",
    ],
    answer: 1,
    explain:
      "Local and scriptable → bash. External systems bash can't cleanly reach → MCP. Your own agent needing a tight surface → custom API tools.",
  },
  {
    id: "toolbox-3",
    sectionId: "toolbox",
    prompt: "Why keep the set of connected MCP servers small?",
    options: [
      "Servers conflict over port bindings",
      "Every connected server's tool descriptions consume context on every turn",
      "MCP limits clients to five servers",
      "Auth tokens expire faster with more servers",
    ],
    answer: 1,
    explain:
      "Context engineering applies to tools too: each registered server's tool descriptions are paid for on every single turn, whether used or not.",
  },

  // L4 — Claude Code as a harness ------------------------------------------
  {
    id: "claude-code-1",
    sectionId: "claude-code",
    prompt: "Something must happen deterministically on every edit (say, run the formatter). Which primitive?",
    options: ["A CLAUDE.md instruction", "A skill", "A subagent", "A hook"],
    answer: 3,
    explain:
      "Hooks are executed by the harness, not interpreted by the model. If something must happen every time, it's a hook — CLAUDE.md instructions are suggestions the model weighs.",
  },
  {
    id: "claude-code-2",
    sectionId: "claude-code",
    prompt: "When should instructions move out of CLAUDE.md into a skill?",
    options: [
      "When they exceed 100 lines",
      "When they're situational — skills load only when the task matches, keeping the always-loaded file lean",
      "When multiple repos share them",
      "Never — CLAUDE.md should hold everything",
    ],
    answer: 1,
    explain:
      "CLAUDE.md competes for the attention budget on every turn. Repeatable, situational expertise belongs in skills, which cost ~zero tokens until needed. Rule of thumb: typed the same instructions twice → should have been a skill the first time.",
  },
  {
    id: "claude-code-3",
    sectionId: "claude-code",
    prompt: "\"Fork for breadth, stay inline for depth\" means…",
    options: [
      "use Git branches for experiments",
      "delegate scanning, discovery, and review — work that produces a summary — to subagents; keep reasoning-heavy sequential work in the main thread where you can steer it",
      "parallelize every task across subagents",
      "run broad tasks on cheaper models",
    ],
    answer: 1,
    explain:
      "Subagents shine on work that condenses to a summary. Deep sequential reasoning stays in the main thread, under your steering.",
  },
  {
    id: "claude-code-4",
    sectionId: "claude-code",
    prompt: "In the verification-rigor spectrum, what's the strongest level mentioned?",
    options: [
      "In-prompt \"keep going until tests pass\"",
      "A Stop hook that blocks completion until checks pass",
      "A second-opinion subagent that tries to <em>refute</em> the result",
      "The agent re-reading its own diff",
    ],
    answer: 2,
    explain:
      "The spectrum runs: in-prompt insistence → Stop hooks gating completion → an independent, fresh-context checker trying to refute. Don't let the agent doing the work grade itself.",
  },

  // L5 — multi-agent --------------------------------------------------------
  {
    id: "multi-agent-1",
    sectionId: "multi-agent",
    prompt: "What explained most of the multi-agent performance gain in Anthropic's research eval?",
    options: [
      "Better prompts in the subagents",
      "Token spend — parallel context windows let the system spend more tokens; usage alone explained ~80% of variance",
      "Specialized fine-tuned models per role",
      "Reduced hallucination from voting",
    ],
    answer: 1,
    explain:
      "Three factors explained ~95% of variance on BrowseComp; token usage alone ~80%. Multi-agent works largely because it parallelizes token spend across independent context windows.",
  },
  {
    id: "multi-agent-2",
    sectionId: "multi-agent",
    prompt: "Multi-agent architectures are a poor fit for…",
    options: [
      "breadth-first research across independent threads",
      "tightly coupled work where all agents need shared context — much coding falls here",
      "tasks with verifiable outputs",
      "anything involving web search",
    ],
    answer: 1,
    explain:
      "Architecture follows task structure: multi-agent wins when work decomposes into independent parallel threads. Tight coupling and shared context favor a single agent.",
  },
  {
    id: "multi-agent-3",
    sectionId: "multi-agent",
    prompt: "The token economics to remember:",
    options: [
      "agents ≈ chat; multi-agent ≈ 2× chat",
      "agents ≈ 4× chat; multi-agent ≈ 15× chat",
      "agents ≈ 10× chat; multi-agent ≈ 100× chat",
      "cost depends only on the model tier",
    ],
    answer: 1,
    explain:
      "Agents use roughly 4× the tokens of chat; multi-agent systems roughly 15×. Use them where task value justifies the spend.",
  },
  {
    id: "multi-agent-4",
    sectionId: "multi-agent",
    prompt: "What distinguishes agent teams (2026) from subagents?",
    options: [
      "Teams run on faster hardware",
      "Teammates communicate directly with each other — messaging, broadcasting, plan approval — instead of only reporting to a parent",
      "Teams share one context window",
      "Subagents can't use Git worktrees",
    ],
    answer: 1,
    explain:
      "Each teammate runs independently in its own context window and worktree, and unlike subagents, they talk to each other — good for parallel review where teammates challenge each other's findings.",
  },

  // L6 — Agent SDK ----------------------------------------------------------
  {
    id: "agent-sdk-1",
    sectionId: "agent-sdk",
    prompt: "The Claude Agent SDK is best described as…",
    options: [
      "a prompt template library",
      "the harness that powers Claude Code — loop, tools, permissions, compaction, subagents, hooks — exposed as a library",
      "a hosted fine-tuning service",
      "a coding-only toolkit",
    ],
    answer: 1,
    explain:
      "It's explicitly not just for coding agents: the same loop suits research, support, finance, and data agents. Managed Agents is the hosted counterpart.",
  },
  {
    id: "agent-sdk-2",
    sectionId: "agent-sdk",
    prompt: "The recommended design approach for SDK agent tooling:",
    options: [
      "sanitized, purpose-built abstractions per task",
      "give the agent the same tools a human would use — shell, filesystem, real APIs — and structure its working directory deliberately",
      "read-only tools until evals pass",
      "one mega-tool with subcommands",
    ],
    answer: 1,
    explain:
      "Real tools over sanitized abstractions, and the folder/file structure of the agent's working directory is itself context engineering (L2).",
  },
  {
    id: "agent-sdk-3",
    sectionId: "agent-sdk",
    prompt: "The recommended build sequence for your first agent:",
    options: [
      "framework → integrations → prompt tuning → launch",
      "one clear use case → map the loop (context, actions, verification) → minimal tools → real-data tests → complexity only when evals demand it",
      "multi-agent skeleton first, then fill in workers",
      "copy a cookbook example and scale it",
    ],
    answer: 1,
    explain:
      "Start from a single use case and let evals — not architecture ambition — drive added complexity.",
  },

  // L7 — production ---------------------------------------------------------
  {
    id: "production-1",
    sectionId: "production",
    prompt: "The core problem long-horizon harnesses solve:",
    options: [
      "models time out on long tasks",
      "each session starts with amnesia — so persist a goal ledger and handoff artifacts outside the context, with verification gates between sessions",
      "context windows are too expensive to fill",
      "Git can't track agent changes",
    ],
    answer: 1,
    explain:
      "Like shift workers with handoff notes: a persistent feature/goal ledger, progress files and decision logs written for the next session's cold start, and gates so regressions are caught before compounding.",
  },
  {
    id: "production-2",
    sectionId: "production",
    prompt: "<code>--dangerously-skip-permissions</code> is acceptable only…",
    options: [
      "on branches protected by CI",
      "when the task is read-only",
      "inside a container without credentials",
      "never, under any circumstances",
    ],
    answer: 2,
    explain:
      "Autonomous agents belong in sandboxes with scoped permissions — containers or VMs, network allowlists, read-only mounts for anything precious.",
  },
  {
    id: "production-3",
    sectionId: "production",
    prompt: "The standing defense against prompt injection for agents that read untrusted content:",
    options: [
      "filter inputs with a blocklist of phrases",
      "treat fetched content as data, and gate side-effecting tools behind allowlists, hooks, or human approval",
      "use a smaller model for untrusted input",
      "disable web access entirely",
    ],
    answer: 1,
    explain:
      "Any agent reading web pages, issues, or emails faces injection. Untrusted content is data, never instructions — and the side-effecting tools are where you put the gates.",
  },
  {
    id: "production-4",
    sectionId: "production",
    prompt: "Anthropic's guidance on getting started with agent evals:",
    options: [
      "wait until you have thousands of test cases",
      "start early with ~20 realistic tasks, judge end states rather than turn-by-turn paths, and keep human transcript review",
      "only measure latency and cost",
      "let the agent write and grade its own evals",
    ],
    answer: 1,
    explain:
      "Small samples reveal large effects in agentic systems. LLM-as-judge with a rubric scales grading; judging end states allows different valid paths to the outcome.",
  },

  // REF — sources -----------------------------------------------------------
  {
    id: "sources-1",
    sectionId: "sources",
    prompt: "The recommended first read of the Anthropic engineering canon:",
    options: [
      "How We Built Our Multi-Agent Research System",
      "Building Effective Agents",
      "Effective Context Engineering for AI Agents",
      "Claude Code Best Practices",
    ],
    answer: 1,
    explain:
      "\"Building Effective Agents\" anchors the whole ladder — the workflow/agent distinction, the augmented LLM, and the five composable patterns all come from it.",
  },
  {
    id: "sources-2",
    sectionId: "sources",
    prompt: "Where should version-specific claims (agent teams, nested subagents, CLI flags) be re-verified?",
    options: [
      "community blog roundups",
      "the official docs at code.claude.com/docs",
      "the model's own answer",
      "this guide is kept authoritative",
    ],
    answer: 1,
    explain:
      "This space moves monthly — the guide's own disclaimer says so. Officially documented behavior at code.claude.com/docs is the source of truth.",
  },
];
