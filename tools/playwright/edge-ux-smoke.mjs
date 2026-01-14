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
      await page.waitForSelector(".react-flow__node", { timeout: 8000 });

      let nodes = page.locator(".react-flow__node");
      let nodeCount = await nodes.count();
      const canvas = page.locator(".react-flow");
      const canvasBox = await canvas.boundingBox();
      if (!canvasBox) {
        throw new Error("Unable to find the DAG canvas for adding a node.");
      }

      const getNodeIds = async () =>
        nodes.evaluateAll((els) => els.map((el) => el.getAttribute("data-id")));
      const getEdgeIds = async () =>
        page.$$eval(".react-flow__edge", (els) => els.map((el) => el.getAttribute("data-id")));

      const createNode = async (name) => {
        await page.mouse.dblclick(
          canvasBox.x + canvasBox.width - 60,
          canvasBox.y + canvasBox.height - 60
        );
        await page.waitForSelector(".node-name-prompt__input", { timeout: 4000 });
        await page.fill(".node-name-prompt__input", name);
        await page.click(".node-name-prompt__submit");
        await page.waitForTimeout(600);
        nodes = page.locator(".react-flow__node");
        nodeCount = await nodes.count();
      };

      let nodeIds = await getNodeIds();
      if (nodeCount < 3) {
        const baseName = nodeIds.includes("Z") ? "Z1" : "Z";
        await createNode(baseName);
        nodeIds = await getNodeIds();
      }
      if (nodeCount < 3) {
        throw new Error("Expected at least three nodes to test edge interactions.");
      }

      const sourceId = nodeIds.includes("X") ? "X" : nodeIds.find(Boolean);
      if (!sourceId) {
        throw new Error("Unable to resolve a source node id.");
      }
      const edgeIds = await getEdgeIds();
      let targetId = nodeIds.find(
        (id) => id && id !== sourceId && !edgeIds.includes(`${sourceId}->${id}`)
      );
      if (!targetId) {
        let suffix = 1;
        let fallback = "Z";
        while (nodeIds.includes(fallback)) {
          fallback = `Z${suffix}`;
          suffix += 1;
        }
        await createNode(fallback);
        nodeIds = await getNodeIds();
        targetId = nodeIds.find((id) => id === fallback);
      }
      if (!targetId) {
        throw new Error("Unable to resolve a target node id.");
      }

      const sourceNode = page.locator(`.react-flow__node[data-id="${sourceId}"]`);
      const targetNode = page.locator(`.react-flow__node[data-id="${targetId}"]`);
      await sourceNode.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "10-node-selected.png"), fullPage: true });

      const sourceBoxBefore = await sourceNode.boundingBox();
      if (!sourceBoxBefore) {
        throw new Error("Unable to read source node bounds before drag.");
      }
      const dragStartX = sourceBoxBefore.x + sourceBoxBefore.width / 2;
      const dragStartY = sourceBoxBefore.y + sourceBoxBefore.height / 2;
      await page.mouse.move(dragStartX, dragStartY);
      await page.mouse.down();
      await page.mouse.move(dragStartX + 60, dragStartY + 20);
      await page.mouse.up();
      await page.waitForTimeout(400);
      const sourceBoxAfter = await sourceNode.boundingBox();
      if (!sourceBoxAfter) {
        throw new Error("Unable to read source node bounds after drag.");
      }
      const movedDistance = Math.hypot(
        sourceBoxAfter.x - sourceBoxBefore.x,
        sourceBoxAfter.y - sourceBoxBefore.y
      );
      if (movedDistance < 8) {
        throw new Error("Node drag did not move the node; connection handles may be blocking drag.");
      }

      await sourceNode.click();
      await page.waitForTimeout(250);

      const sourceHandle = sourceNode.locator(".node-handle--source.node-handle--right").first();
      const sourceBox = await sourceHandle.boundingBox();
      const targetBox = await targetNode.boundingBox();
      if (!sourceBox || !targetBox) {
        throw new Error("Unable to locate node handles for drag interaction.");
      }

      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
      await page.mouse.up();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "11-edge-added.png"), fullPage: true });

      const edgeIdsAfter = await getEdgeIds();
      if (!edgeIdsAfter.includes(`${sourceId}->${targetId}`)) {
        throw new Error("Expected a new edge to be added after connecting nodes.");
      }

      const sourceCenterX = sourceBoxAfter.x + sourceBoxAfter.width / 2;
      const sourceCenterY = sourceBoxAfter.y + sourceBoxAfter.height / 2;
      const targetCenterX = targetBox.x + targetBox.width / 2;
      const targetCenterY = targetBox.y + targetBox.height / 2;
      const midX = (sourceCenterX + targetCenterX) / 2;
      const midY = (sourceCenterY + targetCenterY) / 2 + 12;
      await page.mouse.click(midX, midY);
      await page.waitForTimeout(300);
      const selectedEdges = await page.locator(".react-flow__edge.selected").count();
      if (selectedEdges < 1) {
        throw new Error("Expected an edge to be selectable when clicking near the line.");
      }
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "12-edge-selected.png"), fullPage: true });

      console.log("Edge UX smoke run complete.");
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
