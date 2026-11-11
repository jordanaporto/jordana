import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/roles";

export default async function Home() {
  const user = await requireUser();
  redirect(homeFor(user.role));
}
