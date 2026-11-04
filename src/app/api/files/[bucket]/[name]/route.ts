import fs from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isOwnedFileName } from "@/lib/auth";
import { handleApiError, jsonError, requireUser } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

const PRIVATE_BUCKET = "app-documents";
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ bucket: string; name: string }> },
) {
  try {
    const { bucket, name } = await params;
    if (bucket !== PRIVATE_BUCKET && bucket !== "app-files") {
      return jsonError("File not found.", 404);
    }
    if (!SAFE_NAME.test(name) || name.includes("..") || name.includes("/")) {
      return jsonError("File not found.", 404);
    }

    if (bucket === PRIVATE_BUCKET) {
      const user = await requireUser();
      const limited = enforceRateLimit(
        request,
        "private-file",
        120,
        10 * 60 * 1000,
        user.id,
      );
      if (limited) return limited;

      const db = await getDb();
      const profiles = [...db.farmerProfiles, ...db.ownerProfiles];
      const matches = (value?: string | null) =>
        Boolean(value && (value === name || value.endsWith(`/${name}`)));
      const referencing = profiles.filter(
        (profile) =>
          matches(profile.documents?.dlPhoto) ||
          matches(profile.documents?.rcPhoto),
      );

      // A private document is readable only by the account that uploaded it.
      // The signed filename marker covers the window between upload and profile
      // save; profiles cover files created before the marker existed.
      const ownedByUploader = isOwnedFileName(name, user.id);
      if (!ownedByUploader && !referencing.some((profile) => profile.userId === user.id)) {
        return jsonError("File not found.", 404);
      }
    }

    let fileData: Blob | Buffer | Uint8Array | null = null;
    try {
      const { data, error } = await getSupabaseAdmin()
        .storage.from(bucket)
        .download(name);
      if (!error && data) {
        fileData = data;
      }
    } catch {
      // Supabase download failed or offline; check local filesystem fallback
    }

    if (!fileData) {
      try {
        const localPath = path.join(process.cwd(), "public", "uploads", name);
        fileData = await fs.readFile(localPath);
      } catch {
        return jsonError("File not found.", 404);
      }
    }

    const extension = name.split(".").pop()?.toLowerCase();
    const contentType =
      extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : extension === "avif"
            ? "image/avif"
            : "image/jpeg";

    const cacheHeader =
      bucket === "app-files"
        ? "public, max-age=86400, stale-while-revalidate=604800"
        : "private, no-store, max-age=0";

    const responseBody = fileData instanceof Blob ? fileData : new Uint8Array(fileData.buffer, fileData.byteOffset, fileData.byteLength);
    return new Response(responseBody as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": cacheHeader,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
