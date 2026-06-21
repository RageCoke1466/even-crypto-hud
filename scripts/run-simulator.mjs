#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const DEV_URL = 'http://127.0.0.1:5173/';
const SIMULATOR_URL = 'http://localhost:5173/';
const AUTOMATION_PORT = '9898';
const READY_TIMEOUT_MS = 30_000;
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

let viteProcess;
let simulatorProcess;
let shuttingDown = false;

async function main() {
  viteProcess = spawnChild(
    pnpmCommand,
    ['exec', 'vite', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    'Vite',
  );

  await waitForDevServer();

  simulatorProcess = spawnChild(
    pnpmCommand,
    ['exec', 'evenhub-simulator', SIMULATOR_URL, '--automation-port', AUTOMATION_PORT],
    'EvenHub simulator',
  );
}

function spawnChild(command, args, label) {
  const child = spawn(command, args, {
    env: process.env,
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    if (!shuttingDown) {
      console.error(`[simulator] ${label} failed to start: ${error.message}`);
      void shutdown(1);
    }
  });

  child.on('close', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (child === viteProcess && !simulatorProcess) {
      console.error(`[simulator] ${label} exited before the dev server was ready.`);
      void shutdown(code ?? signalToExitCode(signal));
      return;
    }

    if (child === viteProcess) {
      console.error(`[simulator] ${label} exited; stopping simulator.`);
      void shutdown(code ?? signalToExitCode(signal));
      return;
    }

    void shutdown(code ?? signalToExitCode(signal));
  });

  return child;
}

async function waitForDevServer() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < READY_TIMEOUT_MS) {
    if (viteProcess.exitCode !== null) {
      throw new Error('Vite exited before the dev server was ready.');
    }

    try {
      const response = await fetch(DEV_URL, { method: 'HEAD' });

      if (response.ok) {
        return;
      }
    } catch {
      // Vite is still starting.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${DEV_URL}`);
}

async function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  stopChild(simulatorProcess);
  stopChild(viteProcess);
  await delay(250);
  process.exit(exitCode);
}

function stopChild(child) {
  if (child && child.exitCode === null && !child.killed) {
    child.kill('SIGTERM');
  }
}

function signalToExitCode(signal) {
  return signal ? 1 : 0;
}

process.once('SIGINT', () => {
  void shutdown(130);
});
process.once('SIGTERM', () => {
  void shutdown(143);
});

main().catch((error) => {
  console.error(`[simulator] ${error instanceof Error ? error.message : String(error)}`);
  void shutdown(1);
});
