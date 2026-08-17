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
  {
    id: "patterns-5",
    sectionId: "patterns",
    prompt: "In the pattern topologies, what does a dashed fan-out edge into a dashed box mean?",
    options: [
      "An optional step that may be skipped",
      "Work leaving for its own isolated context window",
      "A retry after a failure",
      "A cheaper model handling the step",
    ],
    answer: 1,
    explain:
      "Dashed fan-out = work handed to a fresh, isolated window (parallelization's shards, orchestrator's workers). Solid arrows are control moving along a fixed path, green boxes are checks that code — not a model — performs, and a dotted return edge is where a loop closes.",
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

  // PW — prompt formats & token cost ----------------------------------------
  {
    id: "prompt-formats-1",
    sectionId: "prompt-formats",
    prompt: "What are the three jobs that justify adding structure to a prompt?",
    options: [
      "Compressing, encrypting, and versioning the prompt",
      "Delimiting, addressing, and signalling shape",
      "Escaping, validating, and schema-checking the input",
      "Highlighting, summarizing, and paraphrasing the instruction",
    ],
    answer: 1,
    explain:
      "Delimiting (where the pasted data ends and your instruction begins), addressing (naming a region so you can refer to it), and signalling shape (ordered list, table, literal block). Structure doing none of the three is decoration you rent by the turn.",
  },
  {
    id: "prompt-formats-2",
    sectionId: "prompt-formats",
    prompt: "You want a machine-readable object back from the model. What's the recommended way to get it?",
    options: [
      "Ask for JSON in the prompt and add a JSON example",
      "Constrain it — structured outputs (<code>output_config.format</code>) or a tool's input schema",
      "Wrap the request in <code>&lt;json&gt;</code> tags",
      "Prefill the assistant turn with an opening brace",
    ],
    answer: 1,
    explain:
      "JSON is a fine <em>output</em> format and a poor <em>input</em> one. When the shape matters, use the mechanisms built to constrain it rather than asking politely in prose — and note that assistant prefill is rejected on current models.",
  },
  {
    id: "prompt-formats-3",
    sectionId: "prompt-formats",
    prompt: "Your prompt-length estimate has to be right. Where does the exact number come from?",
    options: [
      "chars ÷ 4",
      "An OpenAI tokenizer such as tiktoken",
      "<code>POST /v1/messages/count_tokens</code> for the model you're calling",
      "The word count times 1.3",
    ],
    answer: 2,
    explain:
      "Tokenization is model-specific — Claude generations differ from each other, and other vendors' tokenizers are simply wrong here (an OpenAI tokenizer undercounts Claude by roughly 15–20% on prose, more on code). Estimates are for arguing about format; <code>count_tokens</code> is for deciding.",
  },
  {
    id: "prompt-formats-4",
    sectionId: "prompt-formats",
    prompt: "Which prompt is worth optimizing for length first?",
    options: [
      "A one-off analysis request, because it's the longest",
      "Standing context — a CLAUDE.md or tool description, paid on every turn",
      "Whichever contains the most examples",
      "The final message, because it's closest to the answer",
    ],
    answer: 1,
    explain:
      "A message sent once at 3,000 tokens costs 3,000 tokens. A CLAUDE.md or tool description at 3,000 tokens costs that on every turn of every session — which is why the bench flags length there and nowhere else.",
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

  // L8 — the adversary --------------------------------------------------------
  {
    id: "adversarial-1",
    sectionId: "adversarial",
    prompt: "Why is prompt injection described as <em>structural</em> rather than a bug to be patched?",
    options: [
      "Because current models are undertrained on adversarial data",
      "Because a context window is one flat token stream — nothing in it marks which sentences carry the operator's authority",
      "Because tool APIs lack authentication",
      "Because agents run with too much memory",
    ],
    answer: 1,
    explain:
      "Operator instructions, memory files, tool descriptions and a stranger's issue all arrive as the same kind of thing: text. The model follows the most relevant instruction it can see. The fix lives in the harness — provenance, gates, blast radius — not in the model's willpower.",
  },
  {
    id: "adversarial-2",
    sectionId: "adversarial",
    prompt: "The <em>lethal trifecta</em> is the combination of…",
    options: [
      "long context, high temperature, and autonomy",
      "access to private data, exposure to untrusted content, and a way to communicate outward",
      "shell access, network access, and file writes",
      "subagents, memory files, and MCP servers",
    ],
    answer: 1,
    explain:
      "Any two are survivable; all three in one context is an exfiltration channel. \"Communicate outward\" is broader than it sounds — an image URL or any tool argument reaching a third party is a channel, and the data leaves in the address with nothing erroring.",
  },
  {
    id: "adversarial-3",
    sectionId: "adversarial",
    prompt: "Why does no amount of downstream framing protect you from a poisoned MCP tool description?",
    options: [
      "Because tool descriptions are encrypted in transit",
      "Because tool descriptions load into the system prompt at startup — they are instructions the agent is configured with, not content it reads",
      "Because MCP servers run with root privileges",
      "Because the model caches descriptions across sessions",
    ],
    answer: 1,
    explain:
      "Framing fetched content as data works because that content is data. A tool description is instruction by design. Every integration you install is a write to your system prompt on someone else's release schedule — the controls are pinning and diffing.",
  },
  {
    id: "adversarial-4",
    sectionId: "adversarial",
    prompt: "What makes an injection that reaches a memory file (CLAUDE.md, a skill) categorically worse than a one-shot injection?",
    options: [
      "Memory files are loaded with higher priority than user messages",
      "It persists — surviving /clear, restarts, and everyone who joins the repo afterwards, long after the source that planted it is gone",
      "It cannot be detected by transcript logging",
      "It is executed before the model sees the task",
    ],
    answer: 1,
    explain:
      "A one-shot injection is an incident; an injection in persistent memory is a policy change. Treat memory files as executable — because to the agent they are — which means reviewing them like source and not letting a run silently self-edit them.",
  },
  {
    id: "adversarial-5",
    sectionId: "adversarial",
    prompt: "In the guide's threat model, why is human review a weak general answer?",
    options: [
      "Reviewers cannot read agent-generated diffs",
      "It is strong against a suspicious diff and weak against a boring one — and an approval gate that fires forty times a day gets routed around",
      "Approval gates are not supported by most harnesses",
      "Humans approve faster than agents can act",
    ],
    answer: 1,
    explain:
      "A green bot PR titled \"chore: rotate deploy key\", matching an issue that reads like it came from the team, gets merged. Approval is also the most expensive control by friction, and controls people switch off are not controls.",
  },
  {
    id: "adversarial-6",
    sectionId: "adversarial",
    prompt: "Detection controls — transcripts and anomaly alerting — sit where in the scoring?",
    options: [
      "Equal to blocking controls, since both end the incident",
      "Half credit: they bound the blast radius but never cut the chain",
      "Zero, since they change nothing about the attack",
      "Above blocking controls, since they catch unknown attacks",
    ],
    answer: 1,
    explain:
      "Knowing an hour later beats never and loses to no. Detection is the cheapest family and the only one that catches what your threat list missed — but a posture built on it alone contains nothing.",
  },
  {
    id: "adversarial-7",
    sectionId: "adversarial",
    prompt: "Why does the range price controls in <em>friction</em> rather than money?",
    options: [
      "Because security tooling is mostly free",
      "Because the real constraint is standing cost in people's days — and a control that gets switched off is not a control",
      "Because friction is easier to measure than cost",
      "Because compute cost is already covered by the pattern lab",
    ],
    answer: 1,
    explain:
      "The budget is what turns \"harden everything\" into a real decision. It forces the actual skill: picking the fewest controls that cut the most chains for this particular deployment, which requires knowing which link each control cuts.",
  },
  {
    id: "adversarial-8",
    sectionId: "adversarial",
    prompt: "A worker subagent fetches a page containing injected instructions and repeats them in its summary. What is the failure the orchestrator suffers?",
    options: [
      "Context rot from the worker's oversized report",
      "The injection is laundered through a trusted intermediary — nothing distinguishes what the worker concluded from what the page told it to say",
      "The worker exceeded its tool allowlist",
      "The orchestrator's compaction dropped the provenance metadata",
    ],
    answer: 1,
    explain:
      "Fan-out multiplies trust boundaries; every worker is a new one. The orchestrator holds the write permissions the worker did not, which is exactly why a worker's report has to be read as a claim from elsewhere rather than as an order.",
  },

  // L9 — hardening in practice ----------------------------------------------
  {
    id: "hardening-1",
    sectionId: "hardening",
    prompt: "What separates a <em>control</em> from a <em>mitigation</em> in this section's terms?",
    options: [
      "A control is documented; a mitigation is informal",
      "A control is enforced by something that is not the model; a mitigation only raises the cost of an attack",
      "A control is free; a mitigation costs friction",
      "A control blocks; a mitigation detects",
    ],
    answer: 1,
    explain:
      "If the mechanism is a sentence in a prompt, it raises the attacker's cost. If it is a permission rule, a hook process, or a kernel boundary, it bounds the attack. Both are worth having — only one is worth counting.",
  },
  {
    id: "hardening-2",
    sectionId: "hardening",
    prompt: "You commit a strict <code>permissions.deny</code> list in the project's <code>.claude/settings.json</code>. What have you actually guaranteed?",
    options: [
      "Nothing beyond a floor — permission rules merge across scopes, so user and local settings can still widen the surface unless managed settings lock them",
      "That no developer can use any tool outside the allow list",
      "That the rules override the user's own settings file",
      "That the rules apply only in CI",
    ],
    answer: 0,
    explain:
      "Rules merge rather than override, and a project file cannot remove what a user or local file adds. Org policy is advisory until <code>allowManagedPermissionRulesOnly</code> is set in managed settings, at which point only managed rules are honoured.",
  },
  {
    id: "hardening-3",
    sectionId: "hardening",
    prompt: "Your <code>PreToolUse</code> hook crashes on the CI image because <code>jq</code> isn't installed. What happens to the tool calls it was supposed to guard?",
    options: [
      "They are blocked — a failed hook fails closed",
      "They are queued until a human approves them",
      "They proceed through the normal permission flow; a hook that reports no decision has not denied anything",
      "The session aborts with a hook error",
    ],
    answer: 2,
    explain:
      "Exit 0 with no output means \"no decision\", which is the right default and also means a broken hook fails open quietly. Exit 2 is what blocks, feeding stderr back to the model. Test the deny path in the environment the agent actually runs in.",
  },
  {
    id: "hardening-4",
    sectionId: "hardening",
    prompt: "Why is the OS sandbox a different kind of control from a permission rule?",
    options: [
      "It is faster to evaluate",
      "It covers every tool, where permission rules only cover Bash",
      "It is enforced on the running process and its children, so it holds regardless of what the model chose to run",
      "It cannot be configured, so nobody can weaken it",
    ],
    answer: 2,
    explain:
      "Permission rules are a decision about a command string before it runs. The sandbox is a kernel boundary on the process, so it holds even when an allowed command turns out to do more than its name suggested. The scope is the reverse of option two: the sandbox covers Bash subprocesses, while permission rules apply to every tool.",
  },
  {
    id: "hardening-5",
    sectionId: "hardening",
    prompt: "The sandbox is enabled with default filesystem settings. Can a sandboxed command read <code>~/.ssh</code>?",
    options: [
      "No — the sandbox confines reads to the working directory",
      "Yes — writes are confined by default but reads cover the whole machine, so credential paths need an explicit deny",
      "No — credential paths are on a built-in deny list",
      "Only if the agent asks for approval first",
    ],
    answer: 1,
    explain:
      "Default writes are the working directory plus the session temp directory; default reads are the whole computer, <code>~/.ssh</code> and <code>~/.aws/credentials</code> included. There is no built-in credential deny list — <code>sandbox.credentials</code> or <code>filesystem.denyRead</code> is what makes the workspace secret-free.",
  },
  {
    id: "hardening-6",
    sectionId: "hardening",
    prompt: "Why is <code>github.com</code> a poor entry on an egress allowlist?",
    options: [
      "It resolves to too many IP addresses to filter reliably",
      "It is a wildcard, which the proxy rejects",
      "It authorises gists, issue comments and commits — a full exfiltration channel, allowlisted",
      "It forces the proxy to terminate TLS",
    ],
    answer: 2,
    explain:
      "An allowlist is only as narrow as its widest entry. The built-in proxy decides from the client-supplied hostname without terminating TLS by default, so it filters names rather than traffic. Name specific hosts, and terminate TLS at a proxy you run if the threat model needs content filtering.",
  },
  {
    id: "hardening-7",
    sectionId: "hardening",
    prompt: "Which control silently stops existing when you move an agent from a laptop to <code>claude -p</code> in CI?",
    options: [
      "The egress allowlist",
      "Human approval before irreversible acts",
      "Deny-by-default tool permissions",
      "Transcript logging",
    ],
    answer: 1,
    explain:
      "No TTY means no approval prompt, so the most expensive control in the kit becomes a no-op — and nothing announces it. Trust verification for new codebases and MCP servers is disabled under <code>-p</code> for the same reason. For unattended deployments, only count controls that need nobody present.",
  },
  {
    id: "hardening-8",
    sectionId: "hardening",
    prompt: "Detection fires on a run that fetched an attacker-controlled page. What comes first in the response?",
    options: [
      "Reproduce the injection to confirm it was real",
      "Rotate every credential the agent could reach",
      "Patch the route the attacker used",
      "Restore the workspace from a clean checkout",
    ],
    answer: 1,
    explain:
      "Anything the agent could read is compromised until proven otherwise, and proving it takes longer than rotating. Then scope from the transcript, then assume persistence — grep memory files, skills, hooks and settings — and only then fix the route, checking the second route to the same outcome.",
  },
  {
    id: "hardening-9",
    sectionId: "hardening",
    prompt: "Installing a new MCP server is best understood as…",
    options: [
      "adding a dependency, reviewed like any other package",
      "a write to your system prompt on someone else's release schedule",
      "a permission grant that the allowlist already covers",
      "a context cost with no security implication",
    ],
    answer: 1,
    explain:
      "Tool descriptions load at startup and the model reads them as instructions, so an integration bump is a prompt change. Anthropic reviews connectors against listing criteria before directory listing but does not security-audit MCP servers — pin versions and diff the descriptions on update.",
  },

  // L10 — loop engineering ---------------------------------------------------
  {
    id: "loop-engineering-1",
    sectionId: "loop-engineering",
    prompt: "A loop that runs unattended needs three exits. Which one do most designs leave out?",
    options: [
      "Done — the verification passed",
      "Exhausted — a budget ran out",
      "Stuck — still burning budget, no longer converging",
      "Cancelled — the operator interrupted it",
    ],
    answer: 2,
    explain:
      "Done is the exit everyone builds; a budget is at least easy to remember once you've paid for forgetting it. The stuck exit is the expensive omission, because a stalled loop looks exactly like a working one from outside — tokens moving, tools firing, turns accumulating.",
  },
  {
    id: "loop-engineering-2",
    sectionId: "loop-engineering",
    prompt: "Ranking verifiers strongest to weakest, which is the <em>weakest</em>?",
    options: [
      "A test suite or an exit code",
      "A linter or policy check over the artifact",
      "A model judging against a rubric in a fresh context",
      "The model checking its own output in the same context",
    ],
    answer: 3,
    explain:
      "Self-review in the producing context re-runs the reasoning that made the mistake — the errors that survived generation are exactly the ones that look correct to that context. It catches slips, not misunderstandings. The rule is to push the check outside the context that made the artifact.",
  },
  {
    id: "loop-engineering-3",
    sectionId: "loop-engineering",
    prompt: "A tool call returns a real error — the file wasn't where the agent assumed. What should the loop do?",
    options: [
      "Retry the same call with exponential backoff",
      "Go back to gather and change something before acting again",
      "Retry immediately; tool errors are usually transient",
      "Escalate to a human on the first failure",
    ],
    answer: 1,
    explain:
      "Backoff is for transient failures — timeouts, 503s, rate limits — where the plan was right and the world was briefly unavailable. A real error means the approach is wrong, and a retry that changes nothing about the attempt is not a retry, it's a repetition.",
  },
  {
    id: "loop-engineering-4",
    sectionId: "loop-engineering",
    prompt: "The cheapest high-signal indicator that a run has stalled is…",
    options: [
      "the turn count passing a threshold",
      "the same tool called with the same arguments twice",
      "the context window approaching its limit",
      "the model's own report that it is making progress",
    ],
    answer: 1,
    explain:
      "Hash the call — repetition is the highest-signal stall indicator and nearly free to detect. Turn count measures activity, not progress. The other trajectory signals are error recurrence, oscillating edits, and a verifier score that hasn't moved in three rounds.",
  },
  {
    id: "loop-engineering-5",
    sectionId: "loop-engineering",
    prompt: "A run hits its step budget mid-task. What should happen?",
    options: [
      "Stop immediately — that's what the budget is for",
      "Raise the budget once and continue",
      "Write what it tried, ruled out and believes to a file, then stop",
      "Hand the remaining turns to a subagent",
    ],
    answer: 2,
    explain:
      "Every budget needs a behaviour on exhaustion, and \"stop\" throws away everything the run learned. Writing state to a file makes exhaustion a handoff (L7) rather than a death — same limit, but the next session starts warm.",
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
