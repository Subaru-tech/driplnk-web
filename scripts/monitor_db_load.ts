import { Client } from "pg";
import * as fs from "fs";

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  "";

interface Sample {
  timestamp: string;
  total_connections: number;
  postgrest: number;
  supavisor: number;
  pg_net: number;
  other: number;
  waiting_or_locked: number;
}

const samples: Sample[] = [];
let maxTotal = 0;
let maxPostgREST = 0;

async function runMonitor() {
  const client = new Client({ connectionString });
  await client.connect();

  console.log("Database load monitor started. Polling pg_stat_activity every 500ms...");

  const interval = setInterval(async () => {
    try {
      const res = await client.query(`
        SELECT 
          application_name, 
          wait_event_type,
          state
        FROM pg_stat_activity
      `);

      const total = res.rows.length;
      let postgrest = 0;
      let supavisor = 0;
      let pg_net = 0;
      let other = 0;
      let waiting = 0;

      for (const row of res.rows) {
        const app = (row.application_name || "").toLowerCase();
        if (app.includes("postgrest")) postgrest++;
        else if (app.includes("supavisor") || app.includes("pgbouncer")) supavisor++;
        else if (app.includes("pg_net")) pg_net++;
        else other++;

        if (row.wait_event_type && row.wait_event_type !== "Activity" && row.wait_event_type !== "Client") {
          waiting++;
        }
      }

      if (total > maxTotal) maxTotal = total;
      if (postgrest > maxPostgREST) maxPostgREST = postgrest;

      samples.push({
        timestamp: new Date().toISOString(),
        total_connections: total,
        postgrest,
        supavisor,
        pg_net,
        other,
        waiting_or_locked: waiting,
      });
    } catch (e) {
      console.error("Monitor poll error:", e);
    }
  }, 500);

  const cleanup = async () => {
    clearInterval(interval);
    console.log("\nStopping monitor...");

    const summary = {
      total_samples: samples.length,
      max_connections_limit: 60,
      peak_total_connections: maxTotal,
      peak_postgrest_connections: maxPostgREST,
      samples_with_contention_or_locks: samples.filter((s) => s.waiting_or_locked > 0).length,
      start_time: samples[0]?.timestamp,
      end_time: samples[samples.length - 1]?.timestamp,
    };

    fs.writeFileSync("scripts/db_load_metrics.json", JSON.stringify({ summary, samples }, null, 2));
    console.log("Database metrics saved to scripts/db_load_metrics.json");
    console.log("\n=== DATABASE LOAD MONITOR SUMMARY ===");
    console.table([summary]);

    await client.end();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Auto-stop after 100 seconds if not killed earlier
  setTimeout(cleanup, 100000);
}

runMonitor().catch(console.error);
