const assert = require('assert');
// Model the 8-bit rounding that makes weak black source-over fades stall.
for (const fade of [0.004, 0.012, 0.026, 0.07]) {
    for (let initial = 0; initial <= 255; initial++) {
        let value = initial;
        for (let frame = 0; frame < 255; frame++) {
            value = Math.abs(Math.round(value * (1 - fade)) - 1);
        }
        assert(value <= 1, 'black-background residue must reach visually black');
    }
}
console.log('Black-background quantization model converges without a gray floor.');
