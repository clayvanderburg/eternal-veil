const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/app.js', 'utf8');
const makeElement = () => {
    const classes = new Set();
    return { classes, focused: false, classList: {
        add: name => classes.add(name), remove: name => classes.delete(name)
    }, matches() { return this.focused; }, addEventListener(type, fn) { this[type] = fn; } };
};
const elements = Object.fromEntries(['hud', 'floatingActions', 'sidebarHandle', 'controlPanel', 'flowStatusBanner'].map(key => [key, makeElement()]));
const ids = Object.fromEntries(['music-player', 'spatial-player', 'music-source-dialog', 'hide-controls-btn', 'panel-hide-controls-btn'].map(key => [key, makeElement()]));
let timer;
const handlers = {};
const ctx = vm.createContext({ elements,
    document: { getElementById: id => ids[id], activeElement: { blur() {} } },
    window: { addEventListener: (name, fn) => { handlers[name] = fn; } },
    setTimeout: (fn, delay) => { timer = { fn, delay }; return 1; }, clearTimeout: () => { timer = null; }
});
vm.runInContext('let uiFadeTimeout; let uiPointerHeld = false; let uiKeyboardActive = false;\n' +
    source.slice(source.indexOf('    function getFadeUiElements()'), source.indexOf('    function toggleFullscreen()')) +
    source.slice(source.indexOf('        // Touch browsers retain hover/focus'), source.indexOf('        // One-step entry')), ctx);
const all = [...Object.values(elements), ids['music-player'], ids['spatial-player']];
const faded = () => all.every(el => el.classes.has('ui-faded'));
const wake = () => { handlers.pointerdown(); handlers.pointerup(); };
wake();
assert.equal(timer.delay, 4000);
// Simulate sticky focus after closing the console or touching an audio control.
elements.controlPanel.focused = true;
ids['spatial-player'].focused = true;
timer.fn();
assert(faded(), 'Touch focus must not strand any overlay, including Back to flow');
// Diagnostic logger auto-scrolls on periodic Flow updates. A scroll event
// must never be treated as user input, even when the browser marks it trusted.
handlers.scroll?.();
assert(faded(), 'Automatic scrolling must not wake idle controls');
handlers.wheel();
assert(!faded(), 'Actual scroll-wheel input reveals controls');
timer.fn();
assert(faded());
wake();
assert(all.every(el => !el.classes.has('ui-faded')), 'A new tap restores all overlays');
handlers.pointerdown(); timer.fn();
assert(!faded(), 'Do not hide during a held slider/gesture');
handlers.pointercancel(); timer.fn(); assert(faded());
wake(); ids['music-source-dialog'].open = true; timer.fn();
assert(!faded());
ids['music-source-dialog'].open = false; timer.fn(); assert(faded(), 'Dialog close must resume fade without another tap');
wake(); handlers.keydown(); timer.fn();
assert(!faded(), 'Keyboard focus must stay usable');
ids['panel-hide-controls-btn'].click(); assert(faded(), 'Explicit hide overrides focus');
wake(); ids['hide-controls-btn'].click(); assert(faded());
console.log('UI fade: console-close/touch-focus, Back to flow, reveal, held/cancelled gestures, dialog close, keyboard and both hide buttons passed.');
