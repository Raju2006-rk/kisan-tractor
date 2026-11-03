import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getTractorDetail, ServiceError } from "@/lib/booking-service";
import { TractorDetailScreen } from "@/components/app/tractor-detail-screen";

export const metadata = { title: "Tractor details" };

export default async function TractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth");
  const { id } = await params;

  let tractor;
  try {
    tractor = await getTractorDetail(id, user.id);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }

  return <TractorDetailScreen tractor={tractor} user={user} />;
}
