import { getDb } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase";
import { handleApiError, jsonError, requireUser } from "@/lib/http";

const PRIVATE_BUCKET = "app-documents";
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bucket: string; name: string }> },
) {
  try {
    const user = await requireUser();
    const { bucket, name } = await params;
    if (bucket !== PRIVATE_BUCKET) return jsonError("File not found.", 404);
    if (!SAFE_NAME.test(name) || name.includes("..")) {
      return jsonError("File not found.", 404);
    }

    const db = await getDb();
    const profiles = [...db.farmerProfiles, ...db.ownerProfiles];
    const matches = (value?: string | null) =>
      Boolean(value && (value === name || value.endsWith(`/${name}`)));
    const referencing = profiles.filter(
      (profile) =>
        matches(profile.documents?.dlPhoto) ||
        matches(profile.documents?.rcPhoto),
    );
    if (
      referencing.length > 0 &&
      !referencing.some((profile) => profile.userId === user.id)
    ) {
      return jsonError("You do not have access to this file.", 403);
    }

    const { data, error } = await getSupabaseAdmin()
      .storage.from(PRIVATE_BUCKET)
      .download(name);
    if (error || !data) return jsonError("File not found.", 404);

    return new Response(data, {
      headers: {
        "Content-Type": data.type || "application/octet-stream",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
