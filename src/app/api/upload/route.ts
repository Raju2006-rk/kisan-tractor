import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleApiError, jsonError, requireUser } from "@/lib/http";
import { getSupabaseAdmin, isSupabaseDatabaseConfigured } from "@/lib/supabase";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB for smartphone camera photos
const PUBLIC_BUCKET = "app-files";
const PRIVATE_BUCKET = "app-documents";

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
    await requireUser();
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
    if (!file.type.startsWith("image/")) {
      return jsonError("Please upload a valid image (JPG, PNG, WebP).", 400);
    }
    if (file.size > MAX_BYTES) {
      return jsonError("Images must be smaller than 10 MB.", 400);
    }
    const purpose = form.get("purpose") === "document" ? "document" : "photo";
    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/avif"
            ? "avif"
            : file.type === "image/gif"
              ? "gif"
              : "jpg";
    const fileName = `${randomUUID()}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());

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
              contentType: file.type || "image/jpeg",
              upsert: false,
            });

          if (!error) {
            if (purpose === "document") {
              // Documents are private. They are streamed through an authenticated route.
              return NextResponse.json({
                url: `/api/files/${PRIVATE_BUCKET}/${fileName}`,
              });
            }
            const { data: publicData } = supabase.storage
              .from(bucket)
              .getPublicUrl(fileName);
            if (publicData?.publicUrl) {
              return NextResponse.json({ url: publicData.publicUrl });
            }
          } else {
            console.warn("Supabase storage error:", error.message);
          }
        }
      } catch (storageErr) {
        console.warn("Supabase storage upload failed:", storageErr);
      }
    }

    if (purpose === "document") {
      return jsonError(
        "Document uploads are temporarily unavailable. Please try again later.",
        503,
      );
    }

    // Photos fall back to the local uploads directory or a base64 data URL.
    try {
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(path.join(uploadDir, fileName), bytes);
      return NextResponse.json({ url: `/uploads/${fileName}` });
    } catch {
      // In read-only serverless environments, fallback to a base64 data URL so uploads never fail
      const base64 = `data:${file.type || "image/jpeg"};base64,${bytes.toString("base64")}`;
      return NextResponse.json({ url: base64 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
