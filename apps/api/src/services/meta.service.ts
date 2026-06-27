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
