import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

const TITLE = "Sign In — Wazenly";
const DESCRIPTION = "Sign in to your Wazenly WhatsApp Business API workspace.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/auth/login" },
  robots: { index: false, follow: false },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/auth/login", type: "website" },
};

export default function LoginPage() {
  return <LoginForm />;
}
