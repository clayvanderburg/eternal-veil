const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const events = [];
const context = { window: { dispatchEvent: e => events.push(e.detail) }, console,
    CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = opts.detail; } },
    URL: { revokeObjectURL() {} }, navigator: { mediaDevices: {} }, MediaStream: class {constructor(tracks) {this.tracks=tracks;}} };
vm.runInNewContext(fs.readFileSync('js/synth.js','utf8'), context);
const engine = context.window.CosmicSynth;
const node = () => ({ outputs: [], gain: {value:1,linearRampToValueAtTime(){},setValueAtTime(){}}, connect(n){this.outputs.push(n);},disconnect(){this.outputs=[];},frequencyBinCount:128,getByteFrequencyData(a){a.fill(64);} });
let created = 0;
engine.initialized = true;
engine.ctx = { state:'running',currentTime:1,destination:node(),createAnalyser:node,createGain:node,
    createMediaElementSource: () => {created++;return node();},createMediaStreamSource:node,resume:()=>Promise.resolve() };
engine.masterGain = node();
const audio = {paused:false,pause(){this.paused=true;}};
engine.attachPlaylistAudio(audio);
assert.equal(engine.visualizerMode,'playlist');
assert.equal(engine.playlistSource.outputs[0],engine.musicAnalyser);
assert.equal(engine.musicAnalyser.outputs[0],engine.playlistGain);
assert.equal(engine.playlistGain.outputs[0],engine.ctx.destination);
audio.paused=false;
assert(engine.getMusicAnalysis().bass>0);
audio.pause();assert.equal(engine.getMusicAnalysis(),null);
const source=engine.playlistSource,gain=engine.playlistGain;
engine.stopMusicReactivity();
assert.equal(engine.getMusicAnalysis(),null);
assert.equal(source.outputs.length,0);assert.equal(gain.outputs.length,0);assert.equal(engine.musicAnalyser.outputs.length,0);
engine.attachPlaylistAudio(audio);assert.equal(created,1,'same media element uses one source node across reconnects');
let resolveCapture;
context.navigator.mediaDevices.getDisplayMedia=()=>new Promise(r=>resolveCapture=r);
let stopped=0;
const track={stop(){stopped++;}};
const delayed=engine.toggleSystemAudioReactivity();
engine.attachPlaylistAudio(audio);
resolveCapture({getTracks:()=>[track]});
(async()=>{
    assert.equal(await delayed,false);
    assert.equal(engine.visualizerMode,'playlist','late permission result cannot take over a new source');
    assert.equal(stopped,1);
    context.navigator.mediaDevices.getDisplayMedia=async()=>({getTracks:()=>[track],getVideoTracks:()=>[],getAudioTracks:()=>[track]});
    assert.equal(await engine.toggleSystemAudioReactivity(),true);
    assert.equal(engine.visualizerMode,'system');assert(audio.paused);
    assert.equal(engine.musicAnalyser.outputs.length,0,'device analysis never routes capture back to speakers');
    engine.stopMusicReactivity();assert.equal(engine.systemStream,null);assert.equal(engine.systemSource,null);
    assert(events.includes('playlist')&&events.includes('system')&&events.includes('none'));
    console.log('Music routing: scene analyser, pause reset, source reuse/cleanup, capture race, and no device feedback passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
