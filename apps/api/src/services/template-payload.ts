export interface Button {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
}

export interface TemplatePayloadInput {
  headerType: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
  headerText?: string;
  headerHandle?: string;
  body: string;
  footer?: string;
  buttons?: Button[];
  bodyExamples?: Record<string, string>;
}

// Builds the Meta message_templates `components` array. Pure function — no
// network calls — so the payload shape can be verified without hitting Meta.
export function buildTemplateComponents(input: TemplatePayloadInput): object[] {
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

  const bodyComp: Record<string, unknown> = { type: "BODY", text: input.body };
  if (input.bodyExamples && Object.keys(input.bodyExamples).length > 0) {
    const sortedKeys = Object.keys(input.bodyExamples).sort((a, b) => Number(a) - Number(b));
    const exampleValues = sortedKeys.map((k) => input.bodyExamples![k]).filter(Boolean);
    if (exampleValues.length > 0) {
      bodyComp.example = { body_text: [exampleValues] };
    }
  }
  components.push(bodyComp);

  if (input.footer) components.push({ type: "FOOTER", text: input.footer });

  if (input.buttons?.length) {
    components.push({
      type: "BUTTONS",
      buttons: input.buttons.map((b) => ({
        type: b.type,
        text: b.text,
        ...(b.url ? { url: b.url } : {}),
        ...(b.phone_number ? { phone_number: b.phone_number } : {}),
      })),
    });
  }

  return components;
}
