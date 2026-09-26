import { permanentRedirect } from "next/navigation";

export default function ConnectCspRedirect(): never {
  permanentRedirect("/docs/security/csp");
}
