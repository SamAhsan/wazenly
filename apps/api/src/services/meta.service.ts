import axios, { AxiosError } from "axios";
import { META_GRAPH_URL } from "@wazenly/shared";
import type { MetaMessagePayload } from "@wazenly/shared";

export class MetaApiService {
  private accessToken: string;
  private phoneNumberId: string;

  constructor(accessToken: string, phoneNumberId: string) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async sendMessage(payload: MetaMessagePayload): Promise<{ id: string }> {
    const response = await axios.post(
      `${META_GRAPH_URL}/${this.phoneNumberId}/messages`,
      payload,
      { headers: this.headers }
    );
    return { id: response.data.messages?.[0]?.id };
  }

  async sendText(to: string, text: string): Promise<{ id: string }> {
    return this.sendMessage({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text },
    });
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components?: object[]
  ): Promise<{ id: string }> {
    return this.sendMessage({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components as any,
      },
    });
  }

  async sendMedia(
    to: string,
    type: "image" | "video" | "audio" | "document",
    link: string,
    caption?: string,
    filename?: string
  ): Promise<{ id: string }> {
    const mediaPayload: Record<string, unknown> = { link, caption };
    if (type === "document" && filename) mediaPayload.filename = filename;

    return this.sendMessage({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type,
      [type]: mediaPayload,
    } as MetaMessagePayload);
  }

  async getPhoneNumberInfo(): Promise<{
    id: string;
    display_phone_number: string;
    verified_name: string;
    quality_rating: string;
    platform_type: string;
  }> {
    const response = await axios.get(
      `${META_GRAPH_URL}/${this.phoneNumberId}`,
      {
        headers: this.headers,
        params: { fields: "id,display_phone_number,verified_name,quality_rating,platform_type,messaging_limit_tier" },
      }
    );
    return response.data;
  }

  async registerWebhook(wabaId: string, callbackUrl: string, verifyToken: string): Promise<void> {
    await axios.post(
      `${META_GRAPH_URL}/${wabaId}/subscribed_apps`,
      {},
      {
        headers: this.headers,
        params: { callback_url: callbackUrl, verify_token: verifyToken, subscribed_fields: "messages" },
      }
    );
  }

  async getTemplates(wabaId: string): Promise<object[]> {
    const response = await axios.get(`${META_GRAPH_URL}/${wabaId}/message_templates`, {
      headers: this.headers,
      params: { limit: 100 },
    });
    return response.data.data || [];
  }

  async createTemplate(wabaId: string, template: object): Promise<{ id: string }> {
    const response = await axios.post(
      `${META_GRAPH_URL}/${wabaId}/message_templates`,
      template,
      { headers: this.headers }
    );
    return { id: response.data.id };
  }

  // Editing an existing template (by its Meta template id, not name) resubmits
  // it for review -- Meta only accepts `category` and `components` here, the
  // name/language/WABA can't be changed after creation.
  async editTemplate(templateId: string, payload: { category: string; components: object[] }): Promise<{ success: boolean }> {
    const response = await axios.post(
      `${META_GRAPH_URL}/${templateId}`,
      payload,
      { headers: this.headers }
    );
    return { success: response.data?.success ?? true };
  }

  // Resolves which Meta App issued this instance's access token, via self-inspection
  // (input_token used as its own access_token — the standard way to debug a token
  // when you don't hold that app's secret). Needed because different WhatsApp numbers
  // may be connected through different Meta Apps/Business accounts.
  async debugToken(): Promise<string | null> {
    try {
      const response = await axios.get(`${META_GRAPH_URL}/debug_token`, {
        params: { input_token: this.accessToken, access_token: this.accessToken },
      });
      return response.data?.data?.app_id ?? null;
    } catch {
      return null;
    }
  }

  // Resumable Upload API — required to get a header_handle for IMAGE/VIDEO/DOCUMENT
  // template examples. A public header_url is NOT accepted by message_templates.
  async uploadResumableMedia(appId: string, fileBuffer: Buffer, fileType: string, fileName: string): Promise<string> {
    const session = await axios.post(`${META_GRAPH_URL}/${appId}/uploads`, null, {
      params: { file_name: fileName, file_length: fileBuffer.length, file_type: fileType, access_token: this.accessToken },
    });
    const uploadSessionId = session.data.id as string;
    const upload = await axios.post(`${META_GRAPH_URL}/${uploadSessionId}`, fileBuffer, {
      headers: { Authorization: `OAuth ${this.accessToken}`, file_offset: "0" },
    });
    return upload.data.h as string;
  }

  async markAsRead(messageId: string): Promise<void> {
    await axios.post(
      `${META_GRAPH_URL}/${this.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      },
      { headers: this.headers }
    );
  }
}
