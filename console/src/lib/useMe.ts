"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setCsrf, type Me } from "./api";

/** useMe — joriy sessiya. 401 bo'lsa /login ga yo'naltiradi. */
export function useMe() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const m = await api.me();
      setCsrf(m.csrf);
      setMe(m);
      setError("");
    } catch {
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { me, loading, error, setError, refresh };
}
