#!/usr/bin/env bun
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSdks, listTargets } from "./engine";
import type { GeneratorTarget } from "./types";

function repoRootFromImportMeta(metaUrl: string): string {
  const here = dirname(fileURLToPath(metaUrl));
  return join(here, "..", "..", "..");
}

function parseArgs(argv: string[]): { command: string; target: GeneratorTarget; dryRun: boolean } {
  const [command = "help", ...rest] = argv;
  let target: GeneratorTarget = "all";
  let dryRun = false;
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === "--target" && rest[i + 1]) {
      target = rest[i + 1] as GeneratorTarget;
      i += 1;
      continue;
    }
    if (arg === "--dry-run") dryRun = true;
  }
  return { command, target, dryRun };
}

const { command, target, dryRun } = parseArgs(process.argv.slice(2));
const repoRoot = repoRootFromImportMeta(import.meta.url);

switch (command) {
  case "generate":
    generateSdks({ repoRoot, target, dryRun });
    break;
  case "list":
    for (const entry of listTargets()) {
      console.log(`${entry.id}\t${entry.description}`);
    }
    break;
  default:
    console.log(`Usage:
  bun src/cli.ts generate [--target <id>|all] [--dry-run]
  bun src/cli.ts list

Targets: ${listTargets().map((t) => t.id).join(", ")}, all`);
    break;
}
