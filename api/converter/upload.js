import { handleUpload } from "@vercel/blob/client";

const SUPABASE_URL = "https://nnsleztgbqeuqavkhrpw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0V7aL9rnFz5hFjKoPhz2ig_mSbxBK-T";
const MAX_FILE_BYTES = 1024 * 1024 * 1024;

async function authenticate(accessToken) {
  if (!accessToken) return null;
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey:SUPABASE_ANON_KEY, Authorization:"Bearer " + accessToken }
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user && user.id ? user : null;
}

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ code:"method-not-allowed" });
  try {
    const result = await handleUpload({
      body: request.body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload;
        try { payload = JSON.parse(clientPayload || "{}"); }
        catch { throw new Error("invalid-upload-payload"); }
        const user = await authenticate(payload.accessToken);
        if (!user) throw new Error("not-authenticated");
        if (!/^[0-9a-f-]{36}$/i.test(String(payload.jobId || ""))) throw new Error("invalid-job-id");
        if (payload.direction !== "pdf-to-word" && payload.direction !== "word-to-pdf") throw new Error("invalid-direction");
        const extension = payload.direction === "pdf-to-word" ? "pdf" : "docx";
        const expectedPath = "mersal-converter/" + user.id + "/" + payload.jobId + "/input." + extension;
        if (pathname !== expectedPath) throw new Error("invalid-upload-path");
        return {
          allowedContentTypes: [payload.direction === "pdf-to-word" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: false,
          validUntil: Date.now() + 60 * 60 * 1000,
          tokenPayload: JSON.stringify({ userId:user.id, jobId:payload.jobId, direction:payload.direction })
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = JSON.parse(tokenPayload || "{}");
        if (!payload.userId || !payload.jobId || !blob.pathname.startsWith("mersal-converter/" + payload.userId + "/" + payload.jobId + "/")) {
          throw new Error("invalid-upload-completion");
        }
      }
    });
    return response.status(200).json(result);
  } catch (error) {
    const code = error.message === "not-authenticated" ? 401 : 400;
    return response.status(code).json({ code:error.message || "upload-token-failed" });
  }
}
