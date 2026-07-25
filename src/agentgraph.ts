// ---------------------------------------------------------------------------
// Agent graphs — the topologies, drawn. Pure data plus a string renderer; no
// DOM access, so the lab, the architect and the section bodies can all share
// them (main.ts hydrates `[data-graph]` slots after render).
//
// Each graph is a hand-laid node/edge spec in a small coordinate space. The
// renderer emits inline SVG (styled from styles.css, so it inherits the
// palette and works at any width) and `mermaidFor` emits the same graph as a
// Mermaid flowchart so the architect's decision brief carries a diagram into
// the RFC.
//
// Node ids double as run positions: labsim tags each event with the node it
// happens at, and lab.ts lights that node up while the run plays. Keep the
// ids here in step with the ones labsim emits.
// ---------------------------------------------------------------------------

import type { PatternId } from "./labsim";

/** io = task/result, model = an LLM call, worker = an isolated context window,
 *  gate = a programmatic check, tool = tools/environment, store = memory. */
export type NodeKind = "io" | "model" | "worker" | "gate" | "tool" | "store";

export interface GraphNode {
  id: string;
  x: number; // centre
  y: number; // centre
  w?: number; // box width (default NODE_W)
  label: string;
  sub?: string;
  kind: NodeKind;
}

/** flow = the happy path, spawn = fan-out into a fresh window,
 *  back = a loop closing, link = a two-way attachment (tools, memory). */
export type EdgeKind = "flow" | "spawn" | "back" | "link";

export interface GraphEdge {
  from: string;
  to: string;
  kind?: EdgeKind;
  label?: string;
  both?: boolean; // draw an arrowhead at the start too
  /** which faces the edge leaves and enters by; defaults to the dominant axis */
  axis?: "h" | "v";
}

