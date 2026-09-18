const assert=require('node:assert/strict');
const ribbon=require('../js/chrome-ribbons.js');
for(let r=0;r<12;r++) for(const t of [0,1,50,10000]) {
    const start=ribbon.point(r,0,t),end=ribbon.point(r,1,t);
    assert(Math.hypot(start.x-end.x,start.y-end.y)<1e-10);
    for(let i=0;i<112;i++) {
        const p=ribbon.point(r,i/112,t);
        assert(Object.values(p).every(Number.isFinite));
        assert(p.width>0 && Math.hypot(p.x,p.y)<2);
        const next=ribbon.point(r,i/112+0.0001,t);
        assert(Math.hypot(next.x-p.x,next.y-p.y)>0.00001, 'No pinched zero-tangent bends');
    }
}
let fills=0;
const ctx=new Proxy({createLinearGradient(){return {addColorStop(p){assert(p>=0&&p<=1);}}},fill(){fills++;}}, {get(o,k){return k in o?o[k]:()=>{}}});
ribbon.draw(ctx,1920,1080,25,{density:100,baseSize:6,zoom:1},['#64748b']);
assert.equal(fills,8);
fills=0;
ribbon.draw(ctx,1920,1080,25,{density:1440,baseSize:6,zoom:1},['#64748b']);
assert.equal(fills,14); // 13.5 ribbons: 13 opaque fills plus one fractional layer.
fills=0;
ribbon.draw(ctx,1920,1080,25,{density:1920,baseSize:6,zoom:1},['#64748b']);
assert.equal(fills,18);
fills=0;
ribbon.draw(ctx,1920,1080,25,{density:8000,baseSize:6,zoom:1},['#64748b']);
assert.equal(fills,24);
console.log('Chrome ribbons: closed curves, finite bounds and 8–24 layer range pass.');
