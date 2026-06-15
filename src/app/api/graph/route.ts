import { NextResponse } from "next/server";
import { getFullGraph } from "@/lib/graph/traversal";

export async function GET() {
  try {
    const graph = await getFullGraph();

    return NextResponse.json(
      {
        success: true,
        data: {
          nodes: graph.nodes,
          edges: graph.edges,
          meta: {
            nodeCount: graph.nodes.length,
            edgeCount: graph.edges.length,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] GET /api/graph failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch dependency graph",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