export interface AgentGraph {
  id: string;
  title: string;
  caption: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const NODE_W = 108;
const NODE_H = 38;
const PAD = 16;

const n = (
  id: string,
  x: number,
  y: number,
  kind: NodeKind,
  label: string,
  sub?: string,
  w?: number,
): GraphNode => ({ id, x, y, kind, label, sub, w });

const e = (
  from: string,
  to: string,
  kind: EdgeKind = "flow",
  label?: string,
  both?: boolean,
  axis?: "h" | "v",
): GraphEdge => ({ from, to, kind, label, both, axis });

// ---------------------------------------------------------------------------
// The graphs
// ---------------------------------------------------------------------------

export const GRAPHS: AgentGraph[] = [
  {
    id: "augmented",
    title: "The augmented LLM",
    caption:
      "The atomic building block: one model call with retrieval, tools and memory hanging off it. Every pattern below is this block, wired up differently.",
    nodes: [
      n("in", 52, 46, "io", "task", undefined, 82),
      n("llm", 200, 46, "model", "LLM", "one call"),
      n("out", 350, 46, "io", "result", undefined, 82),
      n("retrieval", 76, 152, "tool", "retrieval"),
      n("tools", 200, 152, "tool", "tools"),
      n("memory", 324, 152, "store", "memory"),
    ],
    edges: [
      e("in", "llm"),
      e("llm", "out"),
      // Pinned vertical: the three attachments hang off the model's underside,
      // so they never route through the task → result line.
      e("llm", "retrieval", "link", undefined, true, "v"),
      e("llm", "tools", "link", undefined, true, "v"),
      e("llm", "memory", "link", undefined, true, "v"),
    ],
  },
  {
    id: "loop",
    title: "The agent loop",
    caption:
      "An agent is the augmented LLM running in a loop: gather context → act → verify → repeat until the check passes. Every advanced technique in this guide elaborates one of those phases.",
    nodes: [
      n("in", 50, 50, "io", "objective", undefined, 88),
      n("gather", 196, 50, "model", "gather context", undefined, 124),
      n("act", 348, 50, "model", "take action", "tools · code · APIs", 124),
      n("check", 490, 50, "gate", "verify"),
      n("out", 614, 50, "io", "done", undefined, 82),
    ],
    edges: [
      e("in", "gather"),
      e("gather", "act"),
      e("act", "check"),
      e("check", "out"),
      e("check", "gather", "back", "not there yet"),
    ],
  },
  {
    id: "single",
    title: "Single augmented call",
    caption:
      "One well-prompted call with retrieval. The simplest thing that could work — and the thing most production “agent” problems actually needed.",
    nodes: [
      n("in", 50, 46, "io", "task", undefined, 82),
      n("llm", 196, 46, "model", "one call", "prompt + context"),
      n("out", 342, 46, "io", "result", undefined, 82),
      n("ctx", 196, 150, "tool", "retrieval"),
    ],
    edges: [e("in", "llm"), e("llm", "out"), e("llm", "ctx", "link", undefined, true, "v")],
  },
  {
    id: "chain",
    title: "Prompt chaining",
    caption:
      "Fixed sequential stages, each call working the previous output, with programmatic gates between them. Trades latency for accuracy when the steps are knowable up front.",
    nodes: [
      n("in", 46, 58, "io", "input", undefined, 76),
      n("s1", 156, 58, "model", "stage 1"),
      n("g1", 260, 58, "gate", "gate", undefined, 46),
      n("s2", 364, 58, "model", "stage 2"),
      n("g2", 468, 58, "gate", "gate", undefined, 46),
      n("s3", 572, 58, "model", "stage 3"),
      n("out", 682, 58, "io", "output", undefined, 76),
    ],
    edges: [
      e("in", "s1"),
      e("s1", "g1"),
      e("g1", "s2"),
      e("s2", "g2"),
      e("g2", "s3"),
      e("s3", "out"),
    ],
  },
  {
    id: "route",
    title: "Routing",
    caption:
      "Classify the input once with a cheap model, then dispatch to a specialist prompt. Every downstream prompt stays focused — and this is the natural place for cost control.",
    nodes: [
      n("in", 46, 112, "io", "input", undefined, 76),
      n("cls", 176, 112, "model", "classifier", "cheap model"),
      n("r1", 336, 42, "worker", "specialist A"),
      n("r2", 336, 112, "worker", "specialist B"),
      n("r3", 336, 182, "worker", "specialist C"),
      n("out", 486, 112, "io", "output", undefined, 76),
    ],
    edges: [
      e("in", "cls"),
      e("cls", "r1"),
      e("cls", "r2"),
      e("cls", "r3"),
      e("r1", "out"),
      e("r2", "out"),
      e("r3", "out"),
    ],
  },
  {
    id: "parallel",
    title: "Parallelization",
    caption:
      "Sectioning: independent, pre-known shards run simultaneously in isolated windows, then merge. (Voting is the same shape with the same task on every branch.)",
    nodes: [
      n("in", 46, 116, "io", "input", undefined, 76),
      n("split", 172, 116, "model", "sectioning"),
      n("w1", 328, 46, "worker", "shard 1", "own window"),
      n("w2", 328, 116, "worker", "shard 2", "own window"),
      n("w3", 328, 186, "worker", "shard 3", "own window"),
      n("agg", 484, 116, "model", "aggregate"),
      n("out", 604, 116, "io", "output", undefined, 76),
    ],
    edges: [
      e("in", "split"),
      e("split", "w1", "spawn"),
      e("split", "w2", "spawn"),
      e("split", "w3", "spawn"),
      e("w1", "agg"),
      e("w2", "agg"),
      e("w3", "agg"),
      e("agg", "out"),
    ],
  },
  {
    id: "orch",
    title: "Orchestrator–workers",
    caption:
      "A lead agent decomposes the task live — the subtasks weren't knowable in advance — delegates to workers in their own windows, reads their reports, and synthesizes. The backbone of most serious multi-agent systems.",
    nodes: [
      n("in", 46, 122, "io", "task", undefined, 76),
      n("lead", 176, 122, "model", "lead agent", "decomposes live"),
      n("w1", 336, 46, "worker", "worker", "own window"),
      n("w2", 336, 122, "worker", "worker", "own window"),
      n("w3", 336, 198, "worker", "worker", "own window"),
      n("synth", 496, 122, "model", "synthesis"),
      n("out", 616, 122, "io", "result", undefined, 76),
    ],
    edges: [
      e("in", "lead"),
      e("lead", "w1", "spawn"),
      e("lead", "w2", "spawn"),
      e("lead", "w3", "spawn"),
      e("w1", "synth"),
      e("w2", "synth"),
      e("w3", "synth"),
      e("synth", "out"),
      e("w3", "lead", "back", "reports → re-plan"),
    ],
  },
  {
    id: "evalopt",
    title: "Evaluator–optimizer",
    caption:
      "One call generates, another scores it against explicit criteria and demands revisions. Worth it when the criteria are crisp and iteration genuinely improves the output.",
    nodes: [
      n("in", 50, 56, "io", "brief", undefined, 76),
      n("gen", 186, 56, "model", "generator"),
      n("eval", 336, 56, "model", "evaluator", "scores vs rubric"),
      n("out", 476, 56, "io", "accepted", undefined, 84),
    ],
    edges: [
      e("in", "gen"),
      e("gen", "eval"),
      e("eval", "out"),
      e("eval", "gen", "back", "revise"),
    ],
  },
  {
    id: "agent",
    title: "Full agent loop",
    caption:
      "No fixed path: the model directs its own process and tool use, checking its work as it goes. Belongs in a sandbox, with a crisp check somebody else wrote.",
    nodes: [
      n("in", 46, 116, "io", "objective", undefined, 88),
      n("agent", 190, 116, "model", "agent", "directs itself"),
      n("tools", 344, 46, "tool", "tools · env"),
      n("check", 344, 190, "gate", "verify"),
      n("out", 490, 190, "io", "done", undefined, 76),
    ],
    edges: [
      e("in", "agent"),
      e("agent", "tools", "link", undefined, true),
      e("agent", "check"),
      e("check", "out"),
      e("check", "agent", "back", "not passing"),
    ],
  },
  {
    id: "research",
    title: "The research system (orchestrator–workers at scale)",
    caption:
      "Anthropic's Research feature: an Opus lead plans, Sonnet subagents search in parallel in separate context windows, the lead synthesizes, and a separate citation pass — fresh context — attributes the claims.",
    nodes: [
      n("in", 46, 122, "io", "question", undefined, 86),
      n("lead", 182, 122, "model", "lead agent", "Opus · plans"),
      n("s1", 342, 46, "worker", "subagent", "parallel search"),
      n("s2", 342, 122, "worker", "subagent", "parallel search"),
      n("s3", 342, 198, "worker", "subagent", "parallel search"),
      n("synth", 502, 122, "model", "synthesis"),
      n("cite", 640, 122, "gate", "citation pass", "fresh context", 116),
      n("out", 776, 122, "io", "report", undefined, 76),
    ],
    edges: [
      e("in", "lead"),
      e("lead", "s1", "spawn"),
      e("lead", "s2", "spawn"),
      e("lead", "s3", "spawn"),
      e("s1", "synth"),
      e("s2", "synth"),
      e("s3", "synth"),
      e("synth", "cite"),
      e("cite", "out"),
      e("s3", "lead", "back", "reports → re-plan"),
    ],
  },
  {
    id: "teams",
    title: "Agent teams (2026)",
    caption:
      "Teammates run independently — own context window, own Git worktree — and unlike subagents they talk to each other directly rather than only reporting to a parent.",
    nodes: [
      n("lead", 238, 46, "model", "team lead", "your session"),
      n("t1", 92, 172, "worker", "teammate", "own worktree"),
      n("t2", 238, 172, "worker", "teammate", "own worktree"),
      n("t3", 384, 172, "worker", "teammate", "own worktree"),
    ],
    edges: [
      e("lead", "t1", "spawn", undefined, undefined, "v"),
      e("lead", "t2", "spawn", undefined, undefined, "v"),
      e("lead", "t3", "spawn", undefined, undefined, "v"),
      // The edge subagents don't have: teammates talk to each other.
      e("t1", "t2", "link", undefined, true),
      e("t2", "t3", "link", undefined, true),
    ],
  },
];

const byId = new Map(GRAPHS.map((g) => [g.id, g]));

export function graphById(id: string): AgentGraph | undefined {
  return byId.get(id);
}

/** The seven L1 patterns share their ids with their graphs. */
export function graphFor(pattern: PatternId): AgentGraph {
  return byId.get(pattern)!;
}

// ---------------------------------------------------------------------------
// SVG rendering
// ---------------------------------------------------------------------------

let uid = 0;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const width = (node: GraphNode): number => node.w ?? NODE_W;

interface Path {
  d: string;
  mx: number;
  my: number;
}

/** Route one edge between two boxes. Mostly-horizontal pairs leave through the
 *  sides, mostly-vertical ones through the top/bottom, and `back` edges dip
 *  under everything so a loop reads as a loop. */
function edgePath(s: GraphNode, t: GraphNode, kind: EdgeKind, axis?: "h" | "v"): Path {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const horizontal = axis ? axis === "h" : Math.abs(dx) > Math.abs(dy);

  if (kind === "back") {
    const sy = s.y + NODE_H / 2;
    const ty = t.y + NODE_H / 2;
    const dip = Math.max(sy, ty) + 36;
    return {
      d: `M ${s.x} ${sy} C ${s.x} ${dip}, ${t.x} ${dip}, ${t.x} ${ty}`,
      mx: (s.x + t.x) / 2,
      my: 0.125 * (sy + ty) + 0.75 * dip,
    };
  }

  if (horizontal) {
    const sign = Math.sign(dx) || 1;
    const sx = s.x + (sign * width(s)) / 2;
    const tx = t.x - (sign * width(t)) / 2;
    const mid = (sx + tx) / 2;
    return {
      d: `M ${sx} ${s.y} C ${mid} ${s.y}, ${mid} ${t.y}, ${tx} ${t.y}`,
      mx: (sx + tx) / 2,
      my: (s.y + t.y) / 2,
    };
  }

  // Vertical: spread the departure point across the source's edge so a fan-out
  // to several targets leaves as a fan instead of a single overloaded point.
  const sign = Math.sign(dy) || 1;
  const spread = Math.max(0, width(s) / 2 - 14);
  const sx = s.x + Math.max(-spread, Math.min(spread, dx * 0.3));
  const sy = s.y + (sign * NODE_H) / 2;
  const ty = t.y - (sign * NODE_H) / 2;
  const mid = (sy + ty) / 2;
  return {
    d: `M ${sx} ${sy} C ${sx} ${mid}, ${t.x} ${mid}, ${t.x} ${ty}`,
    mx: (sx + t.x) / 2,
    my: (sy + ty) / 2,
  };
}

function defs(id: string): string {
  const head = `<path d="M0,0 L7,3 L0,6 z" />`;
  return `<defs>
      <marker id="${id}-h" class="ag-head" viewBox="0 0 7 6" refX="6.4" refY="3" markerWidth="6" markerHeight="6" orient="auto">${head}</marker>
      <marker id="${id}-hl" class="ag-head link" viewBox="0 0 7 6" refX="6.4" refY="3" markerWidth="6" markerHeight="6" orient="auto">${head}</marker>
      <marker id="${id}-hs" class="ag-head link" viewBox="0 0 7 6" refX="0.6" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M7,0 L0,3 L7,6 z" /></marker>
    </defs>`;
}

function nodeSvg(node: GraphNode): string {
  const w = width(node);
  const x = node.x - w / 2;
  const y = node.y - NODE_H / 2;
  const label = node.sub
    ? `<text class="ag-label" x="${node.x}" y="${node.y - 2}">${esc(node.label)}</text>
       <text class="ag-sub" x="${node.x}" y="${node.y + 11}">${esc(node.sub)}</text>`
    : `<text class="ag-label" x="${node.x}" y="${node.y + 4}">${esc(node.label)}</text>`;
  return `<g class="ag-node ${node.kind}" data-node="${node.id}">
      <rect x="${x}" y="${y}" width="${w}" height="${NODE_H}" rx="7" />
      ${label}
    </g>`;
}

export interface RenderOpts {
  /** the lab's in-flight view: nodes can be lit as the run reaches them */
  live?: boolean;
}

export function renderGraph(g: AgentGraph, opts: RenderOpts = {}): string {
  const id = `ag${++uid}`;
  const pos = new Map(g.nodes.map((node) => [node.id, node]));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of g.nodes) {
    minX = Math.min(minX, node.x - width(node) / 2);
    maxX = Math.max(maxX, node.x + width(node) / 2);
    minY = Math.min(minY, node.y - NODE_H / 2);
    maxY = Math.max(maxY, node.y + NODE_H / 2);
  }
  // Back edges dip below the lowest box, and their labels sit below that.
  if (g.edges.some((edge) => edge.kind === "back")) maxY += 46;

