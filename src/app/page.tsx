import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import FlowStrip from "@/components/FlowStrip";
import BusinessDashboard from "@/components/business/BusinessDashboard";
import AdminDashboard from "@/components/admin/AdminDashboard";
import OfficerFieldView from "@/components/officer/OfficerFieldView";

/**
 * The dashboard for whoever is signed in. The proxy already redirects
 * anonymous visitors to /login; this guard is belt-and-braces.
 */
export default async function Home() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="space-y-8">
      <FlowStrip />
      <section key={user.role} className="animate-fade-up">
        {user.role === "BUSINESS" && <BusinessDashboard />}
        {user.role === "ADMIN" && <AdminDashboard />}
        {(user.role === "OFFICER" || user.role === "GATC") && <OfficerFieldView />}
      </section>
    </div>
  );
}
