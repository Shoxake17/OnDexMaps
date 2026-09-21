"use client";

/**
 * Xarita, vositalar va yon panelni birlashtiruvchi qobiq.
 *
 * Xarita nusxasi `MapProvider` da, vosita mantig'i `useMapTools` da,
 * interfeys esa shu yerda — har bir qism alohida sinaladi va alohida
 * o'zgartiriladi.
 */

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

import type { MapInit } from "@/lib/mapUrl";

const MapStage = dynamic(() => import("@/components/map/MapStage"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-zinc-50 text-sm text-zinc-500">
      Xarita yuklanmoqda…
    </div>
  ),
});

export default function MapShell({ init }: { init: MapInit }) {
  const [address, setAddress] = useState<string | null>(null);
  const [addressBusy, setAddressBusy] = useState(false);

  const handleAddress = useCallback((text: string | null, busy: boolean) => {
    setAddress(text);
    setAddressBusy(busy);
  }, []);

  return (
    // Balandlik ANIQ beriladi (`h-dvh`): ichkaridagi `h-full`
    // zanjiri shunga tayanadi, aks holda xarita tuvali nol
    // balandlikda qolib, umuman ko'rinmaydi.
    <div className="h-dvh w-full overflow-hidden">
      <MapStage
        init={init}
        address={address}
        addressBusy={addressBusy}
        onAddress={handleAddress}
      />
    </div>
  );
}
