import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

async function pushSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    const client = await pool.connect();
    console.log("Connected to database");

    const migrationPath = path.join(
      __dirname,
      "..",
      "src",
      "lib",
      "db",
      "migrations",
      "0000_famous_union_jack.sql"
    );

    if (!fs.existsSync(migrationPath)) {
      console.error("Migration file not found:", migrationPath);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, "utf-8");
    console.log("Migration file loaded");
    console.log("Executing schema...");

    await client.query(sql);

    console.log("Schema pushed successfully!");

    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log("\nTables in database:");
    for (const row of tables.rows) {
      console.log("  -", row.table_name);
    }

    client.release();
  } catch (error) {
    console.error("Push failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

pushSchema();
