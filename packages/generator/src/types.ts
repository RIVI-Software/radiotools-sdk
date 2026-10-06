export type GeneratorTargetId =
  | "python"
  | "react"
  | "vue"
  | "svelte"
  | "go"
  | "csharp"
  | "ruby"
  | "php"
  | "openapi"
  | "kotlin"
  | "swift"
  | "next";

export type GeneratorTarget = GeneratorTargetId | "all";

export type GenerateOptions = {
  repoRoot: string;
  target: GeneratorTarget;
  dryRun?: boolean;
};

export type GeneratedFile = {
  path: string;
  contents: string;
};

export type SdkTarget = {
  id: GeneratorTargetId;
  description: string;
  outputDir: (repoRoot: string) => string;
  generate: (repoRoot: string) => GeneratedFile[];
};
