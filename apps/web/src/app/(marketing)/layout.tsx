import { AnnouncementBar } from "@/components/marketing/AnnouncementBar";
import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBar />
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
