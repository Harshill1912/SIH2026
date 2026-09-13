import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SearchView from "@/components/search/SearchView";

export const metadata = { title: "Search — e-Metrology" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { q } = await searchParams;
  return <SearchView initialQuery={q ?? ""} role={user.role} />;
}
