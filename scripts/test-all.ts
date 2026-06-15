import "dotenv/config";
import { spawn } from "child_process";
import path from "path";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

interface TestResult {
  file: string;
  passed: number;
  failed: number;
  skipped: boolean;
  error?: string;
}

const PHASES = [
  {
    name: "Phase 0: Database Reseed",
    seed: true,
    tests: [] as string[],
  },
  {
    name: "Phase 1: Database Direct Tests",
    seed: false,
    tests: [
      "scripts/test-db-queries.ts",
      "scripts/test-graph-traversal.ts",
    ],
  },
  {
    name: "Phase 2: API Route Tests (Group 1)",
    seed: false,
    tests: [
      "scripts/test-api-services.ts",
      "scripts/test-api-graph.ts",
      "scripts/test-api-incident-id.ts",
      "scripts/test-api-incidents.ts",
      "scripts/test-api-ingest.ts",
      "scripts/test-api-health.ts",
    ],
  },
  {
    name: "Phase 2.5: Reseed Before State-Dependent Tests",
    seed: true,
    tests: [] as string[],
  },
  {
    name: "Phase 3: API Route Tests (Group 2 + Simulate)",
    seed: false,
    tests: [
      "scripts/test-api-blast-radius.ts",
      "scripts/test-api-summary.ts",
      "scripts/test-api-resolve.ts",
      "scripts/test-api-reconcile.ts",
      "scripts/test-api-simulate.ts",
    ],
  },
  {
    name: "Phase 4: Error Handling Tests",
    seed: true,
    tests: ["scripts/test-error-handling.ts"],
  },
];

function printBanner(text: string, char = "═", width = 70) {
  console.log(char.repeat(width));
  console.log(`  ${text}`);
  console.log(char.repeat(width));
}

function printSection(text: string, char = "─", width = 50) {
  console.log(`\n${char.repeat(width)}`);
  console.log(`  ${text}`);
  console.log(`${char.repeat(width)}`);
}

async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/services`);
    return res.ok;
  } catch {
    return false;
  }
}

async function seedDatabase(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log("\n─────── Reseeding database with fresh data...");

    const child = spawn("npx", ["tsx", "scripts/seed.ts"], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("close", (code: number | null) => {
      if (code === 0) {
        console.log("\n  ✓ Database reseeded successfully\n");
        resolve(true);
      } else {
        console.error(`\n  ✗ Seed failed with exit code ${code}`);
        resolve(false);
      }
    });

    child.on("error", (err: Error) => {
      console.error(`\n  ✗ Failed to run seed: ${err.message}`);
      resolve(false);
    });
  });
}

function runTest(file: string): Promise<TestResult> {
  return new Promise((resolve) => {
    printSection(`Running: ${file}`);

    const child = spawn("npx", ["tsx", file], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("close", (code: number | null) => {
      const passedMatch = stdout.match(/Results:\s+(\d+)\s+passed/);
      const failedMatch = stdout.match(/(\d+)\s+failed/);

      const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;

      const success = code === 0 && failed === 0;

      resolve({
        file,
        passed,
        failed,
        skipped: false,
        error: success
          ? undefined
          : `Exit code: ${code}, Failed assertions: ${failed}`,
      });
    });

    child.on("error", (err: Error) => {
      resolve({
        file,
        passed: 0,
        failed: 0,
        skipped: false,
        error: err.message,
      });
    });
  });
}

async function main() {
  printBanner("Faultline — Full Test Suite");
  console.log(`\n  Target: ${BASE_URL}`);
  console.log(`  Database: ${process.env.DATABASE_URL ? "configured" : "NOT SET"}`);

  const allResults: TestResult[] = [];
  const startTime = Date.now();

  const serverOk = await checkServer();
  if (!serverOk) {
    console.error("\n  ✗ Server not reachable at", BASE_URL);
    console.error("    Run 'npm run dev' first.\n");
    process.exit(1);
  }
  console.log("\n  ✓ Server is reachable\n");

  for (const phase of PHASES) {
    printBanner(phase.name);

    if (phase.seed) {
      const seedOk = await seedDatabase();
      if (!seedOk) {
        console.error("  ✗ Seed failed, aborting remaining tests.");
        process.exit(1);
      }
    }

    for (const testFile of phase.tests) {
      const result = await runTest(testFile);
      allResults.push(result);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  printBanner("Summary");

  console.log("\n  Results by file:\n");

  let totalPassed = 0;
  let totalFailed = 0;
  let filesPassed = 0;
  let filesFailed = 0;

  for (const r of allResults) {
    const icon = r.skipped ? "⊘" : r.failed === 0 ? "✓" : "✗";
    const status = r.skipped ? "SKIP" : r.failed === 0 ? "PASS" : "FAIL";
    const name = path.basename(r.file).padEnd(38);

    console.log(`    ${icon} ${name} ${status}`);

    totalPassed += r.passed;
    totalFailed += r.failed;

    if (r.failed === 0 && !r.skipped) filesPassed++;
    if (r.failed > 0) filesFailed++;
  }

  console.log(`\n  ──────────────────────────────────────────────────`);
  console.log(`  Total: ${totalPassed} passed, ${totalFailed} failed`);
  console.log(`  Files: ${filesPassed}/${allResults.length} passed`);
  console.log(`  Time:  ${elapsed}s`);
  console.log(`  ──────────────────────────────────────────────────`);

  if (totalFailed === 0) {
    console.log(`\n  ✓ ALL TESTS PASSED\n`);
    process.exit(0);
  } else {
    console.log(`\n  ✗ SOME TESTS FAILED\n`);

    console.log("  Failed files:");
    for (const r of allResults) {
      if (r.failed > 0) {
        console.log(`    ✗ ${r.file}: ${r.error ?? `${r.failed} failed`}`);
      }
    }
    console.log("");

    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFatal error in test runner:", err);
  process.exit(1);
});
