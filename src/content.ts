export interface DocLink {
  label: string;
  url: string;
}

export interface Section {
  id: string;
  ordinal: string; // "L0" … "L12", "PW", "TB", "GL", "REF"
  title: string;
  tagline: string;
  body: string; // trusted HTML authored in this repo
  docs: DocLink[];
}

export const meta = {
  title: "Agentic Workflows with Claude",
  subtitle: "From novice to expert, rung by rung — a learning ladder for teams",
  updated: "September 2026",
  disclaimer:
    "This space moves monthly. Version-specific details (agent teams, nested subagents, CLI flags) should be re-verified against the official docs before you rely on them.",
};

export const sections: Section[] = [
  {
    id: "mental-model",
    ordinal: "L0",
    title: "The mental model",
    tagline: "Workflows vs. agents, the augmented LLM, and when autonomy is worth paying for.",
    body: `
<h3>Workflows vs. agents</h3>
<p>Anthropic draws a sharp distinction that anchors everything else:</p>
<ul>
<li><strong>Workflows</strong> — LLMs and tools orchestrated through <em>predefined code paths</em>. You decide the steps; the model fills them in.</li>
<li><strong>Agents</strong> — systems where the LLM <em>dynamically directs its own process and tool usage</em>, deciding how to accomplish the task.</li>
</ul>
<p>The single most repeated piece of advice from Anthropic: <strong>find the simplest solution possible, and only add complexity when it measurably helps.</strong> Many production "agent" problems are better solved by one well-prompted LLM call with retrieval, or a fixed workflow. Agents trade latency and cost for autonomy — make that trade deliberately.</p>

<h3>The augmented LLM</h3>
<p>The atomic building block of every agentic system is an LLM augmented with three capabilities:</p>
<ol>
<li><strong>Retrieval</strong> — pull in relevant information</li>
<li><strong>Tools</strong> — act on the world (run code, call APIs, edit files)</li>
<li><strong>Memory</strong> — persist state across steps and sessions</li>
</ol>
<div data-graph="augmented"></div>
<p>An agent is an augmented LLM running <strong>in a loop</strong>: gather context → take action → verify the result → repeat until done. Every advanced technique in this guide is an elaboration of one of those four phases.</p>
<div data-graph="loop"></div>
<p>Hold on to that shape — the levels map onto it. L2 is the first phase, L3 the second, and L10 is the last two: what the check actually is, and what bounds the repeat. L11 then turns the same idea on the whole system — a verifier around the loop's own evolution.</p>

<h3>When agents are the right choice</h3>
<p>Use agents for open-ended problems where you can't predict the number of steps or hardcode a path, and where you have some trust in the model's decision-making. Autonomy means higher cost and the potential for compounding errors — so agents belong in <strong>sandboxed environments with guardrails and verification</strong>, especially early on.</p>
`,
    docs: [
      { label: "Building Effective Agents (Anthropic engineering)", url: "https://www.anthropic.com/engineering/building-effective-agents" },
      { label: "Building Effective AI Agents — ebook", url: "https://resources.anthropic.com/building-effective-ai-agents" },
    ],
  },
  {
    id: "patterns",
    ordinal: "L1",
    title: "The five composable patterns",
    tagline: "Chaining, routing, parallelization, orchestrator–workers, evaluator–optimizer.",
    body: `
<p>Before reaching for full autonomy, know the workflow patterns. Anthropic's guidance, validated across dozens of customer implementations: the most successful systems use <strong>simple, composable patterns rather than heavy frameworks</strong>.</p>
<ol>
<li><strong>Prompt chaining</strong> — decompose a task into fixed sequential steps, each LLM call processing the previous output, optionally with programmatic "gates" between steps. Use when a task cleanly decomposes and you want accuracy over latency.
<div data-graph="chain"></div></li>
<li><strong>Routing</strong> — classify the input, then dispatch to a specialized prompt, model, or path. Keeps each downstream prompt focused, and is the natural place for cost control (cheap model for easy cases, frontier model for hard ones).
<div data-graph="route"></div></li>
<li><strong>Parallelization</strong> — <em>sectioning</em> (independent subtasks run simultaneously) or <em>voting</em> (same task run multiple times, results aggregated). Buys speed, or confidence via diverse attempts.
<div data-graph="parallel"></div></li>
<li><strong>Orchestrator–workers</strong> — a central LLM dynamically breaks down the task, delegates to worker LLMs, and synthesizes results. Unlike parallelization, the subtasks aren't known in advance. This is the backbone of most serious multi-agent systems (see L5).
<div data-graph="orch"></div></li>
<li><strong>Evaluator–optimizer</strong> — one LLM generates, another evaluates against criteria and demands revisions in a loop. Use when you have clear evaluation criteria and iteration genuinely improves output.
<div data-graph="evalopt"></div></li>
</ol>
<p>Read the five diagrams together and the family resemblance shows: a solid arrow is control passing along a fixed path, a dashed fan-out is work leaving for its own context window, a green box is a check that code — not a model — performs, and a dotted return edge is the only place a loop can close. The <strong>pattern lab</strong> flies each of these against a mission and lights the diagram up as the run moves through it.</p>
<p class="callout"><strong>Practical advice:</strong> implement these directly against the API or the Agent SDK rather than through abstraction-heavy frameworks. Frameworks that obscure the actual prompts and tool calls make debugging much harder — and debugging <em>is</em> most of the work.</p>
`,
    docs: [
      { label: "Building Effective Agents — pattern catalog", url: "https://www.anthropic.com/engineering/building-effective-agents" },
      { label: "Anthropic Cookbook — agent pattern notebooks", url: "https://github.com/anthropics/anthropic-cookbook" },
    ],
  },
  {
    id: "context",
    ordinal: "L2",
    title: "Context engineering",
    tagline: "Attention is a finite budget. Curate the smallest set of high-signal tokens.",
    body: `
<p>As of 2025–2026, Anthropic frames the core discipline as <strong>context engineering</strong> — the successor to prompt engineering. The question is no longer "what's the perfect prompt" but <strong>"what configuration of context is most likely to produce the desired behavior?"</strong></p>

<h3>Why it matters: context rot</h3>
<p>Model accuracy degrades as the context window fills. Attention is a finite budget; every redundant tool description, stale log line, or unnecessary document actively competes with the signal. The goal is the <strong>smallest set of high-signal tokens</strong> that maximizes the likelihood of the outcome you want.</p>

<h3>Core techniques</h3>
<ul>
<li><strong>Lean system prompts</strong> — clear, specific, minimal. Define behavior; don't over-specify brittle rules.</li>
<li><strong>Just-in-time retrieval</strong> — instead of pre-loading everything, give the agent tools to fetch what it needs when it needs it (search, file reads, glob/grep). Paths and identifiers are cheap; contents are expensive — load them lazily.</li>
<li><strong>Compaction</strong> — when a long session approaches context limits, summarize the trajectory (decisions, current state, open items) and continue from the summary. Define <em>what must survive</em> compaction: API changes and rationale, modified files, error→fix pairs.</li>
<li><strong>Structured note-taking / external memory</strong> — have the agent write durable state to files (task lists, progress logs, decision records) outside the context window and re-read them as needed. The filesystem is the agent's long-term memory.</li>
<li><strong>Sub-agent context isolation</strong> — push exploration and other token-hungry work into a separate context window that returns only a condensed summary. This isn't just parallelism: it prevents contamination of the main context with failed attempts and noise.</li>
</ul>
<div data-graph="funnel"></div>

<p>Building on the raw API rather than a harness? The same ideas exist as API features: an Anthropic-defined <strong>memory tool</strong> the model calls to read and write persistent notes, and server-side <strong>context editing</strong> and <strong>compaction</strong> that clear or summarize stale tool results as the window fills. Several are beta — check the docs for current names — but the discipline is identical either way.</p>

<h3>The filesystem as context architecture</h3>
<p>A recurring theme in the Agent SDK guidance: <strong>folder and file structure is itself context engineering</strong>. An email agent that stores past conversations in a <code>conversations/</code> folder can search them on demand. Designing what the agent persists, where, and in what format is a first-class design decision.</p>
`,
    docs: [
      { label: "Effective Context Engineering for AI Agents", url: "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents" },
      { label: "Prompt engineering overview (Claude docs)", url: "https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview" },
      { label: "Building Agents with the Claude Agent SDK", url: "https://claude.com/blog/building-agents-with-the-claude-agent-sdk" },
      { label: "Memory tool (API docs)", url: "https://docs.claude.com/en/docs/agents-and-tools/tool-use/memory-tool" },
      { label: "Context editing (API docs)", url: "https://docs.claude.com/en/docs/build-with-claude/context-editing" },
    ],
  },
  {
    id: "tool-design",
    ordinal: "L3",
    title: "Tool design",
    tagline: "Agents are only as good as their tools — and tool descriptions are prompts.",
    body: `
<p>Anthropic's guidance from "Writing effective tools for AI agents — using AI agents":</p>
<ul>
<li><strong>Fewer, well-scoped tools beat many overlapping ones.</strong> Each tool should have a clear, unambiguous purpose. If a human engineer would be confused about which of two tools to use, the model will be too.</li>
<li><strong>Prompt-engineer your tool descriptions.</strong> The name, description, and parameter docs are part of the prompt. Treat them with the same care.</li>
<li><strong>Be judicious with context.</strong> Tools should return concise, high-signal output — paginated, filtered, truncated with a pointer to get more. A tool that dumps 50&nbsp;KB of JSON degrades every subsequent decision.</li>
<li><strong>Design for composition.</strong> Tools should combine naturally in diverse workflows, mirroring how the underlying task decomposes in the real world.</li>
<li><strong>Iterate with evals.</strong> Build realistic tasks, run the agent, read transcripts, fix the tools where the agent stumbles. Notably: use Claude itself to analyze failed transcripts and propose tool improvements — agents optimizing tools for agents works well.</li>
<li><strong>Return meaningful errors.</strong> Error messages are how agents self-correct. "Permission denied: file is read-only, copy to /tmp first" beats "Error 13".</li>
</ul>
<h3>A description is a routing decision</h3>
<p>The model does not read a tool description to learn what the tool does. It reads it while choosing, at call time, between this tool and everything else on the surface — so a description is a routing decision, and the parts that matter are the ones that decide the route: <em>when</em> to reach for it, when <em>not</em> to, and what a failure means. Before and after:</p>
<pre><code>// before
search_docs — Searches the documentation.

// after
search_docs — Use this when the user asks how a product feature behaves
and you do not already have the page. Full-text search over the public
docs; returns up to 10 hits as {title, url, snippet}. Not for source
code (use grep_repo), and not for a page whose URL you already have
(use fetch_page). An empty result means no page matches: rephrase once,
then say so — it does not mean the docs are down.</code></pre>
<p>Four things changed: a trigger condition, a boundary against the neighbouring tools, the shape of what comes back, and the meaning of nothing coming back. Each is one sentence, and each is a decision the model would otherwise make by guessing.</p>

<h3>The schema is part of the prompt</h3>
<ul>
<li><strong>Parameter names carry meaning.</strong> <code>user_id</code> beats <code>id</code>; <code>iso_date</code> beats <code>date</code>; an enum beats a free string wherever the values are known, because a schema constrains where a description only asks.</li>
<li><strong>Namespace by system.</strong> <code>github_create_issue</code>, <code>jira_create_issue</code> — the prefix tells the model which world it is acting in and stops two "create issue" tools blurring into one.</li>
<li><strong>Return what the next decision needs, not what the API returned.</strong> Names resolved from ids, times a human can read, and a <code>response_format</code> parameter — concise by default, detailed on request — so the model asks for the expensive shape only when it needs it.</li>
<li><strong>Budget the response.</strong> Default page sizes, filters, and truncation with a pointer to the rest. A 50&nbsp;KB result is a context-rot event (L2) that happened inside a tool.</li>
</ul>
<p>The bench (in the bar above) runs exactly these rules over a tool description you paste in — trigger, boundary, failure semantics, surface size — and cites the sentence that justifies each finding.</p>

<p class="callout"><strong>"Bash is all you need":</strong> a striking lesson from the Claude Code team — a general-purpose shell plus file tools outperforms large collections of bespoke narrow tools in many domains, because models know bash deeply and can compose it freely. Add specialized tools only where bash genuinely can't do the job, or where you need control and safety.</p>
`,
    docs: [
      { label: "Writing Effective Tools for AI Agents", url: "https://www.anthropic.com/engineering/writing-tools-for-agents" },
      { label: "Tool use with Claude (API docs)", url: "https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview" },
    ],
  },
];
