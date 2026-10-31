import { redirect } from "next/navigation";
import { isAuthedAdmin } from "@/lib/auth";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Control Room — Tereverus TV" };

export default async function AdminDashboardPage() {
  const authed = await isAuthedAdmin();
  if (!authed) redirect("/admin/login");
  return <AdminDashboard />;
}
