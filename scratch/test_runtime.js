/**
 * ETERNAL VEIL — Script Runtime Loader Check
 */

// Mock standard browser environment
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const fs = require('fs');
const path = require('path');

const htmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

const dom = new JSDOM(htmlContent, {
    url: "https://localhost",
    runScripts: "outside-only",
    resources: "usable"
});

const { window } = dom;
global.window = window;
global.document = window.document;
global.navigator = window.navigator;
global.localStorage = window.localStorage;
global.sessionStorage = window.sessionStorage;
global.HTMLElement = window.HTMLElement;
global.HTMLCanvasElement = window.HTMLCanvasElement;

// Mock Web Audio API and WebGL Context to prevent Canvas/Audio creation crashes
class AudioContextMock {
    createGain() { return { gain: { value: 1 } }; }
    createOscillator() { return { frequency: { value: 440 }, connect: () => {}, start: () => {} }; }
}
global.window.AudioContext = AudioContextMock;
global.window.webkitAudioContext = AudioContextMock;

global.HTMLCanvasElement.prototype.getContext = function(type) {
    if (type === 'webgl' || type === 'webgl2') {
        return {
            viewport: () => {},
            clearColor: () => {},
            clear: () => {},
            createShader: () => ({}),
            shaderSource: () => {},
            compileShader: () => {},
            getShaderParameter: () => true,
            createProgram: () => ({}),
            attachShader: () => {},
            linkProgram: () => {},
            getProgramParameter: () => true,
            useProgram: () => {},
            createBuffer: () => ({}),
            bindBuffer: () => {},
            bufferData: () => {},
            getAttribLocation: () => 0,
            enableVertexAttribArray: () => {},
            vertexAttribPointer: () => {},
            drawArrays: () => {},
            getExtension: () => null,
            getParameter: () => 0,
            createTexture: () => ({}),
            bindTexture: () => {},
            texImage2D: () => {},
            texParameteri: () => {},
            getUniformLocation: () => ({})
        };
    }
    return {
        clearRect: () => {},
        fillRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        scale: () => {},
        translate: () => {},
        rotate: () => {},
        save: () => {},
        restore: () => {},
        drawImage: () => {}
    };
};

console.log('--------------------------------------------------');
console.log('🧪 RUNNING FULL RUNTIME COMPILATION & LOAD CHECKS...');
console.log('--------------------------------------------------');

// Load scripts sequentially
try {
    // 1. state-schema.js
    const ssCode = fs.readFileSync(path.join(__dirname, '../js/state-schema.js'), 'utf8');
    eval(ssCode);
    console.log('✅ Loaded: state-schema.js');

    // 2. render-quality.js
    const rqCode = fs.readFileSync(path.join(__dirname, '../js/render-quality.js'), 'utf8');
    eval(rqCode);
    console.log('✅ Loaded: render-quality.js');

    // 3. color-theory.js
    const ctCode = fs.readFileSync(path.join(__dirname, '../js/color-theory.js'), 'utf8');
    eval(ctCode);
    console.log('✅ Loaded: color-theory.js');

    // 4. color-cycles.js
    const ccCode = fs.readFileSync(path.join(__dirname, '../js/color-cycles.js'), 'utf8');
    eval(ccCode);
    console.log('✅ Loaded: color-cycles.js');

    // 5. presets.js
    const prCode = fs.readFileSync(path.join(__dirname, '../js/presets.js'), 'utf8');
    eval(prCode);
    console.log('✅ Loaded: presets.js');

    // 6. synth.js
    const syCode = fs.readFileSync(path.join(__dirname, '../js/synth.js'), 'utf8');
    eval(syCode);
    console.log('✅ Loaded: synth.js');

    // 7. exporter.js
    const exCode = fs.readFileSync(path.join(__dirname, '../js/exporter.js'), 'utf8');
    eval(exCode);
    console.log('✅ Loaded: exporter.js');

    // 8. url-sync.js
    const usCode = fs.readFileSync(path.join(__dirname, '../js/url-sync.js'), 'utf8');
    eval(usCode);
    console.log('✅ Loaded: url-sync.js');

    // 9. simulation.js
    const simCode = fs.readFileSync(path.join(__dirname, '../js/simulation.js'), 'utf8');
    eval(simCode);
    console.log('✅ Loaded: simulation.js');

    // 10. simulation3d.js
    const s3dCode = fs.readFileSync(path.join(__dirname, '../js/simulation3d.js'), 'utf8');
    eval(s3dCode);
    console.log('✅ Loaded: simulation3d.js');

    // 11. simulation3d-native.js
    const s3dnCode = fs.readFileSync(path.join(__dirname, '../js/simulation3d-native.js'), 'utf8');
    eval(s3dnCode);
    console.log('✅ Loaded: simulation3d-native.js');

    // 12. app.js
    const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
    
    // Simulate DOMContentLoaded event
    global.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    
    eval(appCode);
    console.log('✅ Loaded: app.js');

    console.log('--------------------------------------------------');
    console.log('🎉 INITIALIZATION SUCCEEDED WITHOUT RUNTIME ERRORS!');
    console.log('--------------------------------------------------');
} catch (e) {
    console.error('❌ RUNTIME ERROR DETECTED:');
    console.error(e);
    process.exit(1);
}
