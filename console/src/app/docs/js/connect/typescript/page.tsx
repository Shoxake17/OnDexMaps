import { permanentRedirect } from "next/navigation";

export default function ConnectTsRedirect(): never {
  permanentRedirect("/docs/integration/typescript");
}
