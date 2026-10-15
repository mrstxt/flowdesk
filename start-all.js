#!/usr/bin/env node
/**
 * FlowDesk — Run both the Telegram userbot worker and the Next.js web server.
 *
 * Usage:
 *   node start-all.js
 *
 * Environment:
 *   - PORT       Port for the Next.js web server (provided by Railway/Vercel).
 *   - STANDALONE_WORKER — When "true", the worker runs alone (no web server).
 */

const { spawn } = require("child_process");

const isStandaloneWorker = process.env.STANDALONE_WORKER === "true";

const children = [];

function startWorker() {
  return new Promise((resolve) => {
    console.log("[start-all] Starting Telegram userbot worker...");
    const child = spawn("npx", ["tsx", "voice-assistant.ts"], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", (err) => {
      console.error("[start-all] Worker error:", err.message);
      resolve();
    });
    child.on("exit", (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`[start-all] Worker exited with code ${code}, signal ${signal}`);
      }
    });
    children.push(child);
    resolve();
  });
}

function startWeb() {
  return new Promise((resolve, reject) => {
    const port = process.env.PORT || "3000";
    console.log(`[start-all] Starting Next.js web server on port ${port}...`);
    const child = spawn("npx", ["next", "start", "-p", port, "-H", "0.0.0.0"], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", (err) => {
      console.error("[start-all] Web server error:", err.message);
      reject(err);
    });
    child.on("exit", (code, signal) => {
      console.log(`[start-all] Web server exited with code ${code}, signal ${signal}`);
    });
    children.push(child);
    resolve();
  });
}

async function main() {
  await startWorker();

  if (!isStandaloneWorker) {
    await startWeb();
  }

  // Handle shutdown signals
  const shutdown = (signal) => {
    console.log(`\n[start-all] Received ${signal}, shutting down...`);
    for (const child of children) {
      try {
        child.kill(signal);
      } catch {}
    }
    // Give processes time to exit gracefully
    setTimeout(() => {
      for (const child of children) {
        try {
          child.kill("SIGKILL");
        } catch {}
      }
      process.exit(0);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[start-all] Fatal error:", err);
  process.exit(1);
});
