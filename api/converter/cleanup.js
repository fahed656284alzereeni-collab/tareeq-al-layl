import { del, list } from "@vercel/blob";

export const maxDuration = 60;

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ code: "method-not-allowed" });
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.authorization !== "Bearer " + secret) {
    return response.status(401).json({ code: "unauthorized" });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return response.status(503).json({ code: "storage-not-configured" });
  }

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let cursor;
  let deleted = 0;
  let scanned = 0;
  do {
    const page = await list({
      prefix: "mersal-converter/",
      limit: 1000,
      cursor,
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    scanned += page.blobs.length;
    const expired = page.blobs.filter(blob => new Date(blob.uploadedAt).getTime() < cutoff);
    if (expired.length) {
      await del(expired.map(blob => blob.url), {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN
      });
      deleted += expired.length;
    }
    cursor = page.cursor;
  } while (cursor);

  return response.status(200).json({ scanned, deleted });
}
