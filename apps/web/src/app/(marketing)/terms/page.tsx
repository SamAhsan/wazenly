import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/marketing/LegalPage";

const TITLE = "Terms & Conditions — Wazenly";
const DESCRIPTION = "The terms governing your use of the Wazenly WhatsApp Business API platform.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/terms", type: "website" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="July 2026">
      <LegalSection title="1. Acceptance of Terms">
        <p>
          By accessing or using Wazenly (the "Service"), you agree to be bound by these Terms & Conditions ("Terms"). If you do not
          agree to these Terms, do not use the Service. If you are using the Service on behalf of a company, you represent that you
          have authority to bind that company to these Terms.
        </p>
      </LegalSection>

      <LegalSection title="2. Platform Usage">
        <p>
          Wazenly provides a WhatsApp Business API platform for campaign messaging, a shared team inbox, contact management,
          automation, and analytics, built on Meta's official WhatsApp Business Cloud API. Access to the Service is by invitation
          only — Wazenly does not offer public self-registration. Each account is provisioned within a workspace tied to a specific
          business and WhatsApp Business Account.
        </p>
      </LegalSection>

      <LegalSection title="3. User Responsibilities">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>You are responsible for the accuracy of the contact data you upload and for having a lawful basis to message those contacts.</li>
          <li>You are responsible for keeping your login credentials confidential and for all activity under your account.</li>
          <li>You are responsible for the content of messages, templates, and campaigns you send through the Service.</li>
          <li>You must promptly notify us of any unauthorized use of your account.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Acceptable Use">
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Send unsolicited, deceptive, or spam messages, or violate applicable anti-spam or telemarketing laws.</li>
          <li>Send messages that are unlawful, defamatory, harassing, or infringe on the rights of others.</li>
          <li>Attempt to interfere with, disrupt, or gain unauthorized access to the Service or its infrastructure.</li>
          <li>Use the Service to message contacts who have not consented to be contacted, where such consent is legally required.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. WhatsApp Compliance">
        <p>
          Your use of the Service to send WhatsApp messages is subject to Meta's WhatsApp Business Messaging Policy and WhatsApp
          Business Solution Provider terms. Meta — not Wazenly — determines message template approval, messaging limits, and account
          quality ratings. Violations of Meta's policies may result in your WhatsApp Business Account being restricted or banned by
          Meta, independent of any action by Wazenly.
        </p>
      </LegalSection>

      <LegalSection title="6. Intellectual Property">
        <p>
          The Service, including its software, design, branding, and documentation, is the property of Wazenly and its licensors and
          is protected by applicable intellectual property laws. These Terms do not grant you any ownership rights in the Service.
          You retain ownership of the contact data, message content, and other business data you submit to the Service.
        </p>
      </LegalSection>

      <LegalSection title="7. Future Billing">
        <p>
          Wazenly workspaces are currently provisioned directly by our team. If and when self-service or subscription billing is
          introduced, applicable pricing, billing cycles, and payment terms will be presented and agreed to separately before any
          charges apply, and this section will be updated accordingly.
        </p>
      </LegalSection>

      <LegalSection title="8. Account Suspension & Termination">
        <p>
          We may suspend or terminate access to the Service for any account found to violate these Terms, Meta's WhatsApp policies,
          or applicable law, with or without notice depending on the severity of the violation. You may request termination of your
          workspace at any time by contacting us.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of Liability">
        <p>
          The Service is provided "as is" without warranties of any kind, express or implied. To the maximum extent permitted by law,
          Wazenly shall not be liable for any indirect, incidental, special, or consequential damages, or for any loss of messaging
          delivery, data, or business arising from your use of the Service, including any actions taken by Meta on your WhatsApp
          Business Account that are outside of Wazenly's control.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to These Terms">
        <p>
          We may update these Terms from time to time. Material changes will be reflected by updating the "Last updated" date above.
          Continued use of the Service after a change constitutes acceptance of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          Questions about these Terms can be sent to{" "}
          <a href="mailto:info@wazenlyapp.com" className="text-primary hover:underline">info@wazenlyapp.com</a>.
        </p>
      </LegalSection>

      <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
        These Terms are provided as a general reference and are not a substitute for legal advice. We recommend having them
        reviewed by qualified legal counsel for your specific jurisdiction and business needs before relying on them as final.
      </p>
    </LegalPage>
  );
}
