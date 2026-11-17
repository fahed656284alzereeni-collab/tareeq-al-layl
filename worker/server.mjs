import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { mkdir, readFile, writeFile, rename, stat, readdir, rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { get, put, del, issueSignedToken, presignUrl } from "@vercel/blob";

const PORT = Number(process.env.PORT || 3000);
const MAX_FILE_BYTES = 1024 * 1024 * 1024;
const MAX_CONVERSION_MS = 35 * 60 * 1000;
const OUTPUT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const WORKER_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(os.homedir(), "mersal-converter-data");
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS || "https://mersal-v2.vercel.app").split(",").map(value => value.trim()).filter(Boolean));
const queue = [];
let queueRunning = false;

function send(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function setCors(request, response) {
  const origin = request.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,Content-Range");
  response.setHeader("Access-Control-Max-Age", "600");
}

function safeName(value) {
  const base = path.basename(String(value || "file")).replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\/]/g, "_").trim();
  return (base || "file").slice(0, 180);
}

function safeUserId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80);
}

function jobDirectory(userId, jobId) {
  return path.join(DATA_ROOT, safeUserId(userId), jobId);
}

function jobFile(userId, jobId) {
  return path.join(jobDirectory(userId, jobId), "job.json");
}

async function saveJob(job) {
  const target = jobFile(job.userId, job.id);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = target + ".tmp";
  await writeFile(temporary, JSON.stringify(job), "utf8");
  await rename(temporary, target);
}

async function loadJob(userId, jobId) {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  try {
    const job = JSON.parse(await readFile(jobFile(userId, jobId), "utf8"));
    return job.userId === userId ? job : null;
  } catch {
    return null;
  }
}

function publicJob(job) {
  return {
    jobId: job.id,
    filename: job.filename,
    outputName: job.outputName || "",
    size: job.size,
    uploadedBytes: job.uploadedBytes || 0,
    status: job.status,
    stage: job.stage,
    progress: job.status === "uploading" ? Math.floor((job.uploadedBytes || 0) / job.size * 100) : (job.status === "completed" ? 100 : null),
    errorCode: job.errorCode || "",
    createdAt: job.createdAt,
    completedAt: job.completedAt || null
  };
}

async function authenticate(request) {
  const authorization = request.headers.authorization || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + token }
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user && user.id ? user : null;
}

async function readJson(request, maximum = 32768) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximum) throw Object.assign(new Error("request-too-large"), { code: "request-too-large" });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function countActiveUserJobs(userId) {
  const directory = path.join(DATA_ROOT, safeUserId(userId));
  let entries = [];
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return 0; }
  let count = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const job = JSON.parse(await readFile(path.join(directory, entry.name, "job.json"), "utf8"));
      if (["preparing", "queued", "converting", "uploading-result"].includes(job.status)
        && Date.now() - Number(job.createdAt || 0) < 24 * 60 * 60 * 1000) count++;
    } catch {}
  }
  return count;
}

async function createJob(user, body) {
  const filename = safeName(body.filename);
  const size = Number(body.size);
  const direction = body.direction;
  const id = String(body.jobId || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw Object.assign(new Error("invalid-job-id"), { code:"invalid-job-id", status:400 });
  }
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE_BYTES) {
    throw Object.assign(new Error("invalid-file-size"), { code:"invalid-file-size", status:413 });
  }
  if (direction !== "pdf-to-word" && direction !== "word-to-pdf") {
    throw Object.assign(new Error("invalid-direction"), { code:"invalid-direction", status:400 });
  }
  const extension = direction === "pdf-to-word" ? "pdf" : "docx";
  const expected = direction === "pdf-to-word" ? /\.pdf$/i : /\.docx$/i;
  if (!expected.test(filename)) {
    throw Object.assign(new Error("invalid-file-type"), { code:"invalid-file-type", status:415 });
  }
  const expectedBlobPath = "mersal-converter/" + safeUserId(user.id) + "/" + id + "/input." + extension;
  if (body.inputPath !== expectedBlobPath) {
    throw Object.assign(new Error("invalid-input-path"), { code:"invalid-input-path", status:403 });
  }
  if (await countActiveUserJobs(user.id) > 0) {
    throw Object.assign(new Error("active-job-exists"), { code:"active-job-exists", status:409 });
  }
  const outputName = filename.replace(/\.(pdf|docx)$/i, "") + (direction === "pdf-to-word" ? ".docx" : ".pdf");
  const job = {
    id, userId:user.id, filename, size, direction, outputName,
    inputBlobPath:expectedBlobPath,
    uploadedBytes:0, status:"preparing", stage:"download",
    errorCode:"", createdAt:Date.now()
  };
  await mkdir(jobDirectory(user.id, id), { recursive:true });
  await saveJob(job);
  void prepareJob(job);
  return job;
}

