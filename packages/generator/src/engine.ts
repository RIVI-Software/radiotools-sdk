import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { csharpTarget } from "./targets/csharp";
import { goTarget } from "./targets/go";
import { kotlinTarget } from "./targets/kotlin";
import { nextTarget } from "./targets/next";
import { openapiTarget } from "./targets/openapi";
import { phpTarget } from "./targets/php";
import { pythonTarget } from "./targets/python";
import { reactTarget } from "./targets/react";
import { rubyTarget } from "./targets/ruby";
import { svelteTarget } from "./targets/svelte";
import { swiftTarget } from "./targets/swift";
import { vueTarget } from "./targets/vue";
import type { GenerateOptions, GeneratedFile, GeneratorTarget, SdkTarget } from "./types";

const targets: SdkTarget[] = [
  pythonTarget,
  reactTarget,
  vueTarget,
  svelteTarget,
  goTarget,
  csharpTarget,
  rubyTarget,
  phpTarget,
  openapiTarget,
  kotlinTarget,
  swiftTarget,
  nextTarget,
];

export function listTargets(): SdkTarget[] {
  return targets;
}

function resolveTargets(target: GeneratorTarget): SdkTarget[] {
  if (target === "all") return targets;
  const match = targets.find((entry) => entry.id === target);
  if (!match) {
    throw new Error(`Unknown target "${target}". Available: ${targets.map((t) => t.id).join(", ")}, all`);
  }
  return [match];
}

function writeGeneratedFile(baseDir: string, file: GeneratedFile, dryRun: boolean): void {
  const fullPath = isAbsolute(file.path) ? file.path : join(baseDir, file.path);
  if (dryRun) {
    console.log(`[dry-run] would write ${fullPath} (${file.contents.length} bytes)`);
    return;
  }
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, file.contents, "utf8");
  console.log(`wrote ${fullPath}`);
}

export function generateSdks(options: GenerateOptions): void {
  const selected = resolveTargets(options.target);
  for (const target of selected) {
    const outDir = target.outputDir(options.repoRoot);
    const files = target.generate(options.repoRoot);
    for (const file of files) {
      writeGeneratedFile(outDir, file, options.dryRun ?? false);
    }
  }
}
