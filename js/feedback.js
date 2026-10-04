"use strict";
(() => {
    const form = document.getElementById("feedback-form");
    const button = document.getElementById("feedback-send");
    const status = document.getElementById("feedback-status");
    const field = name => form.elements.namedItem(name);
    const host = window.location.hostname;
    const production = ["eternalvoid.io", "www.eternalvoid.io", "eternal-veil.netlify.app"].includes(host);
    const preview = host.endsWith("--eternal-veil.netlify.app");
    const stage = preview || new URLSearchParams(window.location.search).get("feedback-test") === "1" ? "preview-test" : "production";
    const categories = new Set(["suggestion", "problem", "favorite-scene", "other"]);
    let pending = false;
    let sent = false;
    function sceneLink(value) {
        if (!value) return "";
        try {
            const url = new URL(value);
            if (value.length > 12000 || url.protocol !== "https:" || !["eternalvoid.io", "www.eternalvoid.io"].includes(url.hostname) || url.port || url.username || url.password || url.pathname !== "/" || url.search || !/^#scene=[A-Za-z0-9_-]+$/.test(url.hash)) return null;
            // Omit tracking/query data. A received configuration is untrusted until reviewed.
            return `https://eternalvoid.io/${url.hash}`;
        } catch { return null; }
    }
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (pending || sent || field("bot-field").value) return;
        if (!production && !preview) {
            status.textContent = "Preview only: no feedback was sent. Use the live site when this form is available.";
            return;
        }
        const message = field("message").value.trim();
        const category = field("category").value;
        const scene = sceneLink(field("scene").value.trim());
        if (message.length < 3 || message.length > 2000 || !categories.has(category)) {
            status.textContent = "Choose a category and write 3–2,000 characters of feedback.";
            return;
        }
        if (scene === null) {
            status.textContent = "Please paste a Share Scene link from eternalvoid.io, without tracking parameters, or leave it empty.";
            field("scene").focus();
            return;
        }
        if (category === "favorite-scene" && !scene) {
            status.textContent = "Include a Share Scene link so we can try your configuration.";
            field("scene").focus();
            return;
        }
        pending = true;
        button.disabled = true;
        status.textContent = "Sending feedback…";
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
        try {
            const body = new URLSearchParams({ "form-name": form.name, stage, category, message, scene, "bot-field": "" });
            const response = await fetch("/", { method: "POST", referrerPolicy: "no-referrer", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(), signal: controller.signal });
            if (!response.ok) throw new Error("Submission failed");
            sent = true;
            form.reset();
            button.textContent = "Feedback sent";
            status.textContent = "Thank you. Your feedback was sent for private review.";
        } catch {
            button.disabled = false;
            status.textContent = "We couldn’t confirm your feedback was sent. Your text is still here; please try again.";
        } finally {
            clearTimeout(timer);
            pending = false;
        }
    });
})();
