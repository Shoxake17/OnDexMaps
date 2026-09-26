import { permanentRedirect } from "next/navigation";

export default function ConnectVueRedirect(): never {
  permanentRedirect("/docs/integration/vue");
}
