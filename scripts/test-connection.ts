import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

async function test() {
  try {
    const result = await db.execute(sql`SELECT current_database()`);
    console.log("Connection successful!");
    console.log("Database:", result.rows);
    process.exit(0);
  } catch (error) {
    console.error("Connection failed:", error);
    process.exit(1);
  }
}

test();
