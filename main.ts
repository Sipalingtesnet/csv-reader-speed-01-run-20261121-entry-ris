// Driver for the make.fun harness: read cases, answer each with solve.js run().
// Imports limited to node:v8, node:fs, node:path. No network, no randomness.
import { setFlagsFromString } from "node:v8";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// GC flag must be set before solve.js is loaded.
setFlagsFromString("--no-incremental-marking");

async function main(): Promise<void> {
  const { run } = await import("./solve.js");
  const inputDir = process.env.MAKEFUN_INPUT_DIR ?? "/input";
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

  const cases: Array<{ id: string; input: unknown }> = JSON.parse(
    readFileSync(join(inputDir, "cases.json"), "utf8"),
  );

  const answers: unknown[] = [];
  for (const c of cases) {
    answers.push(run(c.input));
  }

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "answers.json"), JSON.stringify(answers));
}

main();
