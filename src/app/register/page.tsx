import { getSession } from "@/lib/auth";
import RegisterForm from "@/components/auth/RegisterForm";

export const metadata = { title: "Register your business — e-Metrology" };

export default async function RegisterPage() {
  const user = await getSession();
  return <RegisterForm currentUser={user} />;
}
