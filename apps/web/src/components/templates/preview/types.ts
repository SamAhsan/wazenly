// Normalized shape the preview renderers work from -- decoupled from the
// creation form's react-hook-form state so the preview system stays usable
// from anywhere (edit mode, future template list "preview" action, etc.)
// without dragging form-library types along with it.

export type PreviewHeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION" | "CAROUSEL";

export type PreviewButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE";

export interface PreviewButton {
  type: PreviewButtonType;
  text: string;
}

export interface PreviewCard {
  headerFormat: "IMAGE" | "VIDEO";
  mediaSrc?: string;
  body: string;
  bodyExamples?: Record<string, string>;
}

export interface PreviewTemplate {
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  headerType: PreviewHeaderType;
  headerText?: string;
  mediaSrc?: string;
  documentFileName?: string;
  body: string;
  bodyExamples?: Record<string, string>;
  footer?: string;
  buttons: PreviewButton[];
  cards?: PreviewCard[];
  businessName?: string;
}
