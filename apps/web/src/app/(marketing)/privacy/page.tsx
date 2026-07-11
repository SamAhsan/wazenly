import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/marketing/LegalPage";

const TITLE = "Privacy Policy — Wazenly";
const DESCRIPTION = "How Wazenly collects, uses, and protects your data, including data processed through the WhatsApp Business API.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/privacy", type: "website" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="July 2026">
      <LegalSection title="1. Introduction">
        <p>
          This Privacy Policy explains how Wazenly ("Wazenly", "we", "us") collects, uses, stores, and protects information when you
          use our WhatsApp Business API platform, including our website and dashboard application (together, the "Service"). Wazenly
          operates as a WhatsApp Business Solution built on Meta's official WhatsApp Business Cloud API.
        </p>
      </LegalSection>

      <LegalSection title="2. Information We Collect">
        <p>We collect information in the following categories:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Account information</strong> — name, email address, and password (stored as a salted hash, never in plain text) for users we create or invite.</li>
          <li><strong>Business/workspace information</strong> — company name, connected WhatsApp Business Account details, and team member roles.</li>
          <li><strong>Contact data you upload or receive</strong> — names, phone numbers, and any custom fields or tags you add for the contacts you message through the Service.</li>
          <li><strong>Message content</strong> — the content of WhatsApp conversations sent and received through your connected numbers, stored so your team can view conversation history.</li>
          <li><strong>Usage and analytics data</strong> — campaign performance metrics (delivery, read, and reply rates), login activity, and general platform usage.</li>
          <li><strong>Contact form submissions</strong> — name, company, email, phone, subject, and message, if you contact us through our website.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. WhatsApp Data & Meta API Usage">
        <p>
          Wazenly sends and receives WhatsApp messages exclusively through Meta's official WhatsApp Business Cloud API. When you connect
          a WhatsApp Business Account, Wazenly stores an encrypted access token to communicate with Meta's API on your behalf, along with
          the message content and delivery status Meta reports back to us via webhook. We do not sell WhatsApp conversation data, and we
          do not use it to train third-party models. Your use of WhatsApp through Wazenly is also subject to
          {" "}<a href="https://www.whatsapp.com/legal/business-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta's WhatsApp Business Messaging Policy</a>.
        </p>
      </LegalSection>

      <LegalSection title="4. Cookies & Similar Technologies">
        <p>
          The Service uses essential cookies to keep you signed in and to remember your active workspace. We do not currently use
          third-party advertising or tracking cookies. If we introduce analytics tooling (e.g. Google Analytics) in the future, this
          policy will be updated accordingly before that data collection begins.
        </p>
      </LegalSection>

      <LegalSection title="5. User Accounts">
        <p>
          Wazenly does not offer public self-registration. Accounts are created by an administrator or via a team invitation. Account
          holders are responsible for keeping their login credentials confidential and for all activity that occurs under their account.
        </p>
      </LegalSection>

      <LegalSection title="6. How We Use Information">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>To provide, operate, and maintain the Service, including sending and receiving WhatsApp messages on your behalf.</li>
          <li>To authenticate users and enforce workspace- and role-based access controls.</li>
          <li>To generate the analytics and reporting features of the Service.</li>
          <li>To respond to support and contact requests.</li>
          <li>To detect, prevent, and address technical issues, abuse, or security incidents.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Data Security">
        <p>
          Access tokens and other sensitive credentials are encrypted at rest. Every API request is authenticated and scoped to a
          specific workspace, and each connected WhatsApp number's contacts and conversations are isolated from other workspaces on
          the platform. Passwords are hashed and never stored or transmitted in plain text. While no system can guarantee absolute
          security, we apply industry-standard practices to protect your data.
        </p>
      </LegalSection>

      <LegalSection title="8. Data Retention">
        <p>
          We retain account, contact, and conversation data for as long as your workspace remains active, or as needed to comply with
          our legal obligations. You may request deletion of your workspace's data by contacting us at the email address below.
        </p>
      </LegalSection>

      <LegalSection title="9. GDPR & Your Rights">
        <p>
          If you are located in the European Economic Area, you have the right to access, correct, export, or request deletion of
          your personal data, and to object to or restrict certain processing. To exercise any of these rights, contact us using the
          details below and we will respond within a reasonable timeframe.
        </p>
      </LegalSection>

      <LegalSection title="10. Third-Party Sharing">
        <p>
          We do not sell your personal data. We share data only with Meta (as required to deliver WhatsApp messaging), and with
          infrastructure providers (such as our hosting and email delivery providers) strictly as needed to operate the Service, under
          appropriate confidentiality obligations.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. Material changes will be reflected by updating the "Last updated" date
          above. Continued use of the Service after a change constitutes acceptance of the revised policy.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Questions about this Privacy Policy or your data can be sent to{" "}
          <a href="mailto:info@wazenlyapp.com" className="text-primary hover:underline">info@wazenlyapp.com</a>.
        </p>
      </LegalSection>

      <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
        This Privacy Policy is provided as a general reference for Wazenly's data practices and is not a substitute for
        legal advice. We recommend having it reviewed by qualified legal counsel for your specific jurisdiction and business needs.
      </p>
    </LegalPage>
  );
}
