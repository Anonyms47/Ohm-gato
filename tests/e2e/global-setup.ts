import { execSync } from "node:child_process";

export default function globalSetup() {
  if (process.env.E2E_SKIP_DB_RESET === "1") return;
  execSync("npx supabase db reset", { stdio: "ignore" });
}
