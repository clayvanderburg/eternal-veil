"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "support.html"), "utf8");
const script = fs.readFileSync(path.join(__dirname, "support-preview.js"), "utf8");
function setup(url, fetcher, stored = false, blockedStorage = false) {
    const dom = new JSDOM(html, { url, runScripts: "outside-only" });
    const w = dom.window;
    if (stored) w.localStorage.setItem("eternalVoidSupportInterest:v1:production", "yes");
    if (blockedStorage) Object.defineProperty(w, "localStorage", { get() { throw new Error("Blocked"); } });
    w.fetch = fetcher;
    w.eval(script);
    return { dom, w, form: w.document.getElementById("support-interest-form"), button: w.document.getElementById("interest-button"), status: w.document.getElementById("checkout-status") };
}
function submit(t) { t.form.dispatchEvent(new t.w.Event("submit", { bubbles: true, cancelable: true })); }
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
    let requests = [];
    let release;
    const t = setup("https://eternalvoid.io/support?utm_source=instagram", (url, options) => { requests.push({ url, options }); return new Promise(resolve => { release = resolve; }); });
    const fields = [...t.form.elements].filter(el => el.name).map(el => el.name);
    assert.equal(t.form.getAttribute("data-netlify"), "true");
    assert.equal(t.form.getAttribute("netlify-honeypot"), "bot-field");
    submit(t); submit(t);
    assert.equal(requests.length, 1, "double clicks suppressed while pending");
    assert.equal(t.button.disabled, true);
    const body = new URLSearchParams(requests[0].options.body);
    assert.equal(requests[0].options.referrerPolicy, "no-referrer", "do not send the page URL as a referrer");
    for (const key of body.keys()) assert.ok(fields.includes(key), `Registered form field: ${key}`);
    assert.equal(body.get("form-name"), "supporter-interest-v1");
    assert.equal(body.get("stage"), "production");
    assert.equal(body.get("source"), "instagram");
    assert.equal([...body.keys()].length, 6, "no user identifier/email/referrer included");
    release({ ok: true }); await flush();
    assert.match(t.status.textContent, /Thank you/);
    assert.equal(t.w.localStorage.getItem("eternalVoidSupportInterest:v1:production"), "yes");
    submit(t); assert.equal(requests.length, 1, "repeat success suppressed"); t.dom.window.close();

    const prior = setup("https://eternalvoid.io/support", () => { throw new Error("Should not submit"); }, true);
    assert.equal(prior.button.disabled, true); submit(prior); prior.dom.window.close();

    let attempts = 0;
    const failed = setup("https://eternalvoid.io/support", async () => { attempts++; return { ok: false }; });
    submit(failed); await flush();
    assert.equal(failed.button.disabled, false);
    assert.match(failed.status.textContent, /couldn’t confirm/);
    assert.equal(failed.w.localStorage.length, 0);
    submit(failed); await flush(); assert.equal(attempts, 2); failed.dom.window.close();

    for (const url of ["http://127.0.0.1:8767/support.html", "https://untrusted.example/support"]) {
        const local = setup(url, () => { throw new Error("Must not send"); });
        submit(local); assert.match(local.status.textContent, /no interest was sent or counted/); local.dom.window.close();
    }
    const preview = setup("https://test--eternal-veil.netlify.app/support?utm_source=private-value", async (_, opts) => {
        const b = new URLSearchParams(opts.body); assert.equal(b.get("stage"), "preview-test"); assert.equal(b.get("source"), "direct"); return { ok: true };
    }, false, true);
    submit(preview); await flush(); assert.equal(preview.button.disabled, true); preview.dom.window.close();
    const qa = setup("https://eternalvoid.io/support?interest-test=1", async (_, opts) => { assert.equal(new URLSearchParams(opts.body).get("stage"), "preview-test"); return { ok: true }; });
    submit(qa); await flush(); qa.dom.window.close();
    const bot = setup("https://eternalvoid.io/support", () => { throw new Error("Honeypot must not send"); });
    bot.form.elements.namedItem("bot-field").value = "spam"; submit(bot); assert.equal(bot.button.disabled, false); bot.dom.window.close();
    console.log("PASS: registered fields, click payload, dedupe, retry, local non-collection, test labels, blocked storage, and honeypot.");
})().catch(error => { console.error(error); process.exitCode = 1; });
