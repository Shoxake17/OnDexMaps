import type { Metadata } from "next";
import { ApiReference } from "@/components/docs/ApiReference";

export const metadata: Metadata = {
  title: "API ma'lumotnomasi (OpenAPI) — OnDexMap",
  description: "OnDexMap REST API'sining rasmiy OpenAPI kontrakti — interaktiv ma'lumotnoma.",
};

export default function ReferencePage() {
  return <ApiReference />;
}
