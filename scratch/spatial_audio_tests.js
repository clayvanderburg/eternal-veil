const assert = require('node:assert/strict');
const { SpatialEngine, sanitize } = require('../js/spatial-audio.js');
const param = () => ({ value: 0, events: [], setTargetAtTime(v,t) { this.events.push(['target',v,t]); }, setValueAtTime(v,t) { this.events.push(['set',v,t]); }, linearRampToValueAtTime(v,t) { this.events.push(['ramp',v,t]); }, cancelAndHoldAtTime(t) { this.events.push(['hold',t]); } });
const nodes = [];
function node(type) { const n = { type, gain:param(), pan:param(), frequency:param(), links:[], connect(...args){this.links.push(args);}, disconnect(){this.links=[];}, start(){this.started=true;},stop(){this.stopped=true;} }; nodes.push(n); return n; }
const ctx = { currentTime: 0, sampleRate: 48000, resume: async()=>{}, createGain:()=>node('gain'),createChannelMerger:n=>{assert.equal(n,2);return node('merger');},createOscillator:()=>node('osc'),createStereoPanner:()=>node('pan'),createBiquadFilter:()=>node('filter'),createBufferSource:()=>node('noise'),createBuffer:(channels,size)=>({getChannelData:()=>new Float32Array(size)}) };
const synth = {ctx,visualizerMode:'none',sourceGeneration:0,init(){},stopMusicReactivity(){this.visualizerMode='none';this.sourceGeneration++;},attachSpatialAudio(n){this.visualizerMode='spatial';this.source=n;} };
(async()=>{
    const e = new SpatialEngine(synth); assert(await e.start());
    assert.equal(e.left.frequency.value,200); assert.equal(e.right.frequency.value,206);
    assert.equal(e.left.links[0][2],0); assert.equal(e.right.links[0][2],1);
    assert.equal(e.left.links[0][0],e.right.links[0][0], 'isolated merger inputs');
    assert.equal(e.scheduled,5.05); assert.equal(e.pan.pan.events[0][1],-.8);
    assert.deepEqual(e.pan.pan.events[1],['ramp',.8,5.05]);
    ctx.currentTime=5; e.schedule(); assert.equal(e.scheduled,10.05); assert.equal(e.lastCycle.side,1);
    assert(e.position()<=.8 && e.position()>=-.8);
    e.update({...e.settings,binaural:false,bilateral:false,interval:8,width:2});
    assert.equal(e.settings.width,1); assert.equal(e.tones.gain.events.at(-1)[1],0);
    assert.equal(e.texture.gain.events.at(-1)[1],0,'bilateral off immediately fades');
    ctx.currentTime=5.2;e.schedule();assert.equal(e.texture.gain.events.at(-2)[1],0);
    const sources=[...e.sources];e.stop();assert.equal(e.running,false);assert(sources.every(n=>n.stopped));assert.equal(e.nodes.length,0);assert.equal(e.timer,null);
    e.update({...e.settings,sound:'wind',binaural:true,bilateral:true,minutes:10});assert(await e.start());assert(e.sources.some(n=>n.loop));
    ctx.currentTime=e.started+600;e.schedule();assert.equal(e.running,false,'timer releases nodes');
    let resume;ctx.resume=()=>new Promise(r=>resume=r);const pending=e.start();synth.stopMusicReactivity();resume();assert.equal(await pending,false,'late start cannot replace new source');assert.equal(e.running,false);
    assert.equal(sanitize({carrier:NaN,beat:100,interval:-10,volume:Infinity,sound:'bad'}).beat,40);
    assert.equal(sanitize({interval:-10}).interval,2);
    console.log('Spatial audio: isolated fixed carriers, 5s sweeps, bounds, layer mute, lifecycle, sleep timer and source race passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
