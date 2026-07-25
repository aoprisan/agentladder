import type { Section } from "./content";

export const sections2: Section[] = [
  {
    id: "toolbox",
    ordinal: "TB",
    title: "The toolbox — what tools you can actually use",
    tagline: "Built-in Claude Code tools, API server-side tools, and the MCP ecosystem.",
    body: `
<h3>Claude Code built-in tools</h3>
<p>These cover most coding tasks before any extension is added:</p>
<table>
<thead><tr><th>Tool</th><th>What it does</th><th>Notes</th></tr></thead>
<tbody>
<tr><td><code>Bash</code></td><td>Run shell commands</td><td>Supports <code>run_in_background</code> for long jobs; the workhorse</td></tr>
<tr><td><code>Read</code> / <code>Write</code> / <code>Edit</code></td><td>File I/O and surgical string-replace edits</td><td>Edits are diff-reviewable in the UI</td></tr>
<tr><td><code>Glob</code> / <code>Grep</code></td><td>Find files by pattern, search content (ripgrep)</td><td>Cheap discovery — pairs with just-in-time retrieval (L2)</td></tr>
<tr><td><code>WebSearch</code> / <code>WebFetch</code></td><td>Search the web, fetch and read pages</td><td>Treat fetched content as untrusted data (see L7)</td></tr>
<tr><td><code>Task</code></td><td>Spawn a subagent in its own context window</td><td>The multi-agent primitive (L4.4, L5)</td></tr>
<tr><td><code>TodoWrite</code></td><td>Maintain a visible task checklist</td><td>Structured note-taking made native</td></tr>
<tr><td><code>AskUserQuestion</code></td><td>Ask you a structured question mid-run</td><td>Human-in-the-loop checkpoint</td></tr>
<tr><td><code>NotebookEdit</code></td><td>Edit Jupyter notebooks cell-by-cell</td><td>Data-work sessions</td></tr>
</tbody>
</table>

<h3>API server-side tools (Claude API)</h3>
<p>When you build directly on the API, Anthropic hosts several tools so you don't implement them client-side:</p>
<ul>
<li><strong>Web search</strong> — server-side search with citations.</li>
<li><strong>Code execution</strong> — a sandboxed Python environment for analysis and file generation.</li>
<li><strong>Computer use</strong> — screenshot + mouse/keyboard control of a desktop for UI automation.</li>
<li><strong>Text editor &amp; bash tools</strong> — Anthropic-defined tool schemas Claude is specifically trained on; you supply the execution.</li>
<li><strong>Files API</strong> — upload once, reference across requests.</li>
<li><strong>MCP connector</strong> — call remote MCP servers directly from an API request, without running your own client.</li>
</ul>

<h3>MCP — the integration standard</h3>
<p>The <strong>Model Context Protocol</strong> is the open standard for connecting agents to external systems: an MCP server exposes tools, resources, and prompts; any MCP client (Claude Code, Claude.ai, the Agent SDK, many third-party agents) can use them. Official SDKs exist for TypeScript, Python, Rust, and more.</p>
<p>Servers your team will most likely reach for: GitHub (issues/PRs/CI), Playwright or Puppeteer (browser control for UI verification), Sentry, Postgres/SQLite, filesystem, Slack, Google Drive. Register with <code>claude mcp add</code>, scope config per-project via <code>.mcp.json</code>, and keep the set small — every connected server's tool descriptions consume context on every turn (L2 applies to tools too).</p>
<p class="callout"><strong>Rule of thumb for choosing:</strong> bash + file tools for anything local and scriptable; MCP for external systems with auth, state, or APIs that bash can't cleanly reach; custom API tools only when you're building your own agent and need tight control over the surface.</p>
`,
    docs: [
      { label: "Tool use overview (API docs)", url: "https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview" },
      { label: "MCP in Claude Code (official docs)", url: "https://code.claude.com/docs/en/mcp" },
      { label: "Model Context Protocol — spec & SDKs", url: "https://modelcontextprotocol.io" },
      { label: "MCP servers — reference implementations", url: "https://github.com/modelcontextprotocol/servers" },
    ],
  },
  {
    id: "claude-code",
    ordinal: "L4",
    title: "Claude Code as an agentic harness",
    tagline: "Memory, skills, hooks, subagents, plugins — and the workflow habits that hold up.",
    body: `
<p>Claude Code is Anthropic's reference agent — and since the harness behind it powers the Agent SDK (L6), mastering it teaches the general architecture. By 2026 it's a layered system: <strong>memory, skills, hooks, subagents, plugins, MCP</strong> as distinct extension layers.</p>

<h3>4.1 Memory: CLAUDE.md and rules</h3>
<p><code>CLAUDE.md</code> (project and user level, bootstrapped with <code>/init</code>) is the always-loaded instruction file: build commands, conventions, repo etiquette, definition of done. Keep it short — it competes for the attention budget on <em>every</em> turn. Anything situational belongs in a skill instead (loaded only when relevant). Include a compaction policy ("when summarizing, preserve X, Y, Z") so auto-compact keeps what matters. Nested CLAUDE.md files in subdirectories append context for their subtree.</p>

<h3>4.2 Skills</h3>
<p>A skill is a folder with a <code>SKILL.md</code> (plus optional scripts, templates, references) that Claude auto-discovers and loads <strong>only when the task matches its description</strong> — progressive disclosure in action.</p>
<ul>
<li>Use skills for repeatable expertise: "how we do migrations", "our release checklist", "accessibility review procedure".</li>
<li>Community rule of thumb: <strong>if you've typed the same instructions to Claude twice, that should have been a skill the first time.</strong></li>
<li>Skills keep CLAUDE.md lean: project patterns live in <code>.claude/skills/&lt;name&gt;/SKILL.md</code> and cost ~zero tokens until needed. Keep SKILL.md under ~500 lines; push detail into referenced companion files.</li>
</ul>

<h3>4.3 Hooks</h3>
<p>Hooks are commands the <strong>harness</strong> executes at lifecycle events (<code>PreToolUse</code>, <code>PostToolUse</code>, <code>UserPromptSubmit</code>, <code>SessionStart</code>, <code>Stop</code>, …). They can allow, warn, or block. The key property: hooks are deterministic — executed by the harness, not interpreted by the model. <strong>If something must happen every time, it's a hook, not a CLAUDE.md instruction.</strong> Typical uses: block writes outside the repo, run the formatter after every edit, run tests on Stop, redact secrets from shell commands.</p>

<h3>4.4 Subagents</h3>
<p>Subagents (defined in <code>.claude/agents/</code> with frontmatter: description, allowed tools, model, injected skills) run in <strong>their own context window</strong> with their own instructions.</p>
<ul>
<li><strong>Fork for breadth, stay inline for depth</strong>: delegate scanning, discovery, research, review — work that produces a summary. Keep reasoning-heavy sequential work in the main thread where you can steer it.</li>
<li>Pin models per subagent: a cheap, fast model for discovery sweeps, the frontier model for synthesis — much of your cost control lives here.</li>
<li>As of mid-2026, subagents <strong>nest</strong> (subagents spawning subagents, several levels deep), and <code>/usage</code> attributes cost per skill, subagent, and MCP server.</li>
</ul>

<h3>4.5 Choosing between the primitives</h3>
<table>
<thead><tr><th>Need</th><th>Primitive</th></tr></thead>
<tbody>
<tr><td>Always-on project conventions</td><td>CLAUDE.md</td></tr>
<tr><td>Repeatable procedure, loaded on demand</td><td>Skill</td></tr>
<tr><td>Must happen deterministically, every time</td><td>Hook</td></tr>
<tr><td>Isolated context / parallel sub-task</td><td>Subagent</td></tr>
<tr><td>External system integration</td><td>MCP server</td></tr>
<tr><td>Distribute skills + agents + hooks + MCP as one package</td><td>Plugin</td></tr>
<tr><td>User-invoked prompt template</td><td>Slash command</td></tr>
</tbody>
</table>

<h3>4.6 Workflow practices that hold up</h3>
<ul>
<li><strong>Explore → plan → code → verify.</strong> Use plan mode for anything non-trivial; approve the plan before letting it edit. Have a research subagent explore first and plan against its report with a clean context.</li>
<li><strong>Verification is the multiplier.</strong> Give the agent a way to check its own work: tests, typecheckers, linters, screenshots for UI. TDD is unusually effective with agents. There's a spectrum of rigor: in-prompt "keep going until tests pass" → Stop hooks that block completion until checks pass → a second-opinion subagent that tries to <em>refute</em> the result. Don't let the agent doing the work grade itself.</li>
<li><strong><code>/clear</code> aggressively</strong> between tasks; use checkpoints/rewind (Escape twice) instead of arguing with a polluted context. Checkpoints don't undo external side effects — Git is still Git.</li>
<li><strong>Headless mode for automation</strong>: <code>claude -p</code> in CI to lint, test, or summarize PRs; scheduled jobs; policy enforced mechanically with hooks.</li>
<li><strong>Course-correct early and often.</strong> Interrupt, refine, retry beats letting a wrong direction compound.</li>
</ul>
`,
    docs: [
      { label: "Claude Code — official docs", url: "https://code.claude.com/docs/en/overview" },
      { label: "Extending Claude Code (features overview)", url: "https://code.claude.com/docs/en/features-overview" },
      { label: "Skills", url: "https://code.claude.com/docs/en/skills" },
      { label: "Hooks", url: "https://code.claude.com/docs/en/hooks" },
      { label: "Subagents", url: "https://code.claude.com/docs/en/sub-agents" },
      { label: "Settings & permissions", url: "https://code.claude.com/docs/en/settings" },
      { label: "Claude Code Best Practices (engineering blog)", url: "https://www.anthropic.com/engineering/claude-code-best-practices" },
      { label: "Official skills marketplace", url: "https://github.com/anthropics/skills" },
    ],
  },
  {
    id: "multi-agent",
    ordinal: "L5",
    title: "Multi-agent systems",
    tagline: "Orchestrator–workers at scale, the economics of tokens, and agent teams.",
    body: `
<h3>The orchestrator–worker architecture at scale</h3>
<p>Anthropic's Research feature is the canonical case study. A lead agent plans, spawns specialized subagents that search <strong>in parallel in separate context windows</strong>, then synthesizes; a separate citation pass attributes claims. Key findings:</p>
<ul>
<li>A multi-agent system (Opus lead + Sonnet subagents) beat single-agent Opus by <strong>90.2%</strong> on Anthropic's internal research eval.</li>
<li><strong>Token spend explains most of the gain</strong>: three factors explained ~95% of performance variance on BrowseComp; token usage alone ~80%. Multi-agent works largely because it lets you spend more tokens in parallel, across independent context windows.</li>
<li>The cost is real: agents use ~4× the tokens of chat; <strong>multi-agent systems ~15×</strong>. Use them where task value justifies the spend.</li>
<li><strong>Architecture follows task structure.</strong> Multi-agent wins for <em>breadth-first</em> problems that decompose into independent parallel threads. It's a poor fit for tightly coupled work where all agents need shared context — much coding falls in this category.</li>
</ul>
<div data-graph="research"></div>

<h3>Hard-won engineering lessons</h3>
<ul>
<li><strong>Prompt the orchestrator to delegate well</strong>: explicit task descriptions per subagent (objective, output format, tool guidance, boundaries) and effort-scaling rules — or you get 50 subagents spawned for a one-line question.</li>
<li><strong>Watch agents work</strong>: build simulations and traces. Observed failure modes: over-searching after enough results, repeated queries, wrong tool choice. Fix by adjusting prompts against the model's actual interpretation.</li>
<li><strong>Small changes cascade.</strong> Minor prompt edits can produce large behavioral shifts; you need observability of decision patterns, careful rollouts, and "resume from where the error occurred" rather than restart-from-zero.</li>
<li><strong>Separate generation from verification</strong> for high-stakes outputs. The citation-agent pattern generalizes: a fresh-context checker can distinguish <em>confident</em> from <em>correct</em>.</li>
</ul>

<h3>Agent teams (2026)</h3>
<p>In February 2026 Claude Code shipped <strong>agent teams</strong> (research preview): one session acts as team lead; teammates run independently, each in its own context window and Git worktree — and unlike subagents, teammates <strong>communicate with each other directly</strong> (messaging, broadcasting, plan approval), not just report to a parent. Good for parallel research and review where teammates challenge each other's findings, and for features where each teammate owns a distinct component. Costs: real coordination overhead and token usage — same rule as always: use it when the task actually decomposes.</p>
<div data-graph="teams"></div>
<p>The two diagrams differ in one edge: subagents only report upward, teammates also talk sideways. That single edge is what buys you review that argues back — and what buys you a coordination bill.</p>
<p>The community pattern that agent teams formalize — parallel Claude Code sessions in Git worktrees on independent tasks — remains useful on its own and is the cheapest entry into multi-agent work.</p>
`,
    docs: [
      { label: "How We Built Our Multi-Agent Research System", url: "https://www.anthropic.com/engineering/multi-agent-research-system" },
      { label: "Agent teams (official docs)", url: "https://code.claude.com/docs/en/agent-teams" },
      { label: "Common workflows (worktrees, parallel sessions)", url: "https://code.claude.com/docs/en/common-workflows" },
    ],
  },
  {
    id: "agent-sdk",
    ordinal: "L6",
    title: "Building your own agents — the Claude Agent SDK",
    tagline: "The Claude Code harness as a library, in Python and TypeScript.",
    body: `
<p>The <strong>Claude Agent SDK</strong> (Python + TypeScript; renamed from "Claude Code SDK" in late 2025) exposes the exact harness that powers Claude Code as a library: the agent loop, tool execution, permissions, context management, compaction, subagents, hooks, and skills — programmable. It is explicitly <strong>not just for coding agents</strong>: Anthropic uses it internally for research, note-taking, and pipeline work, and it suits finance, support, and data agents equally.</p>
<ul>
<li>Minimal shape: a <code>query()</code> call with a prompt and an options object returns a stream of messages (system → assistant/tool turns → a final result with usage). The loop you'd otherwise hand-build is inside that call.</li>
<li>You inherit solved problems: memory across long tasks, permission systems balancing autonomy vs. control, subagent coordination.</li>
<li>Design approach: give the agent the same tools a human would use (shell, filesystem, real APIs) rather than sanitized abstractions, and structure its working directory deliberately (L2).</li>
<li><strong>Managed Agents</strong> (April 2026) is the hosted counterpart: the same architecture run as a REST service on Anthropic's infrastructure, for when you don't want to operate the runtime yourself.</li>
</ul>
<p class="callout"><strong>Recommended build sequence:</strong> one clear use case → map the loop (context sources, actions, verification) → minimal tools → real-data tests → add complexity only when the evals demand it.</p>
<pre><code>// TypeScript, minimal agent
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const msg of query({
  prompt: "Summarize open TODOs across this repo and write them to TODO.md",
  options: { allowedTools: ["Read", "Glob", "Grep", "Write"] },
})) {
  if (msg.type === "result") console.log(msg.result);
}</code></pre>
`,
    docs: [
      { label: "Agent SDK overview (official docs)", url: "https://code.claude.com/docs/en/agent-sdk/overview" },
      { label: "Agent SDK — TypeScript reference", url: "https://code.claude.com/docs/en/agent-sdk/typescript" },
      { label: "Agent SDK — Python reference", url: "https://code.claude.com/docs/en/agent-sdk/python" },
      { label: "Building Agents with the Claude Agent SDK (blog)", url: "https://claude.com/blog/building-agents-with-the-claude-agent-sdk" },
      { label: "Claude API overview", url: "https://docs.claude.com/en/api/overview" },
    ],
  },
  {
    id: "production",
    ordinal: "L7",
    title: "Long-running agents & production hardening",
    tagline: "Harnesses for multi-session work, sandboxing, and evaluation.",
    body: `
<h3>Long-horizon harnesses</h3>
<p>For work spanning hours or days across many context windows, the core problem is that each session starts with amnesia — like shift workers with no handoff notes. Anthropic's guidance:</p>
<ul>
<li>Maintain an explicit <strong>feature/goal ledger</strong> (e.g., hundreds of testable feature statements initialized as "failing") that persists outside the context; each session picks up the ledger, works, updates statuses.</li>
<li>Structured <strong>handoff artifacts</strong>: progress files, decision logs, "state of the world" summaries written for the <em>next</em> session's cold start.</li>
<li>Verification gates between sessions so regressions are caught before compounding.</li>
</ul>

<h3>Security and isolation</h3>
<ul>
<li>Run autonomous agents in <strong>sandboxes</strong> with scoped permissions — containers or VMs, network allowlists, read-only mounts for anything precious. <code>--dangerously-skip-permissions</code> only inside a container without credentials.</li>
<li><strong>Prompt injection</strong> is the standing threat for any agent that reads untrusted content (web pages, issues, emails): treat fetched content as data, gate side-effecting tools behind allowlists, hooks, or human approval.</li>
<li>At team scale, centralize policy (what agents can reach) rather than trusting per-developer local settings.</li>
</ul>

<h3>Evaluation and observability</h3>
<ul>
<li>Start evals early with ~20 realistic tasks; small samples reveal large effects in agentic systems.</li>
<li><strong>LLM-as-judge</strong> with a rubric (accuracy, completeness, citation quality, tool efficiency) scales grading; keep human transcript review for the failure modes rubrics miss.</li>
<li>Judge end states, not turn-by-turn scripts — allow different valid paths to the outcome.</li>
<li>Track per-agent and per-tool token cost; in multi-agent setups, cost attribution is the difference between a tunable system and a mystery bill.</li>
</ul>

<h3>Adoption ladder for a team</h3>
<ol>
<li><strong>Weeks 1–2:</strong> Claude Code with a lean CLAUDE.md per repo; the explore→plan→code→verify habit; permissions understood.</li>
<li><strong>Weeks 2–4:</strong> extract the first 3–5 skills from repeated instructions; hooks for format-on-edit and test-on-stop; <code>/clear</code> + checkpoint discipline.</li>
<li><strong>Month 2:</strong> first subagents (code-reviewer, researcher) with pinned models; headless <code>claude -p</code> in CI; a shared plugin distributing the team's skills, agents, hooks, and MCP config.</li>
<li><strong>Month 3+:</strong> parallel sessions via worktrees or agent teams for decomposable work; a first custom agent on the Agent SDK for a non-coding workflow; evals with LLM-as-judge before anything ships.</li>
</ol>
<p>Throughout: simplest thing that works, verification at every level, measure before adding autonomy.</p>
`,
    docs: [
      { label: "Effective Harnesses for Long-Running Agents", url: "https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents" },
      { label: "Security (official docs)", url: "https://code.claude.com/docs/en/security" },
      { label: "Identity, access & permissions", url: "https://code.claude.com/docs/en/settings" },
      { label: "Headless / CLI reference", url: "https://code.claude.com/docs/en/cli-reference" },
    ],
  },
  {
    id: "sources",
    ordinal: "REF",
    title: "Primary sources",
    tagline: "The canon, the docs, and what's worth skimming from the community.",
    body: `
<h3>Anthropic engineering blog — read in this order</h3>
<ol>
<li><a href="https://www.anthropic.com/engineering/building-effective-agents" target="_blank" rel="noopener">Building Effective Agents</a></li>
<li><a href="https://www.anthropic.com/engineering/claude-code-best-practices" target="_blank" rel="noopener">Claude Code Best Practices</a></li>
<li><a href="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents" target="_blank" rel="noopener">Effective Context Engineering for AI Agents</a></li>
<li><a href="https://www.anthropic.com/engineering/writing-tools-for-agents" target="_blank" rel="noopener">Writing Effective Tools for AI Agents</a></li>
<li><a href="https://www.anthropic.com/engineering/multi-agent-research-system" target="_blank" rel="noopener">How We Built Our Multi-Agent Research System</a></li>
<li><a href="https://claude.com/blog/building-agents-with-the-claude-agent-sdk" target="_blank" rel="noopener">Building Agents with the Claude Agent SDK</a></li>
<li><a href="https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents" target="_blank" rel="noopener">Effective Harnesses for Long-Running Agents</a></li>
</ol>

<h3>Official documentation</h3>
<ul>
<li><a href="https://code.claude.com/docs/en/overview" target="_blank" rel="noopener">Claude Code docs</a> — <a href="https://code.claude.com/docs/en/features-overview" target="_blank" rel="noopener">extension layers</a>, <a href="https://code.claude.com/docs/en/skills" target="_blank" rel="noopener">skills</a>, <a href="https://code.claude.com/docs/en/hooks" target="_blank" rel="noopener">hooks</a>, <a href="https://code.claude.com/docs/en/sub-agents" target="_blank" rel="noopener">subagents</a>, <a href="https://code.claude.com/docs/en/mcp" target="_blank" rel="noopener">MCP</a></li>
<li><a href="https://code.claude.com/docs/en/agent-sdk/overview" target="_blank" rel="noopener">Claude Agent SDK</a></li>
<li><a href="https://docs.claude.com/en/api/overview" target="_blank" rel="noopener">Claude API</a> · <a href="https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview" target="_blank" rel="noopener">tool use</a> · <a href="https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview" target="_blank" rel="noopener">prompt engineering</a></li>
<li><a href="https://modelcontextprotocol.io" target="_blank" rel="noopener">Model Context Protocol</a> · <a href="https://github.com/modelcontextprotocol/servers" target="_blank" rel="noopener">reference servers</a></li>
<li><a href="https://github.com/anthropics/skills" target="_blank" rel="noopener">anthropics/skills</a> · <a href="https://github.com/anthropics/anthropic-cookbook" target="_blank" rel="noopener">anthropic-cookbook</a> · <a href="https://github.com/anthropics/claude-code" target="_blank" rel="noopener">anthropics/claude-code</a></li>
</ul>

<h3>Community (2026) — worth skimming</h3>
<ul>
<li><a href="https://resources.anthropic.com/building-effective-ai-agents" target="_blank" rel="noopener">Anthropic's "Building Effective AI Agents" ebook</a></li>
<li><a href="https://smartscope.blog/en/generative-ai/claude/claude-code-best-practices-advanced-2026/" target="_blank" rel="noopener">Advanced hooks / subagents / context techniques</a></li>
<li><a href="https://claudefa.st/blog/guide/agents/agent-teams" target="_blank" rel="noopener">Agent teams setup guide</a></li>
<li><a href="https://www.scriptbyai.com/claude-code-resource-list/" target="_blank" rel="noopener">Curated Claude Code ecosystem directory</a></li>
</ul>
`,
    docs: [],
  },
];
