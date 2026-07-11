import { Reveal } from "../Reveal";
import { FaqAccordion } from "../FaqAccordion";

export const FAQ_ITEMS = [
  {
    question: "Is Wazenly an official WhatsApp Business Solution Provider?",
    answer: "Yes. Wazenly is built entirely on Meta's official WhatsApp Business Cloud API, not an unofficial or third-party integration. Every message sent through Wazenly goes through Meta's own infrastructure.",
  },
  {
    question: "Can I sign up for an account myself?",
    answer: "No — Wazenly doesn't offer public self-registration. Access is invitation-only. If you'd like to use Wazenly for your business, reach out through our Contact page and we'll set up your workspace.",
  },
  {
    question: "Can I manage multiple WhatsApp numbers or companies?",
    answer: "Yes. Wazenly supports multi-workspace and multi-company setups, with each WhatsApp number's contacts, campaigns, and conversations fully isolated from the others.",
  },
  {
    question: "Does Wazenly support team collaboration?",
    answer: "Yes — a shared team inbox with conversation assignment, role-based permissions (Owner, Admin, Manager, Agent), and internal notes so your whole team can work from one place.",
  },
  {
    question: "Can I automate replies and conversations?",
    answer: "Yes, through the visual Flow Builder — set up keyword-triggered auto-replies, routing, tagging, and multi-step conversational flows without writing code.",
  },
  {
    question: "Is there an API for custom integrations?",
    answer: "Yes. Wazenly provides a documented REST API and webhooks so you can integrate messaging, contacts, and campaign events into your own systems.",
  },
  {
    question: "How is my data kept secure?",
    answer: "Access tokens and credentials are encrypted at rest, every API request is authenticated and scoped to your workspace, and each connected WhatsApp number's data is fully isolated from others on the platform.",
  },
];

export function Faq() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <Reveal>
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary mb-3">FAQ</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight text-balance">Frequently asked questions</h2>
          </div>
        </Reveal>
        <Reveal direction="fade">
          <FaqAccordion items={FAQ_ITEMS} />
        </Reveal>
      </div>
    </section>
  );
}