  const edges = g.edges
    .map((edge) => {
      const s = pos.get(edge.from);
      const t = pos.get(edge.to);
      if (!s || !t) return "";
      const kind = edge.kind ?? "flow";
      const p = edgePath(s, t, kind, edge.axis);
      const marker = kind === "link" ? `${id}-hl` : `${id}-h`;
      const start = edge.both ? ` marker-start="url(#${id}-hs)"` : "";
      const label = edge.label
        ? `<text class="ag-edge-label" x="${p.mx}" y="${p.my + (kind === "back" ? 13 : -7)}">${esc(edge.label)}</text>`
        : "";
      return `<path class="ag-edge ${kind}" d="${p.d}" marker-end="url(#${marker})"${start} />${label}`;
    })
    .join("");

  const x = minX - PAD;
  const y = minY - PAD;
  const w = maxX - minX + PAD * 2;
  const h = maxY - minY + PAD * 2;
  const aria = `${g.title}: ${g.caption}`;

  return `<svg class="ag-svg${opts.live ? " live" : ""}" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(aria)}" style="--ag-w:${Math.round(w)}px">
      <title>${esc(aria)}</title>
      ${defs(id)}
      ${edges}
      ${g.nodes.map(nodeSvg).join("")}
    </svg>`;
}

/** Diagram plus caption — what section bodies, the lab and the architect show. */
export function renderFigure(g: AgentGraph, opts: RenderOpts = {}): string {
  return `<figure class="agraph">
      ${renderGraph(g, opts)}
      <figcaption><strong>${esc(g.title)}</strong> — ${esc(g.caption)}</figcaption>
    </figure>`;
}