async function prepareJob(job) {
  try {
    job.status = "preparing";
    job.stage = "download";
    await saveJob(job);
    const blob = await get(job.inputBlobPath, { access:"private" });
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      throw Object.assign(new Error("input-download-failed"), { code:"input-download-failed" });
    }
    const stream = typeof blob.stream.getReader === "function" ? Readable.fromWeb(blob.stream) : blob.stream;
    await pipeline(stream, createWriteStream(inputPath(job)));
    const downloaded = await stat(inputPath(job));
    if (downloaded.size !== job.size) {
      throw Object.assign(new Error("input-size-mismatch"), { code:"input-download-failed" });
    }
    job.uploadedBytes = job.size;
    job.status = "queued";
    job.stage = "queued";
    await saveJob(job);
    enqueue(job);
  } catch (error) {
    job.status = "failed";
    job.stage = "failed";
    job.errorCode = error.code || "input-download-failed";
    await saveJob(job);
  }
}

function inputPath(job) {
  return path.join(jobDirectory(job.userId, job.id), job.direction === "pdf-to-word" ? "source.pdf" : "source.docx");
}

function outputPath(job) {
  return path.join(jobDirectory(job.userId, job.id), job.direction === "pdf-to-word" ? "result.docx" : "source.pdf");
}

function runProcess(command, args, cwd, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.on("data", chunk => { stdout = (stdout + chunk.toString()).slice(-12000); });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk.toString()).slice(-12000); });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref?.();
    }, timeoutMs);
    child.once("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", code => {
      clearTimeout(timer);
      if (timedOut) return reject(Object.assign(new Error("conversion-timeout"), { code: "conversion-timeout" }));
      if (code === 20) return reject(Object.assign(new Error("too-many-pages"), { code: "too-many-pages" }));
      if (code !== 0) return reject(Object.assign(new Error(stderr || stdout || "conversion-failed"), { code: "conversion-failed" }));
      resolve({ stdout, stderr });
    });
  });
}

async function processJob(job) {
  const source = inputPath(job);
  const target = outputPath(job);
  const directory = jobDirectory(job.userId, job.id);
  try {
    job.status = "converting";
    job.stage = "convert";
    job.errorCode = "";
    await saveJob(job);
    await rm(target, { force: true });

    if (job.direction === "pdf-to-word") {
      await runProcess(
        path.join(WORKER_DIR, ".venv", "bin", "python"),
        [path.join(WORKER_DIR, "pdf_to_docx.py"), source, target],
        directory,
        MAX_CONVERSION_MS
      );
    } else {
      await runProcess(
        "soffice",
        [
          "-env:UserInstallation=file:///tmp/mersal-lo-" + job.id,
          "--headless", "--nologo", "--nodefault", "--nofirststartwizard",
          "--convert-to", "pdf", "--outdir", directory, source
        ],
        directory,
        MAX_CONVERSION_MS
      );
      await runProcess(
        path.join(WORKER_DIR, ".venv", "bin", "python"),
        ["-c", "import fitz,sys; d=fitz.open(sys.argv[1]); sys.exit(20 if d.page_count > 100 else 0)", target],
        directory,
        120000
      );
    }

    const resultStat = await stat(target);
    if (!resultStat.size || resultStat.size > MAX_FILE_BYTES) {
      throw Object.assign(new Error("output-too-large"), { code: "output-too-large" });
    }
    if (!BLOB_TOKEN) throw Object.assign(new Error("storage-not-configured"), { code: "storage-not-configured" });

    job.status = "uploading-result";
    job.stage = "save";
    await saveJob(job);

    const pathname = "mersal-converter/" + safeUserId(job.userId) + "/" + job.id + "/" + job.outputName;
    const contentType = job.direction === "pdf-to-word"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";
    const asciiName = job.outputName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    await put(pathname, createReadStream(target), {
      access: "private",
      token: BLOB_TOKEN,
      addRandomSuffix: false,
      allowOverwrite: true,
      multipart: true,
      contentType,
      contentDisposition: "attachment; filename=\"" + asciiName + "\"; filename*=UTF-8''" + encodeURIComponent(job.outputName)
    });

    job.outputPath = pathname;
    job.status = "completed";
    job.stage = "complete";
    job.errorCode = "";
    job.completedAt = Date.now();
    await saveJob(job);
    await del(job.inputBlobPath, { access:"private", token:BLOB_TOKEN }).catch(() => {});
    await rm(source, { force: true });
    await rm(target, { force: true });
  } catch (error) {
    job.status = "failed";
    job.stage = "failed";
    job.errorCode = error.code || "conversion-failed";
    await saveJob(job);
  }
}

async function drainQueue() {
  if (queueRunning) return;
  queueRunning = true;
  while (queue.length) {
    const job = queue.shift();
    await processJob(job);
  }
  queueRunning = false;
}

function enqueue(job) {
  if (!queue.some(item => item.id === job.id)) queue.push(job);
  void drainQueue();
}

