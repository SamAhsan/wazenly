export interface Button {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
}

export interface CarouselCard {
  headerFormat: "IMAGE" | "VIDEO";
  headerHandle?: string;
  body: string;
  bodyExamples?: Record<string, string>;
}

export interface TemplatePayloadInput {
  headerType: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION" | "CAROUSEL";
  headerText?: string;
  headerHandle?: string;
  body: string;
  footer?: string;
  buttons?: Button[];
  bodyExamples?: Record<string, string>;
  cards?: CarouselCard[];
}

function buildButtonsComponent(buttons: Button[]): object {
  return {
    type: "BUTTONS",
    buttons: buttons.map((b) => ({
      type: b.type,
      text: b.text,
      ...(b.url ? { url: b.url } : {}),
      ...(b.phone_number ? { phone_number: b.phone_number } : {}),
    })),
  };
}

function buildBodyComponent(body: string, bodyExamples?: Record<string, string>): object {
  const bodyComp: Record<string, unknown> = { type: "BODY", text: body };
  if (bodyExamples && Object.keys(bodyExamples).length > 0) {
    const sortedKeys = Object.keys(bodyExamples).sort((a, b) => Number(a) - Number(b));
    const exampleValues = sortedKeys.map((k) => bodyExamples[k]).filter(Boolean);
    if (exampleValues.length > 0) {
      bodyComp.example = { body_text: [exampleValues] };
    }
  }
  return bodyComp;
}

// Builds the Meta message_templates `components` array. Pure function — no
// network calls — so the payload shape can be verified without hitting Meta.
export function buildTemplateComponents(input: TemplatePayloadInput): object[] {
  // Carousel templates have a completely different top-level shape: only a
  // BODY (no HEADER/FOOTER at the template level) plus a CAROUSEL component
  // whose cards each carry their own HEADER/BODY/BUTTONS. Meta requires every
  // card to share the identical button set, so `buttons` (not per-card) is
  // applied to all cards here rather than being configurable per card.
  if (input.headerType === "CAROUSEL") {
    const components: object[] = [buildBodyComponent(input.body, input.bodyExamples)];
    const cards = (input.cards || []).map((card) => {
      const cardComponents: object[] = [
        {
          type: "HEADER",
          format: card.headerFormat,
          ...(card.headerHandle ? { example: { header_handle: [card.headerHandle] } } : {}),
        },
        buildBodyComponent(card.body, card.bodyExamples),
      ];
      if (input.buttons?.length) cardComponents.push(buildButtonsComponent(input.buttons));
      return { components: cardComponents };
    });
    components.push({ type: "CAROUSEL", cards });
    return components;
  }

  const components: object[] = [];

  if (input.headerType !== "NONE") {
    const headerComp: Record<string, unknown> = { type: "HEADER", format: input.headerType };
    if (input.headerType === "TEXT" && input.headerText) {
      headerComp.text = input.headerText;
    } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(input.headerType) && input.headerHandle) {
      headerComp.example = { header_handle: [input.headerHandle] };
    }
    components.push(headerComp);
  }

  components.push(buildBodyComponent(input.body, input.bodyExamples));

  if (input.footer) components.push({ type: "FOOTER", text: input.footer });

  if (input.buttons?.length) components.push(buildButtonsComponent(input.buttons));

  return components;
}
