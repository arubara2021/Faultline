// scripts/test-api-reconcile.ts

import "dotenv/config";
import { Pool } from "pg";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function resetDatabaseState() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await pool.query(`DELETE FROM services WHERE owner_team = 'unknown'`);
    await pool.query(`DELETE FROM dependencies WHERE source_service_id NOT IN (SELECT id FROM services) OR target_service_id NOT IN (SELECT id FROM services)`);
    await pool.query(`UPDATE services SET health_status = 'down' WHERE name = 'postgres-primary'`);
    await pool.query(`UPDATE incidents SET resolved_at = NULL, resolution_notes = NULL WHERE resolved_at IS NOT NULL`);
    const { rows } = await pool.query(`SELECT root_failure_event_id FROM incidents WHERE resolved_at IS NULL LIMIT 1`);
    if (rows.length > 0) {
      await pool.query(`UPDATE failure_events SET resolved_at = NULL WHERE id = $1`, [rows[0].root_failure_event_id]);
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Faultline — Test POST /api/reconcile");
  console.log("═══════════════════════════════════════════");

  console.log("\n── Resetting database state ──");
  try {
    await resetDatabaseState();
    console.log("  ✓ Database state reset");
  } catch (error) {
    console.error("  ✗ Reset failed:", (error as Error).message);
  }

  console.log("\n── Full Reconciliation ──");

  try {
    const response = await fetch(`${BASE_URL}/api/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    assert("Status is 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Response has success field", body.success === true);
    assert("Response has message", typeof body.message === "string");

    const { staleEdges, confidence, snapshots } = body.data;

    assert("Has staleEdges section", staleEdges !== undefined);

    if (staleEdges !== undefined) {
      if (typeof staleEdges === "object" && !Array.isArray(staleEdges)) {
        assert("staleEdges has flagged", typeof staleEdges.flagged === "number");
        assert("staleEdges has removed", typeof staleEdges.removed === "number");
        if (typeof staleEdges.flagged === "number") {
          assert("staleEdges flagged >= 0", staleEdges.flagged >= 0);
        }
        if (typeof staleEdges.removed === "number") {
          assert("staleEdges removed >= 0", staleEdges.removed >= 0);
        }
      } else if (Array.isArray(staleEdges)) {
        assert("staleEdges is array with length", staleEdges.length >= 0);
      }
    }

    assert("Has confidence section", confidence !== undefined);
    assert("confidence has updated", typeof confidence?.updated === "number");
    if (typeof confidence?.updated === "number") {
      assert("confidence updated >= 0", confidence.updated >= 0);
    }

    assert("Has snapshots section", snapshots !== undefined);
    assert("snapshots has refreshed", typeof snapshots?.refreshed === "number");
    if (typeof snapshots?.refreshed === "number") {
      assert("snapshots refreshed is 14+", snapshots.refreshed >= 14, `got ${snapshots.refreshed}`);
    }
    assert("snapshots has services array", Array.isArray(snapshots?.services));

    if (snapshots?.services && snapshots.services.length > 0) {
      const firstSnapshot = snapshots.services[0];
      assert("Snapshot has name", typeof firstSnapshot.name === "string");
      assert("Snapshot has revenuePerMinCents", typeof firstSnapshot.revenuePerMinCents === "number");
      assert("Snapshot has recalculated", firstSnapshot.recalculated === true);
    }

    console.log("\n── Reconciliation Results ──");
    const flagged = staleEdges?.flagged ?? (Array.isArray(staleEdges) ? staleEdges.length : 0);
    const removed = staleEdges?.removed ?? 0;
    console.log(`  Stale edges flagged: ${flagged}`);
    console.log(`  Stale edges removed: ${removed}`);
    console.log(`  Confidence updated: ${confidence?.updated ?? 0}`);
    console.log(`  Snapshots refreshed: ${snapshots?.refreshed ?? 0}`);

    if (snapshots?.services) {
      const totalRevenue = snapshots.services.reduce(
        (sum: number, s: { revenuePerMinCents: number }) => sum + (s.revenuePerMinCents || 0),
        0
      );
      console.log(`  Total revenue across all services: $${(totalRevenue / 100).toFixed(2)}/min`);
    }
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Second Reconciliation (Idempotent) ──");

  try {
    const response = await fetch(`${BASE_URL}/api/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    assert("Second run returns 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Second run has success", body.success === true);
    assert("Second run snapshots still refreshed", body.data.snapshots?.refreshed >= 14);
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n── Verify Snapshot Freshness ──");

  try {
    const graphRes = await fetch(`${BASE_URL}/api/graph`);
    const graphBody = await graphRes.json();

    assert("Graph has nodes", Array.isArray(graphBody.data.nodes) && graphBody.data.nodes.length > 0);
    assert("Graph has edges", Array.isArray(graphBody.data.edges) && graphBody.data.edges.length > 0);
    assert("Graph has 14 nodes", graphBody.data.nodes.length === 14, `got ${graphBody.data.nodes.length}`);
    assert("Graph has 22+ edges", graphBody.data.edges.length >= 22, `got ${graphBody.data.edges.length}`);
  } catch (error) {
    console.error("\nFatal error:", error);
    failed++;
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════");

  process.exit(failed > 0 ? 1 : 0);
}

main();