async function recoverJobs() {
  await mkdir(DATA_ROOT, { recursive: true });
  const users = await readdir(DATA_ROOT, { withFileTypes: true }).catch(() => []);
  const cutoff = Date.now() - OUTPUT_RETENTION_MS;
  for (const userEntry of users) {
    if (!userEntry.isDirectory()) continue;
    const userDirectory = path.join(DATA_ROOT, userEntry.name);
    const jobs = await readdir(userDirectory, { withFileTypes: true }).catch(() => []);
    for (const entry of jobs) {
      if (!entry.isDirectory()) continue;
      const file = path.join(userDirectory, entry.name, "job.json");
      try {
        const job = JSON.parse(await readFile(file, "utf8"));
        if (Number(job.createdAt || 0) < cutoff) {
          await rm(path.join(userDirectory, entry.name), { recursive: true, force: true });
          continue;
        }
        if (job.status === "preparing") {
          void prepareJob(job);
        } else if (job.status === "converting" || job.status === "uploading-result") {
          const sourceStat = await stat(inputPath(job)).catch(() => null);
          if (sourceStat && sourceStat.size === job.size) {
            job.status = "queued";
            job.stage = "queued";
            job.errorCode = "";
            await saveJob(job);
            enqueue(job);
          } else {
            void prepareJob(job);
          }
        } else if (job.status === "queued") {
          enqueue(job);
        }
      } catch {}
    }
  }
}

async function getShareUrl(job) {
  if (!job.outputPath) throw Object.assign(new Error("output-not-found"), { code: "output-not-found", status: 404 });
  const expiry = Date.now() + 24 * 60 * 60 * 1000;
  const signed = await issueSignedToken({
    pathname: job.outputPath,
    operations: ["get"],
    validUntil: expiry,
    token: BLOB_TOKEN
  });
  const result = await presignUrl(signed, {
    operation: "get",
    pathname: job.outputPath,
    access: "private",
    validUntil: expiry
  });
  return result.presignedUrl;
}

const server = http.createServer(async (request, response) => {
  setCors(request, response);
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    return response.end();
  }

  const url = new URL(request.url || "/", "http://localhost:" + PORT);
  if (url.pathname === "/health" && request.method === "GET") {
    const ready = Boolean(BLOB_TOKEN && SUPABASE_URL && SUPABASE_ANON_KEY);
    return send(response, ready ? 200 : 503, { ready, maxFileBytes: MAX_FILE_BYTES });
  }

  try {
    const user = await authenticate(request);
    if (!user) return send(response, 401, { code: "not-authenticated" });

    if (url.pathname === "/jobs" && request.method === "POST") {
      const body = await readJson(request);
      const job = await createJob(user, body);
      return send(response, 202, publicJob(job));
    }

    const match = url.pathname.match(/^\/jobs\/([0-9a-f-]{36})(?:\/(chunk|complete|share))?$/i);
    if (!match) return send(response, 404, { code: "not-found" });
    const job = await loadJob(user.id, match[1]);
    if (!job) return send(response, 404, { code: "job-not-found" });
    const action = match[2] || "";

    if (request.method === "GET" && !action) return send(response, 200, publicJob(job));

    if (request.method === "POST" && action === "complete") {
      if (job.status === "completed" || job.status === "queued" || job.status === "converting" || job.status === "uploading-result") {
        return send(response, 202, publicJob(job));
      }
      const sourceStat = await stat(inputPath(job)).catch(() => null);
      if (!sourceStat || sourceStat.size !== job.size) {
        return send(response, 409, { code: "upload-incomplete", uploadedBytes: sourceStat?.size || 0 });
      }
      if (queue.length >= 5) return send(response, 429, { code: "conversion-queue-full" });
      job.uploadedBytes = job.size;
      job.status = "queued";
      job.stage = "queued";
      job.errorCode = "";
      await saveJob(job);
      enqueue(job);
      return send(response, 202, publicJob(job));
    }

    if (request.method === "GET" && action === "share") {
      if (job.status !== "completed") return send(response, 409, { code: "conversion-not-complete" });
      const shareUrl = await getShareUrl(job);
      return send(response, 200, { url: shareUrl, outputName: job.outputName, expiresInSeconds: 86400 });
    }

    if (request.method === "DELETE" && !action) {
      if (job.inputBlobPath) await del(job.inputBlobPath, { access:"private", token:BLOB_TOKEN }).catch(() => {});
      if (job.outputPath) await del(job.outputPath, { access:"private", token:BLOB_TOKEN }).catch(() => {});
      await rm(jobDirectory(user.id, job.id), { recursive:true, force:true });
      return send(response, 200, { deleted: true });
    }

    return send(response, 405, { code: "method-not-allowed" });
  } catch (error) {
    const status = Number(error.status) || (error.code === "request-too-large" ? 413 : 500);
    return send(response, status, { code: error.code || "worker-error" });
  }
});

await recoverJobs();
server.listen(PORT, "0.0.0.0", () => {
  console.log("Mersal private document conversion worker listening on " + PORT);
});
