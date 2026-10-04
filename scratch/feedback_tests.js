"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "feedback.html"), "utf8");
const script = fs.readFileSync(path.join(root, "js/feedback.js"), "utf8");
function setup(url, fetcher) {
    const dom = new JSDOM(html, { url, runScripts: "outside-only" });
    dom.window.fetch = fetcher;
    dom.window.eval(script);
    const form = dom.window.document.getElementById("feedback-form");
    form.elements.namedItem("message").value = "The controls could use a search box.";
    return { dom, form, button: dom.window.document.getElementById("feedback-send"), status: dom.window.document.getElementById("feedback-status") };
}
function submit(t) { t.form.dispatchEvent(new t.dom.window.Event("submit", { bubbles: true, cancelable: true })); }
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
    let requests = [];
    let release;
    const t = setup("https://eternalvoid.io/feedback?utm_source=private-data#private", (url, options) => { requests.push({ url, options }); return new Promise(resolve => { release = resolve; }); });
    const registered = [...t.form.elements].filter(e => e.name).map(e => e.name);
    assert.equal(t.form.getAttribute("data-netlify"), "true");
    assert.equal(t.form.getAttribute("netlify-honeypot"), "bot-field");
    submit(t); submit(t);
    assert.equal(requests.length, 1, "in-flight repeats blocked");
    assert.equal(t.button.disabled, true);
    const body = new URLSearchParams(requests[0].options.body);
    assert.equal(requests[0].url, "/");
    assert.equal(requests[0].options.referrerPolicy, "no-referrer");
    assert.deepEqual([...body.keys()].sort(), ["bot-field", "category", "form-name", "message", "scene", "stage"]);
    for (const key of body.keys()) assert.ok(registered.includes(key), `Netlify registered field ${key}`);
    assert.equal(body.get("stage"), "production");
    assert.equal(body.get("scene"), "", "page URL/hash is not captured");
    release({ ok: true }); await flush();
    assert.match(t.status.textContent, /private review/);
    assert.equal(t.form.elements.namedItem("message").value, "");
    submit(t); assert.equal(requests.length, 1, "success cannot send again");
    t.dom.window.close();

    let attempts = 0;
    const failed = setup("https://eternalvoid.io/feedback", async () => { attempts++; return { ok: false }; });
    const original = failed.form.elements.namedItem("message").value;
    submit(failed); await flush();
    assert.equal(failed.button.disabled, false);
    assert.equal(failed.form.elements.namedItem("message").value, original, "failed request preserves input");
    submit(failed); await flush(); assert.equal(attempts, 2);
    failed.dom.window.close();

    for (const url of ["file:///F:/feedback.html", "http://localhost:8888/feedback", "https://other.example/feedback", "https://eternalvoid.io.evil.example/feedback"]) {
        const local = setup(url, () => { throw new Error("Must not collect here"); });
        submit(local); assert.match(local.status.textContent, /no feedback was sent/);
        local.dom.window.close();
    }
    for (const url of ["https://test--eternal-veil.netlify.app/feedback", "https://eternalvoid.io/feedback?feedback-test=1"]) {
        const preview = setup(url, async (_, opts) => { assert.equal(new URLSearchParams(opts.body).get("stage"), "preview-test"); return { ok: true }; });
        submit(preview); await flush(); assert.equal(preview.button.textContent, "Feedback sent"); preview.dom.window.close();
    }
    for (const value of ["https://evil.example/#scene=abc", "javascript:alert(1)", "https://eternalvoid.io/?private=secret#scene=abc", "https://eternalvoid.io/#seed=abc", "https://user:password@eternalvoid.io/#scene=abc", "https://eternalvoid.io:9000/#scene=abc", "https://eternalvoid.io/#scene=!!!"]) {
        const invalid = setup("https://eternalvoid.io/feedback", () => { throw new Error("Must not send invalid scene link"); });
        invalid.form.elements.namedItem("scene").value = value;
        submit(invalid); assert.match(invalid.status.textContent, /Share Scene link/);
        invalid.dom.window.close();
    }
    const favorite = setup("https://eternalvoid.io/feedback", async (_, opts) => {
        const b = new URLSearchParams(opts.body);
        assert.equal(b.get("scene"), "https://eternalvoid.io/#scene=Abc_-123");
        assert.equal(b.get("category"), "favorite-scene");
        return { ok: true };
    });
    favorite.form.elements.namedItem("category").value = "favorite-scene";
    submit(favorite); assert.match(favorite.status.textContent, /Include a Share Scene link/);
    favorite.form.elements.namedItem("scene").value = "https://www.eternalvoid.io/#scene=Abc_-123";
    submit(favorite); await flush(); assert.equal(favorite.button.textContent, "Feedback sent"); favorite.dom.window.close();

    const bot = setup("https://eternalvoid.io/feedback", () => { throw new Error("Honeypot must not send"); });
    bot.form.elements.namedItem("bot-field").value = "spam"; submit(bot); assert.equal(bot.button.disabled, false); bot.dom.window.close();
    for (const message of [" ", "x".repeat(2001)]) {
        const bad = setup("https://eternalvoid.io/feedback", () => { throw new Error("Invalid text must not send"); });
        bad.form.elements.namedItem("message").value = message; submit(bad); assert.match(bad.status.textContent, /3–2,000/); bad.dom.window.close();
    }
    const index = new JSDOM(fs.readFileSync(path.join(root, "index.html"), "utf8"));
    const nav = index.window.document.querySelector("#hud .project-links");
    assert.ok(nav && !nav.closest("#splash-screen"), "navigation survives entry");
    for (const route of ["/support", "/feedback"]) {
        const link = nav.querySelector(`a[href="${route}"]`);
        assert.equal(link.target, "_blank"); assert.match(link.rel, /noopener/);
    }
    index.window.close();
    console.log("PASS: feedback delivery/error retry, input preservation, registered fields, preview exclusion, private payload, scene link restrictions, favorite requirement, honeypot, and post-entry links.");
})().catch(error => { console.error(error); process.exitCode = 1; });
