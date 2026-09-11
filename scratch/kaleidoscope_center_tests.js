const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/simulation.js'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('            // Apply Kaleidoscope mirror reflection quadrant symmetry');
const end = source.indexOf('\n        }\n\n        this.ctx.restore();', start);
assert(start > 0 && end > start);
const renderCopies = new Function(source.slice(start, end));
for (const [width, height] of [[1600, 900], [900, 1600], [1024, 1024]]) {
    for (const spinning of [false, true]) {
        // Canvas affine matrix, including a pre-existing breath/DPR transform.
        const initial = [1.6, 0, 0, 1.6, 12, 18];
        let m = initial.slice();
        const stack = [];
        const multiply = ([a,b,c,d,e,f]) => {
            const [A,B,C,D,E,F] = m;
            m = [A*a+C*b,B*a+D*b,A*c+C*d,B*c+D*d,A*e+C*f+E,B*e+D*f+F];
        };
        const ctx = {
            save() { stack.push(m.slice()); }, restore() { m = stack.pop(); },
            translate(x,y) { multiply([1,0,0,1,x,y]); },
            rotate(a) { multiply([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]); },
            scale(x,y) { multiply([x,0,0,y,0,0]); }
        };
        let copies = 0;
        ctx.drawImage = () => {
            const x = width/2, y = height/2;
            assert(Math.abs(m[0]*x+m[2]*y+m[4]-(1.6*x+12)) < 1e-8, 'center X invariant');
            assert(Math.abs(m[1]*x+m[3]*y+m[5]-(1.6*y+18)) < 1e-8, 'center Y invariant');
            assert(Math.abs(Math.hypot(m[0]*37+m[2]*19,m[1]*37+m[3]*19)-1.6*Math.hypot(37,19)) < 1e-8, 'radius preserved');
            copies++;
        };
        let particleDraws = 0;
        const particle = {draw() { particleDraws++; }};
        const buffer = {width:width*2,height:height*2};
        const bufferCtx = {setTransform(){},clearRect(){}};
        renderCopies.call({width,height,ctx,canvas:buffer,dpr:2,kaleidoCanvas:{...buffer},kaleidoCtx:bufferCtx,globalTime:1234,particles:[particle],settings:{kaleidoscopeEnabled:true,kaleidoscopeSegments:8,spinningKaleido:spinning}});
        assert.equal(copies,7);
        assert.equal(particleDraws,1,'mirrored particle drawn once, not per segment');
        assert.deepEqual(m,initial, 'outer transform restored');
    }
}
console.log('Kaleidoscope centers, radii and outer transforms preserved across aspect ratios and spin.');
