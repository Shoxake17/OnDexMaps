"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, setCsrf } from "@/lib/api";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    api
      .me()
      .then((m) => {
        setCsrf(m.csrf);
        router.replace("/dashboard");
      })
      .catch(() => router.replace("/login"));
  }, [router]);
  return null;
}
