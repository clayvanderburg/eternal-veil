"use strict";
// Social links: only the verified public profiles, opened safely, with labels.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");
const expected = {
    youtube: "https://www.youtube.com/@eternalvoidio",
    instagram: "https://www.instagram.com/eternalvoidio/",
    patreon: "https://www.patreon.com/c/TheEternalVoid"
};
const links = [...html.matchAll(/<a class="social-(?:link|card)"[^>]*>/g)].map(match => match[0]);
assert.equal(links.length, 9, "three networks in the HUD, welcome screen and console");
for (const tag of links) {
    const network = tag.match(/data-network="([^"]+)"/)[1];
    assert.ok(expected[network], `unexpected network ${network}`);
    assert.ok(tag.includes(`href="${expected[network]}"`), `${network} url`);
    assert.ok(tag.includes('target="_blank"') && tag.includes('rel="noopener noreferrer"'), `${network} opens safely`);
    assert.match(tag, /aria-label="[^"]+\(opens a new tab\)"/, `${network} label`);
}
for (const network of Object.keys(expected)) assert.ok(html.includes(`<symbol id="icon-${network}"`), `${network} icon`);
assert.ok(html.includes('href="social.css'), "stylesheet linked");
console.log("PASS: social links (3 verified profiles × HUD, welcome screen, console), safe new tabs, labels, icons.");
