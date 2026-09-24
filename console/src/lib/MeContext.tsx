"use client";
import { createContext, useContext } from "react";
import type { Me } from "./api";

const MeContext = createContext<{ me: Me; refresh: () => Promise<void> } | null>(null);

export function MeProvider({
  me,
  refresh,
  children,
}: {
  me: Me;
  refresh: () => Promise<void>;
  children: React.ReactNode;
}) {
  return <MeContext.Provider value={{ me, refresh }}>{children}</MeContext.Provider>;
}

/** useMeContext — (app) layout ichidagi sahifalar uchun: qayta /api/me so'ramaydi. */
export function useMeContext() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMeContext faqat (app) ichida ishlaydi");
  return ctx;
}
