import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fileOwnerMarker } from "@/lib/auth";
import { handleApiError, jsonError, requireUser } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSupabaseAdmin, isSupabaseDatabaseConfigured } from "@/lib/supabase";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB for smartphone camera photos
const PUBLIC_BUCKET = "app-files";
const PRIVATE_BUCKET = "app-documents";

type ImageKind = { mime: string; extension: string };

const JPEG: ImageKind = { mime: "image/jpeg", extension: "jpg" };
const PNG: ImageKind = { mime: "image/png", extension: "png" };
const WEBP: ImageKind = { mime: "image/webp", extension: "webp" };
const AVIF: ImageKind = { mime: "image/avif", extension: "avif" };

/**
 * Trust the file signature, not the browser-supplied MIME type. This rejects
 * SVG/HTML masquerading as an image as well as truncated or empty files.
 */
function detectImage(bytes: Buffer): ImageKind | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return JPEG;
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return PNG;
  }
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return WEBP;
  }
  if (
    bytes.toString("ascii", 4, 8) === "ftyp" &&
    ["avif", "avis"].includes(bytes.toString("ascii", 8, 12))
  ) {
    return AVIF;
  }
  return null;
}

async function ensureBucket(
  supabase: SupabaseClient,
  name: string,
  isPublic: boolean,
): Promise<boolean> {
  const { data: existing, error } = await supabase.storage.getBucket(name);
  if (!error && existing) {
    if (Boolean(existing.public) === isPublic) return true;
    const { error: updateError } = await supabase.storage.updateBucket(name, {
      public: isPublic,
      fileSizeLimit: MAX_BYTES,
    });
    if (updateError) {
      console.warn(`Could not update storage bucket '${name}':`, updateError.message);
      return false;
    }
    return true;
  }

  const { error: createError } = await supabase.storage.createBucket(name, {
    public: isPublic,
    fileSizeLimit: MAX_BYTES,
  });
  if (createError) {
    console.warn(`Could not create storage bucket '${name}':`, createError.message);
    return false;
  }
  return true;
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const limited = enforceRateLimit(
      request,
      "upload",
      30,
      60 * 60 * 1000,
      user.id,
    );
    if (limited) return limited;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError("Please send the image as multipart form data.", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError("Please choose an image to upload.", 400);
    }
    if (file.size <= 0) {
      return jsonError("The selected image is empty.", 400);
    }
    if (file.size > MAX_BYTES) {
      return jsonError("Images must be smaller than 10 MB.", 400);
    }
    const purpose = form.get("purpose") === "document" ? "document" : "photo";
    const bytes = Buffer.from(await file.arrayBuffer());
    const kind = detectImage(bytes);
    if (!kind) {
      return jsonError("The file is not a valid JPG, PNG, WebP or AVIF image.", 400);
    }
    const fileName = `${fileOwnerMarker(user.id)}-${randomUUID()}.${kind.extension}`;

    if (isSupabaseDatabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        const bucket = purpose === "document" ? PRIVATE_BUCKET : PUBLIC_BUCKET;
        const bucketReady = await ensureBucket(
          supabase,
          bucket,
          purpose !== "document",
        );
        if (bucketReady) {
          const { error } = await supabase.storage
            .from(bucket)
            .upload(fileName, bytes, {
              contentType: kind.mime,
              upsert: false,
            });

          if (!error) {
            if (purpose === "document") {
              // Documents are private. They are streamed through an authenticated route.
              return NextResponse.json({
                url: `/api/files/${PRIVATE_BUCKET}/${fileName}`,
              });
            }
            // Stream uploaded tractor/profile photos reliably through our server endpoint
            return NextResponse.json({
              url: `/api/files/${PUBLIC_BUCKET}/${fileName}`,
            });
          } else {
            console.warn("Supabase storage error:", error.message);
          }
        }
      } catch (storageErr) {
        console.warn("Supabase storage upload failed:", storageErr);
      }
    }

    // Photos and fallback documents save to the local uploads directory or base64 data URL
    try {
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(path.join(uploadDir, fileName), bytes);
      return NextResponse.json({ url: `/uploads/${fileName}` });
    } catch {
      // In read-only serverless environments, fallback to a base64 data URL so uploads never fail
      const base64 = `data:${kind.mime};base64,${bytes.toString("base64")}`;
      return NextResponse.json({ url: base64 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
