import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

export default function Landing() {
  redirect(`/c/${randomUUID()}`);
}
