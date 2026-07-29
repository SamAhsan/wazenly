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
    messaging_limit_tier?: string;
    // Meta's review state for the number's display (business) name --
    // separate from quality_rating and from the WABA-level review below.
    name_status?: string;
  }> {
    const response = await axios.get(
      `${META_GRAPH_URL}/${this.phoneNumberId}`,
      {
        headers: this.headers,
        params: { fields: "id,display_phone_number,verified_name,quality_rating,platform_type,messaging_limit_tier,name_status" },
      }
    );
    return response.data;
  }

  // account_review_status is the WABA's verification state (APPROVED/PENDING/
  // REJECTED) -- a separate signal from the phone number's own quality_rating.
  async getWabaInfo(wabaId: string): Promise<{ account_review_status?: string }> {
    const response = await axios.get(`${META_GRAPH_URL}/${wabaId}`, {
      headers: this.headers,
      params: { fields: "account_review_status" },
    });
    return response.data;
  }

  // Whether any app (ours, presumably) is actually subscribed to this WABA's
  // webhooks -- registerWebhook() succeeding at connect time doesn't
  // guarantee the subscription is still live later (it can be dropped on
  // Meta's side independently), so this is checked live rather than inferred
  // from our own webhookVerifyToken column existing.
  async getSubscribedApps(wabaId: string): Promise<{ data: Array<{ whatsapp_business_api_data?: { id?: string } }> }> {
    const response = await axios.get(`${META_GRAPH_URL}/${wabaId}/subscribed_apps`, {
      headers: this.headers,
    });
    return response.data;
  }

  // A number picked/created via Embedded Signup isn't registered for Cloud
  // API messaging by default -- Meta shows it as "Pending" in WhatsApp
  // Manager until this is called. The PIN is the number's 2-step
  // verification PIN; any valid 6 digits work, and it can be freely
  // regenerated on each call (nothing elsewhere depends on it persisting).
  async registerPhoneNumber(pin: string): Promise<void> {
    await axios.post(
      `${META_GRAPH_URL}/${this.phoneNumberId}/register`,
      { messaging_product: "whatsapp", pin },
      { headers: this.headers }
    );
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

// --- Embedded Signup / Facebook Login OAuth exchange (app-level -- runs before
// we have a per-number access token, so these are plain functions, not instance
// methods). META_APP_SECRET must never be sent to the frontend.
export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await axios.get(`${META_GRAPH_URL}/oauth/access_token`, {
    params: {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      code,
    },
  });
  return response.data.access_token;
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
  const response = await axios.get(`${META_GRAPH_URL}/oauth/access_token`, {
    params: {
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      fb_exchange_token: shortLivedToken,
    },
  });
  const expiresIn = response.data.expires_in as number; // seconds, ~60 days
  return {
    accessToken: response.data.access_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}
