"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` on import — must be client-only, no SSR.
const Map = dynamic(() => import("./Map"), { ssr: false });

export default function MapWrapper() {
  return <Map />;
}
