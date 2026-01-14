import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const ROOT = process.cwd();
const HOST = "127.0.0.1";
const ARTIFACT_DIR = path.join(ROOT, "test-artifacts");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (err) {
      // ignore
    }
    await sleep(350);
  }
  return false;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, HOST);
  });
}

async function pickPort() {
  const fromEnv = process.env.UI_SMOKE_PORT;
  if (fromEnv) return Number(fromEnv);
  for (let port = 5173; port <= 5183; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    const open = await isPortOpen(port);
    if (open) return port;
  }
  return 5173;
}

async function run() {
  ensureDir(ARTIFACT_DIR);
  const port = await pickPort();
  const url = `http://${HOST}:${port}/`;
  console.log(`Starting Vite on ${url}`);

  const devServer = spawn(
    "npm",
    ["run", "dev", "--", "--host", HOST, "--port", String(port), "--strictPort"],
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    }
  );

  let exitCode = 1;
  let failure = null;
  try {
    console.log("Waiting for dev server...");
    const ready = await waitForServer(url);
    if (!ready) {
      throw new Error("Dev server did not start in time.");
    }
    console.log("Dev server ready, launching Chromium...");

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      console.log("Page loaded, capturing baseline screenshot...");

      await page.waitForSelector("#root");
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "01-home.png"), fullPage: true });

      // Try the node creation flow in a reliable empty spot.
      const canvas = page
        .locator(".dag-zone, .causion-canvas, .phone-dag-canvas, .react-flow")
        .first();
      await canvas.waitFor({ state: "visible", timeout: 8000 });
      const paneBox = await canvas.boundingBox();
      if (!paneBox) {
        throw new Error("React Flow canvas not found.");
      }
      const clickX = paneBox.x + paneBox.width * 0.8;
      const clickY = paneBox.y + paneBox.height * 0.75;
      await page.mouse.dblclick(clickX, clickY);
      const promptFound = await page
        .waitForSelector(".node-name-prompt__title", { timeout: 4000 })
        .then(() => true)
        .catch(() => false);
      console.log(`Prompt found: ${promptFound}`);
      if (!promptFound) {
        throw new Error("Node prompt did not appear.");
      }
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "02-prompt.png"), fullPage: true });
      const newNodeName = "Z1";
      await page.fill(".node-name-prompt__input", newNodeName);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "03-node-created.png"), fullPage: true });

      // Try opening the node quick menu by clicking the node.
      const node = page.locator(".react-flow__node").filter({ hasText: newNodeName }).first();
      await node.click();
      await page.waitForSelector(".node-quick-menu", { timeout: 4000 });
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "04-node-menu.png"), fullPage: true });

      console.log("Smoke run complete.");
      exitCode = 0;
    } finally {
      await browser.close();
    }
  } catch (err) {
    failure = err;
    console.error(err);
  } finally {
    console.log("Stopping dev server...");
    if (process.platform === "win32" && devServer.pid) {
      spawnSync(
        "powershell.exe",
        ["-Command", `taskkill /PID ${devServer.pid} /T /F`],
        { stdio: "ignore" }
      );
    } else {
      devServer.kill("SIGTERM");
    }
    process.exit(failure ? 1 : exitCode);
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
