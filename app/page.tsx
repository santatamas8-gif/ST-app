import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getAppUser();
  if (user) redirect("/dashboard");
  redirect("/login");
}
