import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ExploreScreen } from "@/components/app/explore-screen";

export const metadata = { title: "Explore tractors" };

export default async function ExplorePage() {
  const user = await getSessionUser();
  if (!user) redirect("/auth");
  return <ExploreScreen user={user} />;
}
