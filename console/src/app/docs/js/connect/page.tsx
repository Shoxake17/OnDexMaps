import { permanentRedirect } from "next/navigation";

export default function ConnectRedirect(): never {
  permanentRedirect("/docs/integration");
}
