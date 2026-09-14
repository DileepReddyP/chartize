import { AdminConsole } from "@/components/admin-console";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { AuthError } from "@/lib/auth/session";

export default async function AdminPage() {
  try { await requireAdmin(); }
  catch (error) {
    if (error instanceof AuthError) redirect("/");
    throw error;
  }
  return <AdminConsole />;
}