// ---------------------------------------------------------------------------
// Mermaid — the same graph, for places that take text: the architect's
// decision brief renders it on GitHub, in Notion, and in most RFC tooling.
// ---------------------------------------------------------------------------

const MERMAID_SHAPE: Record<NodeKind, [string, string]> = {
  io: ["([", "])"],
  model: ["[", "]"],
  worker: ["[/", "/]"],
  gate: ["{{", "}}"],
  tool: ["[(", ")]"],
  store: ["[(", ")]"],
};

const MERMAID_ARROW: Record<EdgeKind, string> = {
  flow: "-->",
  spawn: "==>",
  back: "-.->",
  link: "<-.->",
};

export function mermaidFor(g: AgentGraph): string {
  const label = (node: GraphNode): string => {
    const [open, close] = MERMAID_SHAPE[node.kind];
    // `<br/>` is the one tag every Mermaid renderer agrees on — don't get fancy.
    const text = node.sub ? `${node.label}<br/>${node.sub}` : node.label;
    return `${node.id}${open}"${text}"${close}`;
  };
  const seen = new Set<string>();
  const lines: string[] = ["flowchart LR"];
  for (const edge of g.edges) {
    const s = g.nodes.find((node) => node.id === edge.from);
    const t = g.nodes.find((node) => node.id === edge.to);
    if (!s || !t) continue;
    const arrow = MERMAID_ARROW[edge.kind ?? "flow"];
    const arrowed = edge.label ? `${arrow}|${edge.label}|` : arrow;
    lines.push(`  ${seen.has(s.id) ? s.id : label(s)} ${arrowed} ${seen.has(t.id) ? t.id : label(t)}`);
    seen.add(s.id);
    seen.add(t.id);
  }
  return lines.join("\n");
}
