import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AppNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12 text-center">
      <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-forest/10 text-forest">
        <Home className="size-7" />
      </div>
      <h1 className="mt-4 font-display text-2xl text-forest sm:text-3xl">
        Page Not Found · पृष्ठ नहीं मिला
      </h1>
      <p className="mt-2 max-w-md text-xs sm:text-sm text-stone">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-xs font-semibold text-cream shadow transition hover:bg-forest/90"
        >
          <Home className="size-4" /> Go to Dashboard
        </Link>
        <Link
          href="/explore"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-5 py-2.5 text-xs font-semibold text-forest transition hover:bg-sand"
        >
          <ArrowLeft className="size-4" /> Explore Tractors
        </Link>
      </div>
    </div>
  );
}

