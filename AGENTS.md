# Eternal Veil / Eternal Void — multi-agent rules

**Folder name on disk:** `eternal-veil` (do not rename)  
**Canonical path:** `C:\Users\MadKing\.gemini\antigravity\scratch\eternal-veil`  
**Live:** https://eternalvoid.io (also Netlify)

## Before editing

1. Read `CLAUDE.md`, `PROJECT_STATUS.md`, and `DEVELOPER_GUIDE.md`.  
2. Select the narrow task lane in `AGENT_ROUTING.md`; generate and reuse one context packet.
3. Hub: `STATUS.md` + newest relevant Eternal Void note named in the packet.
4. Check the packet's recorded working tree before editing.

## Stack

- Static web visual app: `index.html`, `styles.css`, `js/*`  
- Heavy simulation: `js/simulation.js`, `js/simulation3d*.js`, `js/app.js`  
- Presets / color: `js/presets.js`, `js/color-*.js`  
- Deploy: Netlify (`netlify.toml`)

## Rules

- For every new or substantially changed preset, follow `PRESET_INTEGRATION_CHECKLIST.md` and record evidence, music behavior, and known mode gaps. See `PRESET_IMPLEMENTATION_REVIEW.md` for the 2026-09-18 baseline review.
- Use `node tools/work-gate.js <lane>` for deterministic completion checks. A passing gate does not replace visual, audio, phone, or deployment verification.

- Prefer small, testable visual/sim changes.  
- Don’t commit secrets or chrome profile junk (`chrome-profile/` is local).  
- Avoid bloating primary UI; advanced controls stay progressive.  
- Coordinate via agents-hub — Antigravity, Codex, Grok, Claude, Hermes may all touch this.

## After meaningful work

Hub log: `YYYY-MM-DD-<agent>-eternal-veil-<slug>.md`  
Update `PROJECT_STATUS.md` when live truth changes.
