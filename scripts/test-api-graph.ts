import "dotenv/config";

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

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Faultline — Test GET /api/graph");
  console.log("═══════════════════════════════════════════");

  try {
    const response = await fetch(`${BASE_URL}/api/graph`);
    assert("Status is 200", response.status === 200, `got ${response.status}`);

    const body = await response.json();
    assert("Response has success field", body.success === true);

    const { nodes, edges, meta } = body.data;

    assert("Nodes is an array", Array.isArray(nodes));
    assert("Edges is an array", Array.isArray(edges));
    assert("Nodes count is 14", nodes.length === 14, `got ${nodes.length}`);
    assert("Edges count is 22", edges.length === 22, `got ${edges.length}`);

    assert("Meta has nodeCount", meta.nodeCount === 14);
    assert("Meta has edgeCount", meta.edgeCount === 22);

    const firstNode = nodes[0];
    assert("Node has id", typeof firstNode.id === "string");
    assert("Node has name", typeof firstNode.name === "string");
    assert("Node has classification", typeof firstNode.classification === "string");
    assert("Node has healthStatus", typeof firstNode.healthStatus === "string");
    assert("Node has ownerTeam", typeof firstNode.ownerTeam === "string");

    const firstEdge = edges[0];
    assert("Edge has id", typeof firstEdge.id === "string");
    assert("Edge has sourceServiceId", typeof firstEdge.sourceServiceId === "string");
    assert("Edge has targetServiceId", typeof firstEdge.targetServiceId === "string");
    assert("Edge has dependencyType", typeof firstEdge.dependencyType === "string");
    assert("Edge has confidenceScore", typeof firstEdge.confidenceScore === "string");

    const nodeIds = new Set(nodes.map((n: { id: string }) => n.id));
    assert("All node IDs are unique", nodeIds.size === nodes.length);

    const validEdges = edges.every(
      (e: { sourceServiceId: string; targetServiceId: string }) =>
        nodeIds.has(e.sourceServiceId) && nodeIds.has(e.targetServiceId)
    );
    assert("All edges reference valid nodes", validEdges);

    const noSelfEdges = edges.every(
      (e: { sourceServiceId: string; targetServiceId: string }) =>
        e.sourceServiceId !== e.targetServiceId
    );
    assert("No self-referencing edges", noSelfEdges);

    console.log("\n── Response Preview ──");
    console.log(`  Nodes: ${meta.nodeCount}, Edges: ${meta.edgeCount}`);

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
