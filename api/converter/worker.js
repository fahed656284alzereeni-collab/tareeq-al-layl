import { Sandbox } from "@vercel/sandbox";

const PROJECT_ID = "prj_6ytrPDnMeZG8MbLHov0542MN9yGn";
const TEAM_ID = "team_ak9aTh86EEppjkLuahPMVB1U";
const SANDBOX_NAME = "mersal-converter-worker";
const REPOSITORY_URL = "https://github.com/fahed656284alzereeni-collab/tareeq-al-layl.git";
const SOURCE_BRANCH = "mersal-whatsapp-expansion";
const SUPABASE_URL = "https://nnsleztgbqeuqavkhrpw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0V7aL9rnFz5hFjKoPhz2ig_mSbxBK-T";
const SESSION_TIMEOUT_MS = 45 * 60 * 1000;

export const maxDuration = 60;

async function authenticate(request) {
  const authorization = request.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user && user.id ? user : null;
}

async function getOrCreateSandbox() {
  const options = { name: SANDBOX_NAME, projectId: PROJECT_ID, teamId: TEAM_ID };
  let sandbox;
  try {
    sandbox = await Sandbox.get(options);
  } catch {
    try {
      sandbox = await Sandbox.create({
        ...options,
        source: { type: "git", url: REPOSITORY_URL, revision: SOURCE_BRANCH },
        ports: [3000],
        resources: { vcpus: 4 },
        timeout: SESSION_TIMEOUT_MS,
        region: "fra1",
        persistent: true,
        snapshotExpiration: 7 * 24 * 60 * 60 * 1000,
        networkPolicy: { mode: "allow-all" },
        env: {
          PORT: "3000",
          BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
          SUPABASE_URL,
          SUPABASE_ANON_KEY,
          ALLOWED_ORIGINS: "https://mersal-v2.vercel.app"
        }
      });
    } catch (createError) {
      sandbox = await Sandbox.get(options);
    }
  }

  await sandbox.update({
    timeout: SESSION_TIMEOUT_MS,
    ports: [3000],
    persistent: true,
    snapshotExpiration: 7 * 24 * 60 * 60 * 1000,
    env: {
      PORT: "3000",
      BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      ALLOWED_ORIGINS: "https://mersal-v2.vercel.app"
    }
  });

  const bootstrapCommand = 'ROOT="$(find "$HOME" /workspace /vercel -maxdepth 7 -type f -path "*/worker/bootstrap.sh" -print -quit 2>/dev/null | sed "s|/worker/bootstrap.sh$||")"; if [ -z "$ROOT" ]; then echo "worker source not found"; exit 12; fi; if ! curl -fsS http://127.0.0.1:3000/health >/dev/null 2>&1; then nohup bash "$ROOT/worker/bootstrap.sh" >/tmp/mersal-converter-bootstrap.log 2>&1 </dev/null & fi';
  await sandbox.runCommand("bash", ["-lc", bootstrapCommand], { timeout: 15000 });
  return sandbox.domain(3000);
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ code: "method-not-allowed" });
  const user = await authenticate(request);
  if (!user) return response.status(401).json({ code: "not-authenticated" });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return response.status(503).json({ code: "storage-not-configured" });
  }
  try {
    const workerUrl = await getOrCreateSandbox();
    return response.status(200).json({ workerUrl });
  } catch (error) {
    console.error("Mersal converter worker setup failed:", error);
    return response.status(503).json({ code: "sandbox-not-configured" });
  }
}
