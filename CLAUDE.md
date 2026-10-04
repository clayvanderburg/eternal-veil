# Eternal Veil — Claude

**Canonical source:**  
`C:\Users\MadKing\.gemini\antigravity\scratch\eternal-veil`

Connect that path in Cowork as a **plain local folder** (not a junction).

## Read first

1. [AGENTS.md](./AGENTS.md)  
2. [PROJECT_STATUS.md](./PROJECT_STATUS.md)  
3. [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)  
4. Hub desk: `F:\MadKing\grok-shared\agents-hub\projects\eternal-void\README.md`
5. Task lane: `AGENT_ROUTING.md`  

## Preset work

- **Lab first:** build `tools/<presetKey>-lab.html` (see `PRESET_INTEGRATION_CHECKLIST.md` section 0) before polishing a new preset. When Clay pastes the lab's settings JSON, apply it as the preset defaults in one step.
- 2D only for now; 3D/VR is getting its own overhaul.
- Flow palettes are `hsl()` strings: never assume `#rrggbb`.
- Clay pushes to GitHub himself; Cowork's shell has no credentials. Give him: `git -C "C:\Users\MadKing\.gemini\antigravity\scratch\eternal-veil" push origin main`

## Hub

- Canonical hub: `F:\MadKing\grok-shared\agents-hub` — mount it **directly** in Cowork (the `C:\Users\MadKing\Claude\agents-hub` junction can't be mounted).
- Logs often slug `eternal-veil` or `void`

## After work

Write `log\YYYY-MM-DD-claude-eternal-veil-<slug>.md` directly in the F: hub and bump the Eternal Void row in `STATUS.md` if live truth changed. **No sync/push step** — every agent on Jarvis reads the same F: files (`Sync-AgentsHub.ps1` is retired).
