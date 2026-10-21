import "dotenv/config";

async function main() {
  const { runCron } = await import("@/server/services/cron");
  const started = Date.now();
  const summary = await runCron();
  console.log(`[cron] selesai dalam ${Date.now() - started} ms`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("[cron] gagal", error);
  process.exit(1);
});
