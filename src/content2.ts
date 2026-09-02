import type { Section } from "./content";

export const sections2: Section[] = [
  {
    id: "prompt-formats",
    ordinal: "PW",
    title: "Writing the prompt — plain text, Markdown, XML, JSON",
    tagline: "Format is a boundary-marking device with a token price. Here is both halves of the trade.",
    body: `
<p>A model does not see your headings. It sees a flat stream of tokens, and every character of format you add is part of that stream — read on every turn, competing for the same attention budget as the instruction itself (L2). So format earns its place by doing one of three jobs:</p>
<ol>
<li><strong>Delimiting</strong> — marking unambiguously where the pasted document ends and your instruction begins. This is the job that matters most and the one prose does worst.</li>
<li><strong>Addressing</strong> — giving a region a name you can refer to later ("check the diff in <code>&lt;diff&gt;</code> against the rules in <code>&lt;rules&gt;</code>"). You cannot point at a paragraph; you can point at a tag.</li>
<li><strong>Signalling shape</strong> — a numbered list reads as an ordered procedure, a table as a set of parallel cases, a fenced block as literal text not to be interpreted.</li>
</ol>
<p>Structure that does none of the three is decoration you rent by the turn.</p>

<h3>The formats, and what each is actually for</h3>
<table>
<thead><tr><th>Format</th><th>Reach for it when</th><th>The cost</th></tr></thead>
<tbody>
<tr><td><strong>Plain prose</strong></td><td>The whole prompt is a few sentences and nothing is pasted in.</td><td>Nothing — but the moment you paste content into it, the model has to guess where your words stop and the data starts.</td></tr>
<tr><td><strong>Markdown</strong></td><td>Instruction documents: <code>CLAUDE.md</code>, <code>SKILL.md</code>, system prompts, anything a human also maintains.</td><td>Almost free, and it is the native register of the material these models were trained on. Weak at nesting: a Markdown list inside a pasted Markdown document has no visible seam.</td></tr>
<tr><td><strong>XML tags</strong></td><td>Long or mixed context — a document plus a spec plus examples — and anywhere you need to refer to a region by name. Anthropic's long-standing recommendation for Claude.</td><td>You pay for the tag twice, opening and closing. Worth it when there is something to delimit; pure overhead when there isn't.</td></tr>
<tr><td><strong>JSON</strong></td><td><em>Output</em> a machine will consume — and even then, prefer the mechanisms built for it: structured outputs (<code>output_config.format</code>) or a tool's input schema, which constrain the shape instead of asking politely.</td><td>Expensive as <em>input</em>: braces, quotes, colons and commas are all tokens, and escaping makes any embedded code or prose harder for both of you to read.</td></tr>
<tr><td><strong>HTML</strong></td><td>Essentially never, as something you author.</td><td>You mostly <em>receive</em> it — fetched pages, scraped docs. Tag soup is a large token multiplier carrying almost no signal; convert to Markdown or text before it enters the context, and treat the content as untrusted data either way (L8).</td></tr>
<tr><td><strong>YAML / TOML</strong></td><td>Metadata and configuration — skill frontmatter, agent definitions.</td><td>Terse and readable, but whitespace-significant: a bad place to embed free-form text that might contain a colon.</td></tr>
<tr><td><strong>CSV / TSV</strong></td><td>Tabular data, especially many rows.</td><td>Dramatically cheaper than the same rows as JSON objects — the field names are paid for once in the header instead of once per row.</td></tr>
</tbody>
</table>

<h3>Rules that survive contact with a real prompt</h3>
<ul>
<li><strong>One structural language per prompt.</strong> Markdown nested inside XML nested inside JSON is three sets of delimiters for one job, and the model has to work out which layer a stray brace belongs to.</li>
<li><strong>Name tags for what they contain</strong> — <code>&lt;transcript&gt;</code>, <code>&lt;style_guide&gt;</code>, <code>&lt;acceptance_criteria&gt;</code> — and reuse the same names in the instruction. A tag you never refer to is a comment.</li>
<li><strong>Long input first, the question last.</strong> With a long document in context, put the document above the instructions and keep the actual ask at the end; Anthropic's long-context guidance is explicit about that ordering.</li>
<li><strong>Examples are the highest-value tokens in the prompt.</strong> Two or three worked examples in the format you want back will beat a paragraph describing that format, every time. If you find yourself writing rules about output shape, you probably wanted an example — or a schema.</li>
<li><strong>Data you delimit can contain your delimiter.</strong> Pasted content with a stray <code>&lt;/document&gt;</code> in it will close your tag early — and if that content came from the web or an issue tracker, that is a prompt-injection surface, not just a formatting bug (L8).</li>
<li><strong>Reformatting is not free even when it's cheap.</strong> A prompt-cache hit is a byte-exact prefix match, so re-indenting or re-wrapping your standing context invalidates the cache for everything after the edit. Settle the format, then leave it alone.</li>
</ul>

<h3>What your prompt actually costs</h3>
<p>Formatting arguments end quickly once both sides can see a number. Paste something real below — the meter also prices the <em>same</em> instruction in four formats, so the spread is measured rather than asserted.</p>
<div data-widget="token-meter"></div>

<h3>Getting the number you can act on</h3>
<p>The meter above is a heuristic and says so. Real tokenization is model-specific — Claude generations do not agree with each other, and tokenizers from other vendors are simply wrong here (an OpenAI tokenizer undercounts Claude by roughly 15–20% on prose and considerably more on code). When the number is going to decide something, measure it:</p>
<ul>
<li><strong><code>POST /v1/messages/count_tokens</code></strong> — the exact count for a given model, request shape included. Pass the same model id you will call.</li>
<li><strong><code>usage</code> on the response</strong> — what you were actually billed, broken out into fresh input, cache writes, and cache reads. If <code>cache_read_input_tokens</code> stays at zero across identical prefixes, something in your prompt is changing per request.</li>
<li><strong><code>/context</code> in Claude Code</strong> — where the current window went: system prompt, tools, files, conversation.</li>
</ul>
<p class="callout"><strong>The habit worth keeping:</strong> optimize the standing context, not the one-off prompt. A message you send once at 3,000 tokens costs 3,000 tokens. A <code>CLAUDE.md</code> or tool description at 3,000 tokens costs that on every turn of every session, forever — which is why the bench flags length there and nowhere else.</p>
`,
    docs: [
      { label: "Prompt engineering overview (Claude docs)", url: "https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview" },
      { label: "Use XML tags to structure your prompts", url: "https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags" },
      { label: "Be clear, direct, and detailed", url: "https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/be-clear-and-direct" },
      { label: "Multishot prompting (examples)", url: "https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/multishot-prompting" },
      { label: "Long context prompting tips", url: "https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/long-context-tips" },
      { label: "System prompts", url: "https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/system-prompts" },
      { label: "Token counting", url: "https://docs.claude.com/en/docs/build-with-claude/token-counting" },
      { label: "Context windows", url: "https://docs.claude.com/en/docs/build-with-claude/context-windows" },
      { label: "Structured outputs", url: "https://docs.claude.com/en/docs/build-with-claude/structured-outputs" },
    ],
  },
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
<tr><td><code>WebSearch</code> / <code>WebFetch</code></td><td>Search the web, fetch and read pages</td><td>Treat fetched content as untrusted data (see L8)</td></tr>
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
<li><strong>Computer use</strong> — screenshot + mouse/keyboard control of a desktop for UI automation (server-hosted, or self-hosted where you run the desktop).</li>
<li><strong>Text editor &amp; bash tools</strong> — Anthropic-defined tool schemas Claude is specifically trained on; you supply the execution.</li>
<li><strong>Files API</strong> — upload once, reference across requests.</li>
<li><strong>MCP connector</strong> — call remote MCP servers directly from an API request, without running your own client.</li>
</ul>

<h3>MCP — the integration standard</h3>
<p>The <strong>Model Context Protocol</strong> is the open standard for connecting agents to external systems: an MCP server exposes tools, resources, and prompts; any MCP client (Claude Code, Claude.ai, the Agent SDK, many third-party agents) can use them. Official SDKs exist for TypeScript, Python, Rust, and more.</p>
<p>Servers your team will most likely reach for: GitHub (issues/PRs/CI), Playwright or Puppeteer (browser control for UI verification), Sentry, Postgres/SQLite, filesystem, Slack, Google Drive. Register with <code>claude mcp add</code>, scope config per-project via <code>.mcp.json</code>, and keep the set small — every connected server's tool descriptions consume context on every turn (L2 applies to tools too).</p>
<p class="callout"><strong>Rule of thumb for choosing:</strong> bash + file tools for anything local and scriptable; MCP for external systems with auth, state, or APIs that bash can't cleanly reach; custom API tools only when you're building your own agent and need tight control over the surface.</p>

<h3>The economics — paying for tokens once instead of every turn</h3>
<p>Prices rot faster than anything else on this page, so what follows is the mechanics — check the pricing page for today's numbers. The mechanics are stable, and they are where the real savings live:</p>
<ul>
<li><strong>Prompt caching.</strong> A cache hit is a byte-exact prefix match (PW). Reads bill at roughly a <em>tenth</em> of fresh input; writes carry a premium (~1.25× for the default 5-minute lifetime, ~2× for the 1-hour option) — so caching pays when a prefix is actually reused and costs extra when it isn't. Keep the stable parts (system prompt, tool definitions) first and byte-identical, the volatile parts last, and verify with <code>cache_read_input_tokens</code> in the response: zero across identical requests means something is quietly changing per request.</li>
<li><strong>Batching.</strong> Anything that can wait — nightly evals (L11), backfills, bulk classification — runs asynchronously at <strong>half price</strong> through the batch endpoint.</li>
<li><strong>Tiering and effort.</strong> Pin cheap, fast models on discovery subagents and the frontier model on synthesis (L4.4). On current models the <em>effort</em> control is the first lever to try: turning effort down on a strong model often beats switching to a weaker one, and it keeps one cache namespace where a model cascade forfeits cache reuse.</li>
<li><strong>Judge cost per completed task, not per request.</strong> A cheaper call that needs more turns, retries, or human clean-up is not cheaper. Same lesson as the L5 numbers: spend is only meaningful next to what it bought.</li>
</ul>
`,
    docs: [
      { label: "Tool use overview (API docs)", url: "https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview" },
      { label: "MCP in Claude Code (official docs)", url: "https://code.claude.com/docs/en/mcp" },
      { label: "Model Context Protocol — spec & SDKs", url: "https://modelcontextprotocol.io" },
      { label: "MCP servers — reference implementations", url: "https://github.com/modelcontextprotocol/servers" },
      { label: "Pricing (Claude docs)", url: "https://docs.claude.com/en/docs/about-claude/pricing" },
      { label: "Prompt caching", url: "https://docs.claude.com/en/docs/build-with-claude/prompt-caching" },
      { label: "Batch processing", url: "https://docs.claude.com/en/docs/build-with-claude/batch-processing" },
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
<li>Subagents <strong>nest</strong> — subagents spawning subagents, up to three layers below the main conversation by default — so a discovery sweep can fan out sweeps of its own. Every layer multiplies tokens (L5), so keep an eye on where the spend lands.</li>
</ul>

<h3>4.5 Choosing between the primitives</h3>
<div data-graph="layers"></div>
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
<p>In February 2026 Claude Code shipped <strong>agent teams</strong> — still experimental and disabled by default; an environment variable turns them on. One session acts as team lead; teammates run independently, each in its own context window and Git worktree — and unlike subagents, teammates <strong>communicate with each other directly</strong> (messaging, broadcasting, plan approval), not just report to a parent. Good for parallel research and review where teammates challenge each other's findings, and for features where each teammate owns a distinct component. Costs: real coordination overhead and token usage — same rule as always: use it when the task actually decomposes.</p>
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
<h3>The options are the guide's levers</h3>
<p>Almost every option on that call is a rung of this ladder made programmable, and reading them that way is the fastest route to a configuration you can defend:</p>
<table>
<thead><tr><th>Option</th><th>What it is</th><th>Rung</th></tr></thead>
<tbody>
<tr><td><code>allowedTools</code> / <code>disallowedTools</code></td><td>The tool surface. Small and well-scoped, or you have written tool sprawl into code.</td><td>L3</td></tr>
<tr><td><code>systemPrompt</code></td><td>A string, or the <code>claude_code</code> preset with an <code>append</code> — the standing context, kept byte-identical across calls for the cache's sake.</td><td>L2, PW</td></tr>
<tr><td><code>permissionMode</code>, <code>canUseTool</code></td><td>The floor (<code>default</code>, <code>acceptEdits</code>, <code>plan</code>, <code>dontAsk</code>, <code>bypassPermissions</code>) and your own callback that sees every tool call's arguments and decides. The action gate, in your code.</td><td>L9</td></tr>
<tr><td><code>hooks</code></td><td>The same lifecycle events as Claude Code — <code>PreToolUse</code>, <code>PostToolUse</code>, <code>Stop</code>, <code>SubagentStop</code>, <code>PreCompact</code> — as in-process functions.</td><td>L4, L9</td></tr>
<tr><td><code>maxTurns</code>, <code>maxBudgetUsd</code></td><td>Two of L10's budgets. The result's <code>subtype</code> names the exit the run took: <code>success</code>, <code>error_max_turns</code>, <code>error_max_budget_usd</code>.</td><td>L10</td></tr>
<tr><td><code>agents</code></td><td>Subagents defined in code — description, prompt, tools, model — instead of in <code>.claude/agents/</code>.</td><td>L4, L5</td></tr>
<tr><td><code>mcpServers</code></td><td>External servers, and in-process ones you write (below).</td><td>TB</td></tr>
<tr><td><code>resume</code>, <code>forkSession</code></td><td>Continue a session by id, or branch one. The handoff, natively.</td><td>L7</td></tr>
<tr><td><code>settingSources</code></td><td>Which filesystem settings (user, project, local) the SDK loads. The default is <em>none</em>.</td><td>L4, L9</td></tr>
</tbody>
</table>
<p class="callout"><strong>The trap: an SDK agent starts with none of your project's configuration.</strong> The skill, the hook and the deny rule that protect the developer laptop were loaded from the filesystem, and <code>settingSources</code> defaults to loading nothing. The posture you tested interactively is not the posture the SDK agent has until you opt those sources in — L9's headless lesson, one layer down.</p>

<h3>Custom tools are in-process MCP servers</h3>
<p>A tool you write has a name, a description that L3 applies to in full, a schema, and a handler — and it is served to the agent as an MCP server running inside your process, no transport involved. It lands on the surface as <code>mcp__&lt;server&gt;__&lt;tool&gt;</code>, which is the name you allow:</p>
<pre><code>import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const tickets = createSdkMcpServer({
  name: "tickets",
  version: "1.0.0",
  tools: [
    tool(
      "lookup_ticket",
      "Use this when the user cites a ticket id and you need its status, owner " +
        "or history. Not for searching by keyword (use search_tickets). " +
        "Errors if the id does not exist — do not retry, ask the user.",
      { id: z.string().describe("Ticket id, e.g. SUP-4821") },
      async ({ id }) => ({
        content: [{ type: "text", text: JSON.stringify(await db.ticket(id)) }],
      }),
    ),
  ],
});

for await (const msg of query({
  prompt: "Is SUP-4821 still blocked, and on whom?",
  options: {
    mcpServers: { tickets },
    allowedTools: ["mcp__tickets__lookup_ticket"],
    maxTurns: 8,
  },
})) {
  if (msg.type === "result") {
    console.log(msg.subtype, msg.num_turns, msg.total_cost_usd, msg.session_id);
  }
}</code></pre>
<p>Look at what the result message carries: <code>session_id</code>, <code>total_cost_usd</code>, <code>usage</code>, <code>num_turns</code>, <code>duration_ms</code>. That is the row in your cost table (L12) and the id you resume from (L7), emitted by the loop itself. You do not have to build the bookkeeping this guide keeps asking for — you have to keep it.</p>
<p>The Python SDK is the same shape with snake-case names — <code>query()</code>, <code>ClaudeAgentOptions</code>, <code>@tool</code>, <code>create_sdk_mcp_server</code> — plus a <code>ClaudeSDKClient</code> for multi-turn sessions. Names on both sides are version-specific; the table above is the shape, the reference is the spelling.</p>
`,
    docs: [
      { label: "Agent SDK overview (official docs)", url: "https://code.claude.com/docs/en/agent-sdk/overview" },
      { label: "Agent SDK — TypeScript reference", url: "https://code.claude.com/docs/en/agent-sdk/typescript" },
      { label: "Agent SDK — Python reference", url: "https://code.claude.com/docs/en/agent-sdk/python" },
      { label: "Agent SDK — custom tools (in-process MCP)", url: "https://code.claude.com/docs/en/agent-sdk/custom-tools" },
      { label: "Agent SDK — permissions", url: "https://code.claude.com/docs/en/agent-sdk/permissions" },
      { label: "Agent SDK — sessions", url: "https://code.claude.com/docs/en/agent-sdk/sessions" },
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
<li>Verification gates between sessions so regressions are caught before compounding. What those gates should be, and how a session decides it has stopped making progress, is L10.</li>
</ul>

<h3>Security and isolation</h3>
<ul>
<li>Run autonomous agents in <strong>sandboxes</strong> with scoped permissions — containers or VMs, network allowlists, read-only mounts for anything precious. <code>--dangerously-skip-permissions</code> only inside a container without credentials.</li>
<li><strong>Prompt injection</strong> is the standing threat for any agent that reads untrusted content (web pages, issues, emails): treat fetched content as data, gate side-effecting tools behind allowlists, hooks, or human approval.</li>
<li>At team scale, centralize policy (what agents can reach) rather than trusting per-developer local settings.</li>
</ul>
<p>That is the summary; L8 is the threat model behind it and L9 is the configuration that implements it.</p>

<h3>Evaluation and observability</h3>
<ul>
<li>Start evals early with ~20 realistic tasks; small samples reveal large effects in agentic systems.</li>
<li><strong>LLM-as-judge</strong> with a rubric (accuracy, completeness, citation quality, tool efficiency) scales grading; keep human transcript review for the failure modes rubrics miss.</li>
<li>Judge end states, not turn-by-turn scripts — allow different valid paths to the outcome.</li>
<li>Track per-agent and per-tool token cost; in multi-agent setups, cost attribution is the difference between a tunable system and a mystery bill.</li>
</ul>
<p>That is the sketch; evals as a discipline — the set, the judge, the regression gate — is L11.</p>

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
    id: "adversarial",
    ordinal: "L8",
    title: "The adversary — agents under attack",
    tagline: "An agent that reads what strangers write is a machine that runs text from strangers.",
    body: `
<h3>The shape of the problem</h3>
<p>Everything up to here optimises for capability: give the model the right context, the right tools, the right amount of rope. This section is about the same system read by someone who wants it to work <em>for them</em>.</p>
<p>The uncomfortable property is structural, not a bug anyone can patch. A context window is one flat sequence of tokens. The operator's instructions, the repository's memory file, a tool description, a fetched web page, an issue filed by a stranger — by the time they reach the model they are the same kind of thing: text. The model is built to follow the most relevant instruction it can see, and it has no channel that tells it which sentences carry your authority.</p>
<p>So the standing question for any agentic deployment is not "can it be jailbroken?" — nothing is broken. It is: <strong>who can write into this agent's context, and what can the agent do once they have?</strong></p>

<div data-graph="trust"></div>

<h3>The lethal trifecta</h3>
<p>Three properties, each individually reasonable, become an exfiltration channel when they meet in one context:</p>
<ol>
<li><strong>Access to private data</strong> — source, customer records, credentials, anything the agent was given legitimately.</li>
<li><strong>Exposure to untrusted content</strong> — a page, a ticket, an email, a tool result, a subagent's report.</li>
<li><strong>A way to communicate outward</strong> — and this is broader than it sounds. A fetch is a channel. An image URL is a channel. Any tool argument that reaches a third party is a channel; the data leaves in the address and nothing errors.</li>
</ol>
<p>Any two are survivable. All three is a design decision, and the cheapest cut is usually the third: an egress allowlist turns an exfiltration into a failed DNS lookup.</p>

<h3>Where the controls actually sit</h3>
<p>Controls fall into five families, and mixing them is what makes a posture rather than a pile:</p>
<ul>
<li><strong>Provenance</strong> — mark untrusted material as material. Fetched content is wrapped and framed as data to reason about, never spliced in as instruction. A subagent's summary gets the same treatment: fan-out multiplies trust boundaries, and the orchestrator is the one holding the write permissions.</li>
<li><strong>Action gates</strong> — deny-by-default tool permissions, <code>PreToolUse</code> hooks that see the arguments and can refuse, human approval on the irreversible, protected paths for CI config and memory files.</li>
<li><strong>Blast radius</strong> — a sandbox holding nothing precious, an egress allowlist, a workspace with no long-lived plaintext credentials in it.</li>
<li><strong>Least privilege</strong> — the agent has its own identity with the narrowest grant that works. An agent is a deputy holding your authority; an attacker who can supply your agent's <em>reasons</em> does not need your permissions.</li>
<li><strong>Detection</strong> — transcripts and alerting on the shapes that matter: first contact with a new host, credential-shaped strings in outbound payloads, bursts of writes. This family never blocks anything. Count it at half credit and no more.</li>
</ul>

<h3>Four things that do not work</h3>
<ul>
<li><strong>Instructing the model to ignore injections.</strong> You are adding a sentence to the same undifferentiated stream the attacker is writing into, and theirs is more recent and more specific. This raises the cost of an attack; it does not bound it.</li>
<li><strong>Filtering for known attack strings.</strong> The payload is natural language with unbounded phrasings, and the useful ones do not look like attacks — "the source recommends updating the deployment configuration" is a sentence a real report would contain.</li>
<li><strong>Human review as a general answer.</strong> Review is a strong control against a suspicious diff and a weak one against a boring diff. A green bot PR titled <code>chore: rotate deploy key</code>, matching an issue that reads like it came from the team, gets merged. Approval gates also decay: one that fires forty times a day is one somebody routes around by the end of the month.</li>
<li><strong>Trusting a tool description because you trust the vendor.</strong> Tool descriptions load into the system prompt at startup — they <em>are</em> instructions, so no downstream framing saves you. Every integration you install is a write to your system prompt on someone else's release schedule. Pin it and diff it, or accept that.</li>
</ul>

<h3>Two failure modes worth naming</h3>
<p><strong>Persistence.</strong> A one-shot injection is an incident. An injection that reaches a memory file is a policy change: it survives <code>/clear</code>, restarts, and everyone who joins the repo afterwards, long after the page that planted it is gone. Treat <code>CLAUDE.md</code>, skills and any persistent instruction file as executable — because to the agent, they are.</p>
<p><strong>Scale.</strong> An agent does not get tired, suspicious, or bored on the two-hundredth identical request. A small overreach that a human would catch on the third repetition becomes a quarterly write-off overnight. Rate and anomaly limits are a security control, not an ops nicety.</p>

<h3>A posture, not a checklist</h3>
<p>Security spend competes with the thing you were trying to build, and the honest currency is friction rather than money. Every control costs somebody's afternoon, and a control people have switched off is not a control. So the work is to pick the <em>fewest</em> controls that cut the most chains for this deployment — which means writing down the threat list first, and knowing which link each control cuts.</p>
<p>Which controls, and how they are actually wired, is L9 — including the trap in each layer that makes one look present when it isn't.</p>
<p>The range (in the bar above) is where that gets practised: a fixed friction budget, a real threat list per deployment, and a scored guess — before the reveal — about which attacks your own posture actually holds. The gap between how good your defences are and how well you understand them is the interesting number, because it predicts what you will remove the first week it inconveniences someone.</p>
`,
    docs: [
      { label: "Security (official docs)", url: "https://code.claude.com/docs/en/security" },
      { label: "Identity, access & permissions", url: "https://code.claude.com/docs/en/settings" },
      { label: "Hooks reference", url: "https://code.claude.com/docs/en/hooks" },
      { label: "MCP — connecting external tools", url: "https://code.claude.com/docs/en/mcp" },
      { label: "Effective Harnesses for Long-Running Agents", url: "https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents" },
    ],
  },
  {
    id: "hardening",
    ordinal: "L9",
    title: "Hardening in practice",
    tagline: "L8 is the threat model. This is the wiring — and the trap in each layer that makes a control look present when it isn't.",
    body: `
<p>L8 ends on a question: who can write into this agent's context, and what can it do once they have. Answering it is a configuration exercise, and this section is the configuration — layer by layer, with the failure mode of each one named, because the way these deployments actually go wrong is not a missing control. It is a control that is present, configured, and doing nothing.</p>

<p>Two claims hold the rest together.</p>
<ol>
<li><strong>Every control worth counting is enforced by something that is not the model.</strong> If the mechanism is a sentence in a prompt, it is a mitigation — it raises the cost of an attack. If the mechanism is a permission rule, a hook process, or a kernel boundary, it is a control — it bounds one. Both are worth having; only one of them is worth writing on the board.</li>
<li><strong>The defaults are a starting point, not a posture.</strong> The shipped defaults are good and they are tuned for a specific situation: a developer at a keyboard, able to read a prompt and say no. Several of them evaluate to nothing the moment the same agent runs unattended — and nothing announces that.</li>
</ol>

<div data-graph="defense"></div>

<h3>The layers, and what each one cannot see</h3>
<table>
<thead><tr><th>Layer</th><th>Enforced by</th><th>Sees</th><th>Blind to</th></tr></thead>
<tbody>
<tr><td>Permission rules</td><td>The harness, before the call runs</td><td>Tool name and argument pattern</td><td>Intent, and any argument shape you didn't anticipate</td></tr>
<tr><td><code>PreToolUse</code> hooks</td><td>Your code, before the call runs</td><td>The full arguments, and anything else your script can reach</td><td>Whether a legitimate-looking action was requested by the wrong party</td></tr>
<tr><td>OS sandbox</td><td>The kernel, on the running process</td><td>Every file and socket the process and its children touch</td><td>Anything the agent does through a tool that isn't Bash</td></tr>
<tr><td>Identity scope</td><td>The system on the other end</td><td>What this principal is entitled to do</td><td>Misuse that stays inside the grant</td></tr>
<tr><td>Transcripts</td><td>Nothing — it is a record</td><td>Everything, afterwards</td><td>The present tense</td></tr>
</tbody>
</table>
<p>Read down the "blind to" column and the case for layering makes itself: each layer's blind spot is the next layer's field of view, and no single one of them is a place to stand.</p>

<h3>1 · Permission rules — the floor, and they merge</h3>
<p>Permissions are three arrays of <code>Tool(pattern)</code> rules — <code>allow</code>, <code>ask</code>, <code>deny</code> — resolved across managed, command-line, local, project, and user scopes. <code>deny</code> wins over <code>allow</code> wherever they overlap, so the useful rules to write first are the negative ones.</p>
<pre><code>{
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Bash(curl *)",
      "Bash(git push *)"
    ],
    "ask": ["WebFetch"],
    "allow": ["Bash(npm run test *)", "Bash(npm run lint)"]
  }
}</code></pre>
<p class="callout"><strong>The trap: permission rules <em>merge</em> across scopes rather than override.</strong> A project's <code>.claude/settings.json</code> can add rules; it cannot remove the ones a developer set in <code>~/.claude/settings.json</code>, and a developer's local file can widen what the project committed. So a rule set checked into the repo is a floor for the team, not a ceiling — the org policy you thought you shipped is advisory until <code>allowManagedPermissionRulesOnly</code> is set in managed settings, at which point only managed rules are honoured at all. If your security review looked at the committed file and stopped there, it reviewed a suggestion.</p>

<h3>2 · Hooks — the layer that reads the arguments</h3>
<p>A permission rule matches a pattern. A <code>PreToolUse</code> hook is your own process, handed the tool call as JSON on stdin, free to inspect whatever it likes and refuse. That is the layer that catches the argument the allowlist could not have anticipated — because it sees the arguments, not just the tool name (L4.3).</p>
<p>Two ways to refuse. Exit <strong>2</strong> blocks the call and feeds stderr back to the model as an error, which is the terse version. Or exit 0 having printed a decision, which is the version that can explain itself and can also <em>rewrite</em> the call rather than kill it:</p>
<pre><code>{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Outbound host not on the allowlist"
  }
}</code></pre>
<p><code>permissionDecision</code> takes <code>allow</code>, <code>deny</code>, <code>ask</code> or <code>defer</code>, and <code>updatedInput</code> lets a hook hand back modified arguments — redaction instead of refusal, which is often the control people actually wanted.</p>
<p class="callout"><strong>The trap: silence is not approval, and it is not denial either.</strong> Exit 0 with no output means the hook has <em>no decision</em>, and the call carries on through the normal permission flow. That is the right default, and it means a hook that crashes — <code>jq</code> missing on the CI image, a bad path, a syntax error in a script nobody runs locally — fails <em>open</em> and reports nothing you will notice. Test the deny path in the environment the agent actually runs in, and assert on it the way you would assert on a test, or you are counting a control that exits non-zero into the void.</p>

<h3>3 · The sandbox — the only layer the model cannot talk its way past</h3>
<p>Permission rules and hooks are decisions made about a command string <em>before</em> it runs. The sandbox is an OS boundary — Seatbelt on macOS, bubblewrap on Linux and WSL2 — imposed on the running process and everything it spawns. The distinction is the whole value: it holds regardless of what the model chose to run, and regardless of whether an allowed command turned out to do more than its name suggested.</p>
<p>Two independent layers, and you want both:</p>
<ul>
<li><strong>Filesystem.</strong> Writes are confined to the working directory and the session temp directory by default. <strong>Reads are not</strong> — the default read policy covers the whole machine, <code>~/.ssh</code> and <code>~/.aws/credentials</code> included. A sandbox is not a secret-free workspace until you say so, which is what <code>sandbox.credentials</code> and <code>filesystem.denyRead</code> are for.</li>
<li><strong>Network.</strong> No domains are pre-allowed; you name them in <code>network.allowedDomains</code> or approve them as they come up. This is the egress cut, and it is the cheapest link in the trifecta to break.</li>
</ul>
<pre><code>{
  "sandbox": {
    "enabled": true,
    "failIfUnavailable": true,
    "allowUnsandboxedCommands": false,
    "network": { "allowedDomains": ["registry.npmjs.org", "api.github.com"] },
    "credentials": {
      "files": [
        { "path": "~/.aws/credentials", "mode": "deny" },
        { "path": "~/.ssh", "mode": "deny" }
      ],
      "envVars": [{ "name": "GITHUB_TOKEN", "mode": "deny" }]
    }
  }
}</code></pre>
<p><code>failIfUnavailable</code> is the line that matters most in that block and the one everyone omits: without it, a missing dependency on one machine downgrades to a warning and an unsandboxed run. A security gate that degrades to "off" with a log line is a gate you cannot reason about.</p>
<p class="callout"><strong>The trap: an allowlist is only as narrow as its widest entry.</strong> The built-in proxy decides from the client-supplied hostname and does not terminate TLS by default, so it is filtering names, not traffic. <code>github.com</code> on that list authorises a gist, an issue comment, and a commit to any repository the token can reach — a full exfiltration channel, allowlisted. Name the specific hosts, and if the threat model needs more than name filtering, terminate TLS at a proxy you run.</p>
<p>Note the scope, too: the sandbox isolates <strong>Bash subprocesses</strong>. <code>Read</code>, <code>Edit</code> and <code>Write</code> go through the permission system instead, and subagents inherit the parent session's configuration rather than getting boundaries of their own.</p>

<h3>4 · Credentials — make the workspace boring to steal from</h3>
<ul>
<li><strong>The agent gets its own identity</strong>, with the narrowest grant that lets the task complete and a short lifetime. An agent is a deputy holding your authority (L8); the fix for a confused deputy is not a smarter deputy, it is a smaller badge.</li>
<li><strong>Deny what it doesn't need, mask what it does.</strong> A <code>deny</code> entry unsets the variable, which also breaks the tool that needed it. <code>mask</code> hands the sandboxed command a per-session sentinel and substitutes the real value at the proxy on the way out to named hosts — so <code>gh</code> keeps working and neither the transcript nor the log ever holds the credential. Masking requires the proxy to terminate TLS, and fails closed if it can't.</li>
<li><strong>Assume the transcript is a disclosure surface.</strong> Anything reaching the context is in every log, every exported review, every crash report. That is also why an incident starts with rotation rather than with analysis.</li>
</ul>

<h3>5 · Integrations are writes to your system prompt</h3>
<p>Tool descriptions load at startup and the model reads them as instructions. So installing an MCP server is a write to your system prompt on someone else's release schedule (L8), and it is worth being precise about what review does and doesn't cover: Anthropic reviews connectors against listing criteria before they appear in the directory, and does not security-audit MCP servers. Pin versions, diff tool descriptions on update, and treat an integration bump as a prompt change, because it is one.</p>
<p>The pleasant part: the security argument and the context argument point the same way for once. Fewer servers means a smaller attack surface <em>and</em> fewer tokens burned on every turn (L2, L3). Reach for that alignment when you are arguing for removing an integration — the cost case usually lands where the risk case doesn't.</p>

<h3>6 · Memory is executable</h3>
<p><code>CLAUDE.md</code>, <code>.claude/rules/</code>, skills, hooks, <code>.mcp.json</code>, <code>settings.json</code> — to the agent these are not configuration, they are standing instructions, and an injection that reaches one has been promoted from an incident to a policy change (L8). Review them as source: owners files on those paths, branch protection, and an actual reader on the diff. A <code>ConfigChange</code> hook can audit or block settings edits mid-session, and <code>InstructionsLoaded</code> fires when a memory file is read, which is the hook you want if you have ever wondered what your agent is actually loading.</p>
<p>The sandbox helps here — it denies writes to <code>settings.json</code> at every scope, so a sandboxed command cannot edit its own policy. That protection lives in the filesystem layer, and so it disappears with it if anyone turns filesystem isolation off to make a stubborn tool work.</p>

<h3>7 · Headless and CI — where the posture is actually tested</h3>
<p>Everything above assumes a person is available. Under <code>claude -p</code> in CI, no one is:</p>
<ul>
<li><strong>Human approval becomes a no-op.</strong> There is no TTY, so the strongest and most expensive control in the kit silently isn't there. If your threat model leaned on it, the CI deployment has a hole exactly the shape of the thing you were most confident about.</li>
<li><strong>Trust verification is disabled under <code>-p</code>.</strong> The first-run prompt for a new codebase or a new MCP server is an interactive control, and non-interactive means it doesn't fire.</li>
<li><strong>The job's token is the agent's authority.</strong> A workflow with broad write scope hands that scope to whatever the agent decides to do — including whatever a pull request's description talked it into. Scope the job, not just the agent.</li>
<li><strong><code>--dangerously-skip-permissions</code> belongs in a container holding nothing you would miss.</strong> It also skips protected-path checks, and it is refused outright when running as root — which is a hint about the intended blast radius, not an obstacle to work around.</li>
</ul>
<p>The rule that survives: for an unattended deployment, only count controls that need no one present. Everything else is a control for a different deployment.</p>

<h3>8 · Detection, and the incident you will actually have</h3>
<p>Detection blocks nothing and is still worth building, because it is what makes an incident bounded instead of open-ended. Alert on shapes, not signatures: first contact with a new host, credential-shaped strings in outbound payloads, a burst of writes, a tool call sequence that no legitimate run produces.</p>
<p>When it fires, the order matters more than the speed:</p>
<ol>
<li><strong>Rotate first.</strong> Anything the agent could read is compromised until proven otherwise, and proving it takes longer than rotating.</li>
<li><strong>Scope from the transcript</strong> — which is why the transcript needs to be complete and retained. Every tool call, arguments included.</li>
<li><strong>Assume persistence.</strong> Grep the memory files, skills, hooks, MCP config and settings for anything the run touched. This is the step people skip, and it is the one that decides whether the incident is over or dormant.</li>
<li><strong>Then</strong> fix the route — and check the other route to the same outcome, because the interesting attacks have two.</li>
</ol>

<h3>A starter posture, by deployment</h3>
<p>Friction is the real currency (L8), so this is what to buy first when you cannot buy everything:</p>
<table>
<thead><tr><th>Deployment</th><th>Buy first</th><th>Because</th></tr></thead>
<tbody>
<tr><td><strong>Developer laptop</strong></td><td>Sandbox on with credential denies; deny rules for secret paths; memory files in review</td><td>The machine is full of things worth stealing and the human gate is genuinely available, so spend on blast radius rather than gates.</td></tr>
<tr><td><strong>CI / headless</strong></td><td>Egress allowlist; scoped job token; protected paths; no approval-dependent controls counted</td><td>Nobody is there. Every gate that needs a person is decorative here.</td></tr>
<tr><td><strong>Nightly batch</strong></td><td>Egress allowlist; secret-free workspace; rate and anomaly limits</td><td>Nothing is time-critical, so approval queues are affordable — but scale is the threat, and an agent does not get suspicious on the two-hundredth request.</td></tr>
<tr><td><strong>Customer-facing</strong></td><td>Content-is-data framing; deny-by-default tools; scoped identity; human approval on the irreversible</td><td>Untrusted input is not an edge case here, it is the input. Assume every message is hostile and price the friction accordingly.</td></tr>
</tbody>
</table>
<p class="callout"><strong>Where to practise this:</strong> the range (in the bar above) runs exactly these trade-offs — a fixed friction budget, a real threat list per deployment, and a scored prediction, made <em>before</em> the reveal, about which attacks your own posture holds. This section tells you what each control is; the range tells you whether you know what yours are doing.</p>
<p>One caveat that ages faster than the rest of this guide: the setting names and hook fields above are version-specific. Check them against the settings and hooks references before you rely on the exact spelling — the shape of the argument outlives the schema.</p>
`,
    docs: [
      { label: "Security (official docs)", url: "https://code.claude.com/docs/en/security" },
      { label: "Permissions", url: "https://code.claude.com/docs/en/permissions" },
      { label: "Settings reference (scopes & precedence)", url: "https://code.claude.com/docs/en/settings" },
      { label: "Sandboxing — filesystem & network isolation", url: "https://code.claude.com/docs/en/sandboxing" },
      { label: "Sandbox environments — choosing an isolation boundary", url: "https://code.claude.com/docs/en/sandbox-environments" },
      { label: "Hooks reference", url: "https://code.claude.com/docs/en/hooks" },
      { label: "Development containers", url: "https://code.claude.com/docs/en/devcontainer" },
      { label: "Monitoring usage (OpenTelemetry)", url: "https://code.claude.com/docs/en/monitoring-usage" },
    ],
  },
  {
    id: "loop-engineering",
    ordinal: "L10",
    title: "Loop engineering",
    tagline: "L2 engineers what goes into the window. This engineers the repeat — what closes the loop, what bounds it, and what happens when it won't converge.",
    body: `
<p>L0 makes a promise and then the guide spends ten sections elaborating three quarters of it. An agent is an augmented LLM running in a loop: <strong>gather context → take action → verify → repeat until done</strong>. Context engineering (L2) is the discipline of the first phase, tool design (L3) the second. This section is the discipline of the other two — the verification that decides whether to go round again, and the <em>repeat</em> itself.</p>
<p>It gets its own level because it is where unattended agents actually fail. Not on a bad prompt or a missing tool: on a run that never decided it was finished, or decided it was finished when it wasn't. Those are the same defect seen from two sides — <strong>a loop is only as good as the condition that ends it</strong>.</p>

<div data-graph="loopeng"></div>

<h3>Three exits, not one</h3>
<p>Every loop needs somewhere to go when the work succeeds. A loop that runs unattended needs two more:</p>
<ol>
<li><strong>Done</strong> — the verification passed. This is the only exit most people design.</li>
<li><strong>Exhausted</strong> — a budget ran out. Steps, tool calls, tokens, wall-clock, money; pick the ones that bind for your deployment and set them explicitly, because the alternative is not "no limit", it's a limit discovered later by an invoice or a timeout.</li>
<li><strong>Stuck</strong> — the run is still burning budget but has stopped converging. This is the exit almost nobody builds, and it is the one that costs the most, because a stalled loop looks exactly like a working loop from the outside: tokens moving, tools firing, turns accumulating.</li>
</ol>
<p class="callout"><strong>Every budget needs a behaviour on exhaustion, and "stop" is usually the wrong one.</strong> A run that dies at its step limit throws away everything it learned. A run that writes its state — what it tried, what it ruled out, what it believes is true — to a file and <em>then</em> stops is a handoff (L7), and the next session starts warm. Same limit; the difference is whether the budget bought you anything.</p>

<h3>Verification is the load-bearing phase</h3>
<p>The verify step is what makes it a loop rather than a sequence, and not all verifiers are worth the same. Roughly, strongest first:</p>
<ol>
<li><strong>Deterministic checks</strong> — the compiler, the test suite, an exit code, a schema validation, a diff that must apply. Code, not a model. These are cheap, they don't negotiate, and they fail for reasons you can read.</li>
<li><strong>Rules over the artifact</strong> — a linter, a policy check, a regex for the thing that must never ship. Weaker than a test, still not an opinion.</li>
<li><strong>A model judging in a fresh context</strong> — LLM-as-judge against an explicit rubric (L7). Genuinely useful for things no test can express: is the citation supported, is the tone right, did it answer the question asked.</li>
<li><strong>The model judging its own output in the same context</strong> — nearly free and nearly worthless. The errors that survived generation are exactly the ones that look correct to that context; asking it to check its work re-runs the reasoning that produced the mistake. It catches typos and slips, not misunderstandings.</li>
</ol>
<p>The practical rule: <strong>push the check outside the context that made the artifact.</strong> A fresh window, a different model, or — best — a process that isn't a model at all. When the guide says agents belong in environments with verification, this is the thing it means; "verify your work" in a system prompt is an aspiration, <code>npm test</code> is a gate.</p>
<p>The corollary matters as much: <strong>if you can't state the check, you don't have a loop</strong>, you have an open-ended generation with a stopping heuristic. That is a legitimate thing to build — but budget it like one, and don't expect autonomy to improve the result.</p>

<h3>Progress is not activity</h3>
<p>The stuck exit needs a signal, and turn count isn't one. What distinguishes a converging run from a thrashing one shows up in the trajectory:</p>
<ul>
<li><strong>Repetition</strong> — the same tool called with the same arguments twice. The single highest-signal stall indicator there is, and the cheapest to detect: hash the call.</li>
<li><strong>Error recurrence</strong> — the same failure text coming back after an attempted fix. Two identical errors is bad luck; three is a wrong model of the problem, and more turns won't fix a wrong model.</li>
<li><strong>Oscillation</strong> — edits that revert each other, a file that returns to a previous state, a plan that alternates between two approaches. The run is exploring a cycle, not a path.</li>
<li><strong>A flat verifier</strong> — the test count, the score, the number of remaining failures unchanged across iterations. If the thing you're optimising hasn't moved in three rounds, it isn't going to on the fourth without a change of approach.</li>
</ul>
<p>Cheap and effective: keep a small trajectory summary the agent itself must update each round — attempt, result, what it now believes. It's structured note-taking (L2) pointed at the loop rather than at the task, and it makes stalls legible to the agent, not just to your monitoring.</p>

<h3>Retry, re-plan, escalate</h3>
<p>"Retry" hides two different situations and conflating them is how loops burn budget politely:</p>
<ul>
<li><strong>Transient failure</strong> — a timeout, a 503, a rate limit, a lock. The plan was right and the world was briefly unavailable. Retry the same call with exponential backoff and a cap. This is the only case where repeating yourself is correct.</li>
<li><strong>Wrong approach</strong> — the tool returned a real error, the test failed on logic, the file wasn't where it was assumed to be. Retrying is a bug: <strong>a retry that changes nothing about the attempt is not a retry, it's a repetition</strong>. This case needs a re-plan — go back to gather, get the missing fact, and change something before acting again.</li>
</ul>
<p>Two things that fall out of this. Retries are not free when the action has side effects: re-running a POST, a payment, an email or a <code>git push</code> is a second event in the world, so either the tool is idempotent (L3 — say so in its description) or the loop must know not to repeat it. And escalation is a design decision, not a failure: an <code>AskUserQuestion</code> at the point of genuine ambiguity costs one interruption, where guessing costs the whole run and everything downstream of the guess.</p>

<h3>You don't always own the loop</h3>
<p>Where the loop lives changes which levers you have, not the anatomy:</p>
<table>
<thead><tr><th>Where</th><th>Who runs the loop</th><th>Your levers</th></tr></thead>
<tbody>
<tr><td><strong>Claude Code</strong> (L4)</td><td>The harness</td><td>The verification command in <code>CLAUDE.md</code>, hooks (test-on-stop is a verifier), the explore→plan→code→verify habit, <code>/clear</code> as a manual budget reset</td></tr>
<tr><td><strong>Agent SDK</strong> (L6)</td><td>Inside <code>query()</code></td><td>Turn limits, permission callbacks, hooks, the tools you expose, what the system prompt calls "done"</td></tr>
<tr><td><strong>Raw API</strong></td><td>You, in a <code>while</code></td><td>All of it — and all of it is now yours to get wrong</td></tr>
<tr><td><strong>Multi-agent</strong> (L5)</td><td>One loop per agent, plus the orchestrator's</td><td>Every budget multiplies; a worker with no stop condition is a leak the lead can't see</td></tr>
</tbody>
</table>
<p>The last row is the one worth sitting with. Loop bugs compose badly: L5's ~15× token cost assumes the workers terminate. A single stalled subagent inside a fan-out is a run that produces nothing and reports nothing, because the orchestrator is waiting on a report that isn't coming.</p>

<h3>The short version</h3>
<ul>
<li>Name the check before you build the loop. If you can't, you don't have one.</li>
<li>Put the check outside the context that produced the work.</li>
<li>Set every budget explicitly, and decide what happens when each one runs out.</li>
<li>Detect stalls by repetition and flat verifiers, not by turn count.</li>
<li>Retry transient failures; re-plan real ones; escalate ambiguity early and cheaply.</li>
<li>Make exhaustion a handoff, not a death.</li>
</ul>
<p class="callout"><strong>Where to practise this:</strong> the black box (in the bar above) is loop engineering read backwards — four real runs that went wrong, several of them on exactly these faults. Calling <em>unbounded loop</em> and <em>no verification</em> on the right turn is the same skill as designing the exit in the first place, minus the sunk cost.</p>
`,
    docs: [
      { label: "Building Effective Agents (the loop, and when to pay for it)", url: "https://www.anthropic.com/engineering/building-effective-agents" },
      { label: "Effective Harnesses for Long-Running Agents", url: "https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents" },
      { label: "Claude Agent SDK — the loop as a library", url: "https://code.claude.com/docs/en/agent-sdk/overview" },
      { label: "Hooks reference — verification the model can't skip", url: "https://code.claude.com/docs/en/hooks" },
    ],
  },
  {
    id: "evals",
    ordinal: "L11",
    title: "Evals — proving it works",
    tagline: "L10 puts a verifier inside the loop. This puts one around the whole system — so a prompt edit can't quietly cost you what a bad merge would.",
    body: `
<p>Everything before this point changes the system: a tighter prompt (PW), a leaner context (L2), a better tool description (L3), a different architecture (L1, L5). L5 delivered the warning that comes with that power — <strong>small changes cascade</strong>, and a minor prompt edit can produce a large behavioral shift. An eval is the instrument that notices. Without one, every improvement is a claim; with one, it is a measurement — and the difference between those two is the difference between engineering and vibes.</p>
<p>The good news is the price of entry: Anthropic's guidance is to start with roughly <strong>twenty realistic tasks</strong>, because in agentic systems small samples reveal large effects. You do not need an eval platform to start. You need twenty tasks, a way to score them, and the discipline to run them before you ship a change.</p>

<h3>The eval set</h3>
<ul>
<li><strong>Draw tasks from reality, not imagination.</strong> Real transcripts, real tickets, real inputs — synthetic tasks measure the system you imagined, and the gap between the two is exactly where failures live.</li>
<li><strong>Every incident becomes a task.</strong> The run that went wrong last week is the most valuable eval you own: it is a failure you <em>know</em> the system can produce. That is a regression test, and it is how the set grows teeth over time.</li>
<li><strong>Grade end states, not scripts.</strong> Judge whether the outcome is right — the bug fixed, the answer supported, the file in the right shape — and let different valid paths reach it (L7). An eval that requires one exact tool sequence fails every improvement.</li>
<li><strong>Pin everything you aren't testing.</strong> Model id, prompts, tool set, fixtures. A moved number means something only when one thing moved.</li>
</ul>

<h3>The graders, strongest first</h3>
<p>The verifier hierarchy from L10 applies unchanged — it just runs over a whole eval set instead of one loop:</p>
<ol>
<li><strong>Programmatic checks</strong> — the diff applies, the tests pass, the schema validates, the answer string matches. Cheap, non-negotiable, and where every eval should start.</li>
<li><strong>LLM-as-judge with a rubric, in a fresh context</strong> — for what no test can express: is the citation supported, is the tone right, did it answer the question asked. Ask for <em>per-criterion verdicts</em> (accuracy, completeness, citation quality, tool efficiency — L7's rubric), never a single 1–10: one number is where regressions hide.</li>
<li><strong>Human transcript review</strong> — reserved for the failure modes rubrics miss. Sample it; don't try to scale it.</li>
</ol>
<p class="callout"><strong>Calibrate the judge before you trust it.</strong> Run it over transcripts humans have already graded and measure the agreement; re-check whenever the judge's model or rubric changes. An uncalibrated judge is an opinion with a spreadsheet — and it drifts, silently, every time the model behind it moves.</p>

<h3>Reading the number</h3>
<ul>
<li><strong>Run each task more than once.</strong> Agents are nondeterministic: a 70% pass rate might be seven tasks that always pass, or ten that each flake — and those are different problems with different fixes. Variance per task is the diagnosis; the aggregate is just the symptom.</li>
<li><strong>Track cost and latency beside quality.</strong> L5's lesson was that token spend explains most of the performance gain — so a quality win is only a win at a price you'd pay again. A scoreboard without a cost column optimizes one axis and silently bills you on the other two.</li>
<li><strong>Read the transcripts.</strong> The score tells you <em>that</em>; only the transcript tells you <em>why</em>. The same trick that works for tools (L3) works here: have the model itself classify failure modes across the transcripts and propose fixes — grading agents with agents is exactly the workflow these systems are good at.</li>
</ul>

<h3>The regression gate</h3>
<p>An eval you run when you remember is a demo. The end state is the eval as a <strong>merge gate</strong>: headless (<code>claude -p</code>) or through the SDK in CI, triggered by changes to the things the guide keeps telling you to iterate on — prompts, tool descriptions, <code>CLAUDE.md</code>, model version. L9 argued those files are executable and should be reviewed as source; this is the other half: <strong>they can regress, so they get tests</strong>. A red eval blocks a prompt merge for the same reason a red test blocks a code merge.</p>
<p>One discipline the gate needs: <strong>hold out a subset you never tune against.</strong> Iterate freely against the working set — but if every task has been used to fix a failure, the set has been trained on, and the number it produces is a memory, not a measurement.</p>
<p class="callout"><strong>You have been inside one all along.</strong> This guide is built as an eval: the drill is a per-item verifier on a schedule, the checkride is a held-out sample with a pass mark it never lets you tune against, and the flight record is the dashboard. Steal the design — it is the same one your agents need.</p>
`,
    docs: [
      { label: "Define your success criteria (Claude docs)", url: "https://docs.claude.com/en/docs/test-and-evaluate/define-success" },
      { label: "Create strong empirical evals (Claude docs)", url: "https://docs.claude.com/en/docs/test-and-evaluate/develop-tests" },
      { label: "Building Effective Agents (evaluation guidance)", url: "https://www.anthropic.com/engineering/building-effective-agents" },
      { label: "How We Built Our Multi-Agent Research System (eval findings)", url: "https://www.anthropic.com/engineering/multi-agent-research-system" },
    ],
  },
  {
    id: "observability",
    ordinal: "L12",
    title: "Reading the run — observability and debugging",
    tagline: "L11 tells you the number moved. This is how you find out why — the transcript as the primary source, and the ten ways a run goes wrong.",
    body: `
<p>Every exercise in this guide ends in a debrief, and every debrief starts the same way: with the run laid out turn by turn. That is not a teaching device; it is the job. An eval (L11) tells you <em>that</em> a change cost you three tasks. A stall detector (L10) tells you <em>that</em> a loop stopped converging. A monitoring alert (L9) tells you <em>that</em> an agent opened a connection to a host it had never seen. None of them tells you why. The transcript does — and reading one well is the skill that separates a team that can <em>operate</em> agents from a team that can only deploy them.</p>

<h3>The transcript is the primary source</h3>
<p>An agent run leaves exactly one complete record: the sequence of turns — what the model saw, what it decided, which tool it called with which arguments, what came back, and what it did next. Everything else you might look at is a projection of that. A cost is a sum over its turns; a score is a judgement of its end state; a metric is a count of something in it. So the first rule is that the record has to be complete, and complete means <strong>every tool call with its arguments and its result</strong>, token usage per turn, and the exact versions of everything L11 tells you to pin — model id, system prompt, tool set. A log that says "called Bash" without the command is the outline of a run, not the run.</p>
<p>Three views, each answering a different question, in the order you will actually need them:</p>
<table>
<thead><tr><th>View</th><th>Answers</th><th>Where it comes from</th></tr></thead>
<tbody>
<tr><td><strong>The transcript</strong> — turns, in order</td><td>What happened, and where it went wrong</td><td>The session log. Claude Code keeps one per session under <code>~/.claude/projects/</code>, which is what <code>--resume</code> reads; the Agent SDK yields the same turns as a message stream (L6).</td></tr>
<tr><td><strong>Metrics</strong> — counts over many runs</td><td>How often, how much, and is it getting worse</td><td>Tokens, cost, turns, tool calls, permission decisions per run. Claude Code exports these over OpenTelemetry when you switch telemetry on; your own harness sums them from its logs.</td></tr>
<tr><td><strong>The trace</strong> — turns with time and cost attached, nested by agent</td><td>Where the minutes and the money went</td><td>A span per turn and per tool call, so a fan-out (L5) reads as a tree instead of a bill.</td></tr>
</tbody>
</table>
<p>Teams reach for the dashboard first because it looks like observability. The transcript is what you will be reading at two in the morning, and the metric's real job is to tell you which transcript to open.</p>
<p class="callout"><strong>Privacy is a setting here, and the default is the safe one.</strong> Exported telemetry redacts prompt text and tool arguments unless you opt in per category (<code>OTEL_LOG_USER_PROMPTS</code>, <code>OTEL_LOG_TOOL_DETAILS</code>). Turn them on where the transcript is the point — and remember L9: whatever reaches a log is a disclosure surface, so the log needs the same access control as the credentials that occasionally end up in it.</p>

<h3>Reading a run: four passes</h3>
<ol>
<li><strong>Start from the outcome, not the beginning.</strong> Look at the artifact — the diff, the file, the answer — then find the last turn that touched it. Most faults are visible within three turns of the end; most of the rest are within three turns of the start. The middle is where you go once you know what you are looking for.</li>
<li><strong>Find the turn where the run stopped being right — not the turn where it failed.</strong> Those are usually different turns. A path invented at turn 4 surfaces as a crash at turn 19, and turn 4 is the fault; turn 19 is a symptom. Walk backwards from the failure asking, at each turn, "what did the model believe here, and had it earned that belief?" The first turn where the answer is no is the one to flag.</li>
<li><strong>Name it.</strong> Classify the fault from the taxonomy below. Naming is a separate skill from locating, and the black box scores them separately for that reason — the right turn with the wrong name is worth something, and the fix depends on the name.</li>
<li><strong>Fix at the layer that owns it, then keep the run.</strong> A silent assumption is a missing read tool or a missing instruction to read first (L2, L3); an unbounded loop is a missing budget (L10); a missing guardrail is a hook or a sandbox (L9). Then the run goes into the eval set (L11): the incident becomes a task, and the fix is now something the gate can hold.</li>
</ol>

<h3>The taxonomy — what each fault looks like in a transcript</h3>
<p>Ten faults cover most of what goes wrong in practice, and each has a signature you can learn to see without reading every word. They are the guide's own claims, inverted — the third column is the rung that teaches the thing the run violated:</p>
<table>
<thead><tr><th>Fault</th><th>The signature</th><th>Rung</th></tr></thead>
<tbody>
<tr><td><strong>Wrong pattern</strong></td><td>An orchestrator spun up for a lookup; a full agent loop where one call would do; or a fixed chain repeatedly derailed by questions its plan didn't anticipate.</td><td>L1</td></tr>
<tr><td><strong>Context rot</strong></td><td>Quality falling as the turn number rises; a late turn contradicting an early one it can no longer "see"; the model re-reading what it already has.</td><td>L2</td></tr>
<tr><td><strong>No verification</strong></td><td>"Done" with no check run — or a check run, failed, and not acted on. A test suite mentioned and never invoked.</td><td>L10</td></tr>
<tr><td><strong>Silent assumption</strong></td><td>A value appearing in an argument with no earlier turn that read it: a path, a schema, an API shape, invented and then acted on.</td><td>L0</td></tr>
<tr><td><strong>Tool sprawl</strong></td><td>Near-identical tools on the surface; the model picking the wrong one, or burning turns choosing.</td><td>L3</td></tr>
<tr><td><strong>Premature fan-out</strong></td><td>Parallel workers touching the same file or state; duplicated results; a merge step reconciling what the split created.</td><td>L5</td></tr>
<tr><td><strong>Lost handoff</strong></td><td>A subagent returning prose where an artifact was needed; a compaction or restart after which the run re-derives what it knew, or forgets a decision it made.</td><td>L5</td></tr>
<tr><td><strong>Unbounded loop</strong></td><td>The same call with the same arguments, twice or more; a verifier flat across rounds; turns accumulating with no new information.</td><td>L10</td></tr>
<tr><td><strong>Missing guardrail</strong></td><td>An irreversible or outward-facing action — push, send, delete, pay — with no confirmation, dry run or sandbox between the decision and the world.</td><td>L9</td></tr>
<tr><td><strong>Goal drift</strong></td><td>The metric goes green and the task isn't done: the test edited instead of the code, the flaky case skipped, the output shaped to satisfy the check rather than the user.</td><td>L0</td></tr>
</tbody>
</table>
<p>Two of these hide inside success, which is why they are the ones to look for on the runs that <em>passed</em>. <strong>Goal drift</strong> produces a green run — a test made to pass rather than a bug fixed — and the lesson is structural: a verifier the agent can edit is not a verifier, which is the case for checks that live in hooks the model cannot touch (L9). <strong>Silent assumption</strong> produces a confident run: nothing errors, because a guess that happens to be right leaves no trace until the input changes.</p>

<h3>Cost attribution — where the money went</h3>
<p>L5's fifteen-times figure is an average. In a real system it is a distribution with a long tail, and the tail is where the tuning happens. Attribute cost <strong>per agent and per tool</strong>, not per run: usage per turn, summed by the agent that spent it and the tool that returned it. That is what reveals the discovery subagent burning more than the synthesis it feeds, the one tool returning 40&nbsp;KB where 2&nbsp;KB would do (L3), the retry that quietly doubled a bill. In a fan-out, reading cost as a tree — each worker's spend under its parent — turns the bill into a diagnosis; reading it as a total turns it into a mystery. And keep it next to the quality number on every scoreboard (L11): a fix that costs three times what it saves is not a fix.</p>

<h3>Small changes cascade — the rollout discipline</h3>
<p>L5 made the warning; this is the practice. A one-line prompt edit can change tool selection across a whole system, so a change to a prompt, a tool description, a memory file or a model id is treated as a deploy, not a typo fix:</p>
<ul>
<li><strong>Diff the behaviour, not just the text.</strong> Run the eval set before and after (L11), then read transcript <em>pairs</em> on the tasks whose score moved. The score says something changed; the pair says what.</li>
<li><strong>Canary.</strong> A fraction of the traffic, or a subset of the batch, on the new version — with both sets of runs kept side by side.</li>
<li><strong>Resume from the error, not from zero.</strong> A long run that failed at turn 40 restarts at turn 40 with the ledger it wrote (L7). Restarting at turn 1 costs the forty turns and, worse, produces a <em>different</em> run that may not reproduce the fault.</li>
<li><strong>Keep every failed transcript.</strong> Retention is what makes "every incident becomes a task" (L11) possible, and it is what the L9 incident procedure scopes from.</li>
</ul>

<h3>Agents reading agents</h3>
<p>The volume problem is real: a team running a hundred sessions a day cannot read a hundred transcripts. The same move this guide recommends for tools (L3) and evals (L11) closes the gap — have a model read them. A classifier in a fresh context that walks each run and tags it with faults from the taxonomy above turns a pile of logs into a histogram: which faults, on which tools, on which tasks. It is the L10 verifier hierarchy applied to reading — a model that did not produce the run is a legitimate judge of it, and a cheap one. Keep the human pass for the failure modes the classifier hasn't been taught yet; that is where the eleventh fault will come from.</p>

<p class="callout"><strong>Where to practise this:</strong> the black box (in the bar above) is this section as an exercise — four recorded runs, the transcript and the outcome, nothing highlighted. Its scoring is built for the four-pass method: partial credit for the right turn with the wrong name, and a penalty for flagging clean turns, because an operator who flags everything has read nothing.</p>
`,
    docs: [
      { label: "Monitoring usage — OpenTelemetry metrics and events", url: "https://code.claude.com/docs/en/monitoring-usage" },
      { label: "How We Built Our Multi-Agent Research System — observability lessons", url: "https://www.anthropic.com/engineering/multi-agent-research-system" },
      { label: "Writing Effective Tools for AI Agents — transcript analysis", url: "https://www.anthropic.com/engineering/writing-tools-for-agents" },
      { label: "Agent SDK — sessions and the message stream", url: "https://code.claude.com/docs/en/agent-sdk/sessions" },
      { label: "CLI reference — resume, continue, output formats", url: "https://code.claude.com/docs/en/cli-reference" },
    ],
  },
  {
    id: "glossary",
    ordinal: "GL",
    title: "Glossary — the vocabulary, one line each",
    tagline: "Every term the ladder leans on, with the rung that teaches it. Searchable from ⌘K, so a word you don't know is never more than a keystroke away.",
    body: `
<p>The levels introduce these terms where they are needed; this is the same vocabulary in one place, alphabetical, with a pointer to the rung that owns each one. A definition here is a reminder, not a lesson — if one is new to you, the rung is the reading.</p>
<dl class="glossary">
<dt>Agent</dt><dd>A system in which the model directs its own process and tool use, deciding how to reach the goal. Contrast <em>workflow</em>. <a href="#mental-model">L0</a></dd>
<dt>Agent SDK</dt><dd>The Claude Code harness as a library, in Python and TypeScript: the loop, tools, permissions, compaction and subagents behind one <code>query()</code> call. <a href="#agent-sdk">L6</a></dd>
<dt>Agent team</dt><dd>Claude Code's experimental multi-session mode: a lead plus teammates, each in its own context window and worktree, who message each other directly instead of only reporting upward. <a href="#multi-agent">L5</a></dd>
<dt>Augmented LLM</dt><dd>A model plus retrieval, tools and memory — the atomic unit every pattern is built from. <a href="#mental-model">L0</a></dd>
<dt>Budget</dt><dd>An explicit limit on steps, tool calls, tokens, wall-clock or money, with a defined behaviour when it runs out. The alternative is a limit discovered by an invoice. <a href="#loop-engineering">L10</a></dd>
<dt>Calibration</dt><dd>How well your prediction of your own posture matches the reveal. The range scores it separately from the posture, because the gap predicts what you will switch off first. <a href="#adversarial">L8</a></dd>
<dt>Checkride</dt><dd>This guide's certification exam: questions sampled across every rung, one pass, no feedback until the end, a pass mark, and a shareable certificate.</dd>
<dt>CLAUDE.md</dt><dd>The always-loaded memory file — build commands, conventions, definition of done. Read on every turn, which is why it stays short. <a href="#claude-code">L4</a></dd>
<dt>Compaction</dt><dd>Summarising a long trajectory (decisions, current state, open items) and continuing from the summary when the window fills. Define what must survive it. <a href="#context">L2</a></dd>
<dt>Confused deputy</dt><dd>An agent holding your authority that an attacker steers by supplying its <em>reasons</em>. The fix is a smaller badge, not a smarter deputy. <a href="#adversarial">L8</a>, <a href="#hardening">L9</a></dd>
<dt>Context engineering</dt><dd>Choosing the smallest set of high-signal tokens most likely to produce the behaviour you want; the successor to prompt engineering. <a href="#context">L2</a></dd>
<dt>Context rot</dt><dd>The decline in accuracy as the window fills. Attention is a finite budget and every token competes for it. <a href="#context">L2</a></dd>
<dt>Context window</dt><dd>Everything the model can see on one turn: system prompt, tool descriptions, memory files, the conversation so far, tool results. One flat sequence of tokens with no channel for authority. <a href="#context">L2</a>, <a href="#adversarial">L8</a></dd>
<dt>Effort</dt><dd>A per-request control on how hard the model works. Turning it down on a strong model often beats switching to a weaker one, and keeps one cache namespace. <a href="#toolbox">TB</a></dd>
<dt>Egress allowlist</dt><dd>The named set of hosts a sandboxed process may reach. The cheapest cut through the lethal trifecta — and only as narrow as its widest entry. <a href="#hardening">L9</a></dd>
<dt>Eval set</dt><dd>Twenty-odd realistic tasks drawn from real work, graded on end states, run before every change ships. <a href="#evals">L11</a></dd>
<dt>Evaluator–optimizer</dt><dd>One model generates, another evaluates against explicit criteria and demands revision, in a loop. <a href="#patterns">L1</a></dd>
<dt>Friction points</dt><dd>The range's currency: what a control costs the people who have to live with it, priced per deployment. A control people have switched off is not a control. <a href="#adversarial">L8</a></dd>
<dt>Goal drift</dt><dd>Optimising the measurable proxy instead of the goal: the metric goes green, the task does not get done. <a href="#mental-model">L0</a>, <a href="#observability">L12</a></dd>
<dt>Handoff</dt><dd>State written for the next session's cold start — progress file, decision log, ledger — so a budget running out is a pause, not a death. <a href="#production">L7</a>, <a href="#loop-engineering">L10</a></dd>
<dt>Harness</dt><dd>The code around the model that runs the loop: tool execution, permissions, compaction, hooks. Claude Code is one; the Agent SDK is the same one as a library. <a href="#claude-code">L4</a>, <a href="#agent-sdk">L6</a></dd>
<dt>Headless mode</dt><dd><code>claude -p</code>: Claude Code with nobody present, for CI and scheduled jobs. Every control that needs a person evaluates to nothing here. <a href="#claude-code">L4</a>, <a href="#hardening">L9</a></dd>
<dt>Held-out set</dt><dd>Eval tasks you never tune against, so the score stays a measurement instead of a memory. <a href="#evals">L11</a></dd>
<dt>Hook</dt><dd>A command the harness runs at a lifecycle event (<code>PreToolUse</code>, <code>PostToolUse</code>, <code>Stop</code>…). Deterministic — so it is where "must happen every time" lives. <a href="#claude-code">L4</a>, <a href="#hardening">L9</a></dd>
<dt>Just-in-time retrieval</dt><dd>Loading content when it is needed, through tools, instead of pre-loading it. Paths are cheap; contents are expensive. <a href="#context">L2</a></dd>
<dt>Ledger</dt><dd>A persistent list of testable goals with status, kept outside the context so work survives a session boundary. This guide's progress tracker is one. <a href="#production">L7</a></dd>
<dt>Leitner box</dt><dd>The drill's schedule: cards climb through boxes with growing intervals; a miss drops the card back to the first box.</dd>
<dt>Lethal trifecta</dt><dd>Private data, untrusted content and a way to communicate outward, together in one context: an exfiltration channel. Any two are survivable. <a href="#adversarial">L8</a></dd>
<dt>LLM-as-judge</dt><dd>A model grading outputs against a rubric in a fresh context. Ask for per-criterion verdicts, and calibrate it against human grades before trusting it. <a href="#production">L7</a>, <a href="#evals">L11</a></dd>
<dt>MCP</dt><dd>Model Context Protocol — the open standard for exposing tools, resources and prompts to any agent client. Every connected server's descriptions cost context on every turn. <a href="#toolbox">TB</a></dd>
<dt>Memory file</dt><dd>Any persistent instruction file: <code>CLAUDE.md</code>, rules, skills, hooks, MCP config. Executable, from the agent's point of view — review it as source. <a href="#claude-code">L4</a>, <a href="#adversarial">L8</a></dd>
<dt>Orchestrator–workers</dt><dd>A lead model decomposes the task dynamically, delegates to workers in their own windows, and synthesises. The backbone of multi-agent systems. <a href="#patterns">L1</a>, <a href="#multi-agent">L5</a></dd>
<dt>Plan mode</dt><dd>Claude Code's read-only phase: explore and propose before anything is edited. <a href="#claude-code">L4</a></dd>
<dt>Plugin</dt><dd>A package that distributes skills, agents, hooks and MCP configuration together. <a href="#claude-code">L4</a></dd>
<dt>Prompt caching</dt><dd>Byte-exact prefix reuse across requests. Reads bill at a fraction of fresh input, so stable context goes first and stays unchanged. <a href="#prompt-formats">PW</a>, <a href="#toolbox">TB</a></dd>
<dt>Prompt injection</dt><dd>Instructions arriving through content the agent reads — a page, a ticket, a tool result — and being followed as if they were yours. Structural, not a bug to patch. <a href="#adversarial">L8</a></dd>
<dt>Provenance</dt><dd>Marking untrusted material as material: wrapped and framed as data to reason about, never spliced in as instruction. <a href="#adversarial">L8</a></dd>
<dt>Regression gate</dt><dd>The eval set run in CI on changes to prompts, tool descriptions, memory files and model id. Red blocks the merge. <a href="#evals">L11</a></dd>
<dt>Routing</dt><dd>Classify the input, then dispatch to a specialised prompt, model or path. The natural place for cost control. <a href="#patterns">L1</a></dd>
<dt>Sandbox</dt><dd>An OS boundary — filesystem and network — on the running process and everything it spawns. The only layer the model cannot talk its way past. <a href="#hardening">L9</a></dd>
<dt>Silent assumption</dt><dd>A fact invented instead of read or asked for, then acted on as if it were evidence. Leaves no trace while it happens to be right. <a href="#mental-model">L0</a>, <a href="#observability">L12</a></dd>
<dt>Skill</dt><dd>A folder with a <code>SKILL.md</code>, loaded only when the task matches its description — progressive disclosure. <a href="#claude-code">L4</a></dd>
<dt>Stall</dt><dd>A run still burning budget without converging. Detected by repetition and flat verifiers, not by turn count; needs its own exit. <a href="#loop-engineering">L10</a></dd>
<dt>Structured note-taking</dt><dd>The agent writing durable state — task lists, progress logs, decisions — to files outside the window and re-reading it. <a href="#context">L2</a></dd>
<dt>Subagent</dt><dd>A delegate in its own context window that returns a condensed result. Fork for breadth, stay inline for depth. <a href="#context">L2</a>, <a href="#claude-code">L4</a></dd>
<dt>Tool description</dt><dd>A tool's name, description and parameter docs. A prompt — and a routing decision the model makes at call time. <a href="#tool-design">L3</a></dd>
<dt>Trajectory</dt><dd>The sequence of turns a run took. The transcript is its record; trajectory review is the skill of reading one. <a href="#observability">L12</a></dd>
<dt>Verifier</dt><dd>The check that decides whether the loop goes round again. Strongest when it is code, outside the context that produced the work. <a href="#loop-engineering">L10</a></dd>
<dt>Wings</dt><dd>The checkride's shareable certificate link, checksummed for tamper-evidence — a team ritual, not cryptography.</dd>
<dt>Workflow</dt><dd>LLM calls and tools orchestrated through predefined code paths: you decide the steps, the model fills them in. <a href="#mental-model">L0</a></dd>
<dt>Worktree</dt><dd>A separate Git checkout of the same repository — the cheapest way to run parallel sessions on independent tasks. <a href="#multi-agent">L5</a></dd>
</dl>
`,
    docs: [],
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
<li><a href="https://code.claude.com/docs/en/security" target="_blank" rel="noopener">Security</a> · <a href="https://code.claude.com/docs/en/permissions" target="_blank" rel="noopener">permissions</a> · <a href="https://code.claude.com/docs/en/sandboxing" target="_blank" rel="noopener">sandboxing</a> — the reading behind L8–L9</li>
<li><a href="https://docs.claude.com/en/docs/test-and-evaluate/define-success" target="_blank" rel="noopener">Define success criteria</a> · <a href="https://docs.claude.com/en/docs/test-and-evaluate/develop-tests" target="_blank" rel="noopener">empirical evals</a> — the reading behind L11</li>
<li><a href="https://code.claude.com/docs/en/monitoring-usage" target="_blank" rel="noopener">Monitoring usage (OpenTelemetry)</a> · <a href="https://code.claude.com/docs/en/agent-sdk/sessions" target="_blank" rel="noopener">SDK sessions</a> — the reading behind L12</li>
<li><a href="https://github.com/anthropics/skills" target="_blank" rel="noopener">anthropics/skills</a> · <a href="https://github.com/anthropics/anthropic-cookbook" target="_blank" rel="noopener">anthropic-cookbook</a> · <a href="https://github.com/anthropics/claude-code" target="_blank" rel="noopener">anthropics/claude-code</a></li>
</ul>

<h3>Community (2026) — worth skimming</h3>
<ul>
<li><a href="https://resources.anthropic.com/building-effective-ai-agents" target="_blank" rel="noopener">Anthropic's "Building Effective AI Agents" ebook</a></li>
<li><a href="https://smartscope.blog/en/generative-ai/claude/claude-code-best-practices-advanced-2026/" target="_blank" rel="noopener">Advanced hooks / subagents / context techniques</a></li>
<li><a href="https://claudefa.st/blog/guide/agents/agent-teams" target="_blank" rel="noopener">Agent teams setup guide</a></li>
<li><a href="https://www.scriptbyai.com/claude-code-resource-list/" target="_blank" rel="noopener">Curated Claude Code ecosystem directory</a></li>
</ul>

<h3>What changed, and when</h3>
<p>The ladder grows a rung at a time. If you climbed it before, this is what is new since you did — the guide's own changelog, for returning readers:</p>
<ul>
<li><strong>September 2026</strong> — L12 (reading the run: observability and debugging) and this glossary; L3 gains the before/after tool description and schema rules, L6 the SDK's option table and in-process tools. Delivery: reading time per rung, previous/next navigation, a continue button, linkable headings with on-this-rung outlines, <code>[</code>/<code>]</code> keyboard navigation, and a print layout.</li>
<li><strong>31 August 2026</strong> — L11 (evals); cost economics in TB; API memory and context-editing features in L2; topology diagrams for L2 and L4; version-specific claims re-verified.</li>
<li><strong>17 August 2026</strong> — L10 (loop engineering).</li>
<li><strong>27 July 2026</strong> — L8 (the adversary), L9 (hardening in practice) and the range; PW (writing the prompt) with the live token meter.</li>
<li><strong>26 July 2026</strong> — the black box (trajectory review) and the bench (artifact review).</li>
<li><strong>24–25 July 2026</strong> — first release: L0–L7 and the sources, the drill, ⌘K search, team share-links, the pattern lab, the flight record, the architect, the checkride, topology diagrams throughout, offline install.</li>
</ul>
`,
    docs: [],
  },
];
