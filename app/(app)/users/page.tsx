import { redirect } from "next/navigation";

/** Legacy route — canonical admin users page is /admin/users */
export default function UsersPage() {
  redirect("/admin/users");
}
