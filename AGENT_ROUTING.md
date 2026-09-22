# Efficient agent routing

This is the Eternal Void implementation of the useful Jev-harness ideas. It uses
deterministic local routing and gates; no external model, API key, or usage cost.

## Start a task

Choose one lane and generate one reusable packet:

```powershell
node tools/context-pack.js preset-2d --out scratch/context-packet.md
```

Or route a plain task description with deterministic keywords:

```powershell
node tools/context-pack.js auto "refine Celtic Current for phones" --out scratch/context-packet.md
```

Available lanes: `preset-2d`, `music`, `mobile`, `deploy`, `3d-vr`, `default`.
Read the packet's files in order. Search the listed symbols once and put findings in
the packet. Every agent in the session should reuse that evidence instead of repeating
the same broad repository scan. Do not commit generated context packets.

The route definitions live in `AGENT_CONTEXT_ROUTES.json`. Add a lane only when it
has a distinct file set and verification path. Keep the base instructions small.

## Decide with code where code can decide

Use `node tools/work-gate.js <lane>` before declaring integration complete. The gate
runs syntax and behavioral checks appropriate to the lane. It does not approve visual
quality, music feel, phone frame rate, headset behavior, or deployment. Record those
observations separately.

Hard rules, numeric bounds, schema validity, Flow registration, save/share behavior,
and release markers belong in code and tests. AI judgment is useful for names,
descriptions, visual identity, creative options, and ambiguous review findings.

## Model routing

- Use the lightest available model for bounded edits with obvious output and a fast
  deterministic gate: copy, known value changes, documentation, and simple wiring.
- Use a stronger coding model for interacting animation state, performance problems,
  Flow/music coupling, lifecycle bugs, and changes spanning UI/schema/rendering.
- Use the strongest visual/reasoning model for a new visual grammar, unclear failures,
  architecture, or a review where defects are difficult to spot.
- Keep secrets, deployment authority, and infrastructure on trusted first-party tools.
- Escalate after repeated failed fixes, conflicting evidence, or a result that cannot
  be meaningfully verified. Route by the immediate task rather than the project name.

## Context boundaries

- `preset-2d` is the current default for preset work. It does not load native 3D files.
- `3d-vr` is opt-in while that overhaul remains a lower priority.
- `music` loads the audio pathways and the preset response record.
- `mobile` loads layout, touch, rendering quality, and density paths.
- `deploy` loads release truth and runs the full deterministic gate.

Summaries may locate code; source and executed checks establish current truth. A passed
Git push is separate from a verified live deployment.
