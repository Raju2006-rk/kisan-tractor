import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { handleApiError, jsonError, requireUser } from "@/lib/http";
import { getSupabaseAdmin, isSupabaseDatabaseConfigured } from "@/lib/supabase";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB for smartphone camera photos

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

    // 1. Try uploading to Supabase Storage 'app-files' bucket first
    if (isSupabaseDatabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        let uploadRes = await supabase.storage
          .from("app-files")
          .upload(fileName, bytes, {
            contentType: file.type || "image/jpeg",
            upsert: true,
          });

        // If bucket is missing, create it automatically and retry
        if (
          uploadRes.error &&
          (uploadRes.error.message?.toLowerCase().includes("not found") ||
            (uploadRes.error as { statusCode?: number | string }).statusCode === 404 ||
            (uploadRes.error as { statusCode?: number | string }).statusCode === "404")
        ) {
          try {
            await supabase.storage.createBucket("app-files", {
              public: true,
              fileSizeLimit: 10485760,
            });
            uploadRes = await supabase.storage
              .from("app-files")
              .upload(fileName, bytes, {
                contentType: file.type || "image/jpeg",
                upsert: true,
              });
          } catch (createErr) {
            console.warn("Could not auto-create app-files bucket:", createErr);
          }
        }

        if (!uploadRes.error && uploadRes.data) {
          const { data: publicData } = supabase.storage
            .from("app-files")
            .getPublicUrl(fileName);
          if (publicData?.publicUrl) {
            return NextResponse.json({ url: publicData.publicUrl });
          }
        } else if (uploadRes.error) {
          console.warn("Supabase storage error:", uploadRes.error.message);
        }
      } catch (storageErr) {
        console.warn("Supabase storage upload fallback to local:", storageErr);
      }
    }

    // 2. Fallback to local uploads directory or base64 data URL
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
