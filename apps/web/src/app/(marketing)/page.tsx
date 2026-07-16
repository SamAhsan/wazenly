import type { Metadata } from "next";
import { Hero } from "@/components/marketing/sections/Hero";
import { Features } from "@/components/marketing/sections/Features";
import { Plans } from "@/components/marketing/sections/Plans";
import { WhyChooseUs } from "@/components/marketing/sections/WhyChooseUs";
import { ProductVideo } from "@/components/marketing/ProductVideo";
import { HowItWorks } from "@/components/marketing/sections/HowItWorks";
import { Security } from "@/components/marketing/sections/Security";
import { Industries } from "@/components/marketing/sections/Industries";
import { Faq, FAQ_ITEMS } from "@/components/marketing/sections/Faq";
import { FinalCta } from "@/components/marketing/sections/FinalCta";

const TITLE = "Wazenly — Official WhatsApp Business API Platform for Teams";
const DESCRIPTION =
  "Wazenly is an enterprise WhatsApp Business API platform: campaigns, a shared team inbox, contact management, automation, and analytics — built on the official Meta WhatsApp Business Platform.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function HomePage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Wazenly",
      url: "https://wazenlyapp.com",
      logo: "https://wazenlyapp.com/logo-mark.png",
      email: "info@wazenlyapp.com",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Wazenly",
      url: "https://wazenlyapp.com",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Wazenly",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: DESCRIPTION,
      offers: { "@type": "Offer", availability: "https://schema.org/InStock" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ];

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero />
      <Features />
      <Plans />
      <WhyChooseUs />
      <ProductVideo />
      <HowItWorks />
      <Security />
      <Industries />
      <Faq />
      <FinalCta />
    </>
  );
}
