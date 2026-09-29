"use strict";
// This draft intentionally has no payment destination. Configure only a verified
// Clay-owned public payment link; credentials never belong in this file.
const supportUrl = "";
const allowedPaymentHosts = new Set(["paypal.me", "www.paypal.com", "paypal.com", "ko-fi.com"]);
function validPaymentDestination(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password &&
            allowedPaymentHosts.has(url.hostname) && url.pathname.length > 1;
    } catch { return false; }
}
const form = document.getElementById("support-interest-form");
const button = document.getElementById("interest-button");
const status = document.getElementById("checkout-status");
const host = window.location.hostname;
const isPreview = host.endsWith("--eternal-veil.netlify.app");
const isProduction = ["eternalvoid.io", "www.eternalvoid.io", "eternal-veil.netlify.app"].includes(host);
const stage = isPreview || new URLSearchParams(window.location.search).get("interest-test") === "1" ? "preview-test" : "production";
// Separate test/production deduplication. No browser identifier is sent.
const storageKey = `eternalVoidSupportInterest:v1:${stage}`;
let submitted = false;
let pending = false;
try { submitted = localStorage.getItem(storageKey) === "yes"; } catch { /* Storage may be blocked. */ }
function showRecorded() {
    button.disabled = true;
    button.textContent = "Interest recorded ✓";
    status.textContent = "Thank you! No payment was taken and no commitment was made.";
}
if (submitted) showRecorded();

if (validPaymentDestination(supportUrl)) {
    const link = document.getElementById("support-link");
    link.href = supportUrl;
    link.hidden = false;
    form.hidden = true;
    document.getElementById("interest-disclosure").hidden = true;
    status.textContent = "Complete your payment securely with the payment provider.";
} else {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (submitted || pending) return;
        if (!isPreview && !isProduction) {
            status.textContent = "Local preview only: no interest was sent or counted. Hosted tracking still needs verification.";
            return;
        }
        if (form.elements.namedItem("bot-field").value) return;
        pending = true;
        button.disabled = true;
        button.textContent = "Recording…";
        status.textContent = "Sending your interest—not a payment.";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            // Only predefined campaign categories, never a URL/referrer/free-text value.
            const candidate = new URLSearchParams(window.location.search).get("utm_source");
            const source = ["youtube", "instagram", "tiktok", "x", "facebook"].includes(candidate) ? candidate : "direct";
            const body = new URLSearchParams({
                "form-name": form.name,
                interest: "yes",
                offer: "optional-support-v1",
                stage,
                source,
                "bot-field": ""
            });
            const response = await fetch("/", {
                method: "POST",
                referrerPolicy: "no-referrer",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString(),
                signal: controller.signal
            });
            if (!response.ok) throw new Error("Submission failed");
            submitted = true;
            try { localStorage.setItem(storageKey, "yes"); } catch { /* In-session guard still applies. */ }
            showRecorded();
        } catch {
            button.disabled = false;
            button.textContent = "Try recording interest again ♡";
            status.textContent = "We couldn’t confirm your interest was recorded. Please try again. No payment was taken.";
        } finally {
            clearTimeout(timeout);
            pending = false;
        }
    });
}
