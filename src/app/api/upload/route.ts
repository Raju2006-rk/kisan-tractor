import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { handleApiError, jsonError, requireUser } from "@/lib/http";
import { getSupabaseAdmin, isSupabaseDatabaseConfigured } from "@/lib/supabase";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

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
    if (!ALLOWED.includes(file.type)) {
      return jsonError("Please upload a JPG, PNG, WebP or AVIF image.", 400);
    }
    if (file.size > MAX_BYTES) {
      return jsonError("Images must be smaller than 5 MB.", 400);
    }
    const extension =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/avif"
            ? "avif"
            : "jpg";
    const fileName = `${randomUUID()}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    // 1. Try uploading to Supabase Storage 'app-files' bucket first (ideal for production)
    if (isSupabaseDatabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.storage
          .from("app-files")
          .upload(fileName, bytes, {
            contentType: file.type,
            upsert: true,
          });

        if (!error && data) {
          const { data: publicData } = supabase.storage
            .from("app-files")
            .getPublicUrl(fileName);
          if (publicData?.publicUrl) {
            return NextResponse.json({ url: publicData.publicUrl });
          }
        }
      } catch (storageErr) {
        console.warn("Supabase storage upload fallback to local:", storageErr);
      }
    }

    // 2. Fallback to local uploads directory
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, fileName), bytes);
    return NextResponse.json({ url: `/uploads/${fileName}` });
  } catch (error) {
    return handleApiError(error);
  }
}
