# ETERNAL VEIL - Developer Integration Guide & Checklist

This document outlines the state-management architecture of the visualizer and provides a checklist for adding new presets, shapes, or parameter settings in the future.

---

## 🏛️ State Architecture & Manual vs Flow Design
The app supports a dual-mode control system:
1. **Manual Mode**: Settings are controlled directly by user sliders/pickers.
2. **Autopilot (Flow) Mode**: Selected settings morph dynamically over time.

To ensure manual adjustments are always adhered to, the app uses a dynamic override system:
* When a user interacts with a control, `setOptionToManual(key)` is triggered to detach it from the Autopilot flow.
* If **Music Reactivity** is engaged, settings are modulated dynamically in `processMusicReactivity()`. A baseline cache (`baseSettings` and `basePalette`) is captured when music starts and restored when music stops.
* To prevent settings and colors from jumping back to old pre-audio baselines when manual edits are made during music playback, we use wrapper update functions:
  * **`updateActiveSetting(key, value)`**: Updates the simulation settings AND updates the `baseSettings` cache if music reactivity is currently running.
  * **`updateActivePalette(palette)`**: Updates the simulation palette AND updates the `basePalette` cache if music reactivity is running.

---

## 📝 Feature Integration Checklist

When adding a new slider, control, or visual feature, follow this checklist to guarantee correct behavior and prevent parameter-jump bugs:

### 1. HTML Controls & Flow Toggles
* [ ] Add the input/select/toggle element inside `index.html` with a unique ID.
* [ ] Register the control inside `flowableOptions` in `setupFlowToggles()` of `js/app.js`.
* [ ] Add the control key mapping inside `inputToKeyMap` in both `"input"` and `"change"` listeners of `elements.controlPanel` to trigger automatic Manual overrides when edited.

### 2. Parameter Updates & Cache Synchronization
* [ ] Bind the control's input listener in `js/app.js` using `bindSlider` (for sliders) or manually.
* [ ] **CRITICAL**: Always modify settings via `updateActiveSetting(key, value)` or `updateActivePalette(palette)` rather than editing `sim.settings[key] = value` directly. This keeps the music reactivity baseline cache fully in sync.

### 3. Autopilot Flow & Presets
* [ ] Add your setting's key to the `randomizeAllParameters()` list in `js/app.js` inside an `if (isFlowEnabled(key))` guard block.
* [ ] Update `StylePresets` in `js/presets.js` to define default values for your new setting across all existing presets.
* [ ] Ensure `loadPreset(key)` morphs or updates the new setting.

### 4. Audio Reactivity Lifecycle
* [ ] If the new setting is modulated by music frequency/transients:
  * Add the setting key to the initial `baseSettings` backup block in `processMusicReactivity()`.
  * Ensure the audio decay/envelope value is only applied if `isFlowEnabled(key)` is true.
  * Ensure the original value is fully restored when music analysis stops.
