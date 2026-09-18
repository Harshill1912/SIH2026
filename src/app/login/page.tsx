import LoginForm from "@/components/auth/LoginForm";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; next?: string }>;
}) {
  const { as, next } = await searchParams;
  const current = await getSession();
  // Only ever bounce to a same-origin path.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return <LoginForm presetRole={as} next={safeNext} currentUser={current} />;
}
