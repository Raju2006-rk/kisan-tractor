"use client";

import dynamic from "next/dynamic";
import { Tractor } from "lucide-react";

const TractorScene = dynamic(() => import("@/components/three/tractor-scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-forest/10 text-forest/50">
        <Tractor className="size-7" />
      </span>
    </div>
  ),
});

export function TractorSceneLoader() {
  return <TractorScene />;
}
