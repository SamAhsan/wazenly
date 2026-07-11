import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://wazenlyapp.com"),
  title: { template: "%s — Wazenly", default: "Wazenly — Official WhatsApp Business Platform" },
  description: "Enterprise WhatsApp Business Solution Provider. Send campaigns, manage a shared team inbox, automate conversations, and track performance at scale on the official Meta WhatsApp Business API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              classNames: {
                toast: "!glass !text-gray-900",
                title: "!font-semibold",
                description: "!text-gray-600",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
