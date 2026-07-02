import { describe, it, expect } from "vitest";
import { buildTemplateComponents } from "../template-payload";

function findHeader(components: object[]) {
  return components.find((c: any) => c.type === "HEADER") as any;
}

describe("buildTemplateComponents", () => {
  it("TEXT header carries no example", () => {
    const components = buildTemplateComponents({
      headerType: "TEXT",
      headerText: "Welcome!",
      body: "Hello {{1}}",
    });
    const header = findHeader(components);
    expect(header).toEqual({ type: "HEADER", format: "TEXT", text: "Welcome!" });
  });

  it.each(["IMAGE", "VIDEO", "DOCUMENT"] as const)(
    "%s header with a handle uses example.header_handle, never header_url",
    (headerType) => {
      const components = buildTemplateComponents({
        headerType,
        headerHandle: "4::abc123handle",
        body: "Hello {{1}}",
      });
      const header = findHeader(components);
      expect(header.example).toEqual({ header_handle: ["4::abc123handle"] });
      expect(JSON.stringify(components)).not.toContain("header_url");
    }
  );

  it.each(["IMAGE", "VIDEO", "DOCUMENT"] as const)(
    "%s header without a handle has no example (route-level check must reject this)",
    (headerType) => {
      const components = buildTemplateComponents({
        headerType,
        body: "Hello {{1}}",
      });
      const header = findHeader(components);
      expect(header.example).toBeUndefined();
    }
  );

  it("formats body variable examples as [[v1, v2]]", () => {
    const components = buildTemplateComponents({
      headerType: "NONE",
      body: "Hi {{1}}, order {{2}}",
      bodyExamples: { "1": "John", "2": "ORD-123" },
    });
    const bodyComp = components.find((c: any) => c.type === "BODY") as any;
    expect(bodyComp.example).toEqual({ body_text: [["John", "ORD-123"]] });
  });

  it("passes footer and buttons through unchanged", () => {
    const components = buildTemplateComponents({
      headerType: "NONE",
      body: "Hi",
      footer: "Reply STOP to unsubscribe",
      buttons: [
        { type: "URL", text: "Visit", url: "https://example.com" },
        { type: "PHONE_NUMBER", text: "Call", phone_number: "+15551234567" },
      ],
    });
    expect(components).toContainEqual({ type: "FOOTER", text: "Reply STOP to unsubscribe" });
    const buttonsComp = components.find((c: any) => c.type === "BUTTONS") as any;
    expect(buttonsComp.buttons).toEqual([
      { type: "URL", text: "Visit", url: "https://example.com" },
      { type: "PHONE_NUMBER", text: "Call", phone_number: "+15551234567" },
    ]);
  });
});
