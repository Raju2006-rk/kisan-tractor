import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-forest/10 text-forest">
        <Home className="size-8" />
      </div>
      <h1 className="mt-4 font-display text-3xl text-forest sm:text-4xl">
        Page Not Found · पृष्ठ नहीं मिला
      </h1>
      <p className="mt-2 max-w-md text-sm text-stone">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-forest px-6 py-2.5 text-sm font-semibold text-cream shadow transition hover:bg-forest/90"
        >
          <Home className="size-4" /> Go to Dashboard
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-6 py-2.5 text-sm font-semibold text-forest transition hover:bg-sand"
        >
          <ArrowLeft className="size-4" /> Home
        </Link>
      </div>
    </div>
  );
}

