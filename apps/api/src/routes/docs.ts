import { Router } from "express";
import swaggerUi from "swagger-ui-express";

const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "WAZENLY API",
    version: "1.0.0",
    description: "WhatsApp BSP SaaS Platform REST API",
  },
  servers: [{ url: "/api/v1", description: "Public API v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API Key" },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/messages/send": {
      post: {
        summary: "Send a single message",
        tags: ["Messages"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["numberId", "to", "type"],
                properties: {
                  numberId: { type: "string" },
                  to: { type: "string", example: "+15551234567" },
                  type: { type: "string", enum: ["text", "image", "video", "audio", "document"] },
                  text: { type: "string" },
                  mediaUrl: { type: "string" },
                  caption: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Message sent" }, "400": { description: "Invalid payload" } },
      },
    },
    "/messages/template": {
      post: {
        summary: "Send a template message",
        tags: ["Messages"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["numberId", "to", "templateName"],
                properties: {
                  numberId: { type: "string" },
                  to: { type: "string" },
                  templateName: { type: "string" },
                  languageCode: { type: "string", default: "en" },
                  variables: { type: "object", additionalProperties: { type: "string" } },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Template message sent" } },
      },
    },
    "/contacts": {
      get: { summary: "List contacts", tags: ["Contacts"], responses: { "200": { description: "Contacts list" } } },
      post: { summary: "Create or update contact", tags: ["Contacts"], responses: { "201": { description: "Contact created" } } },
    },
    "/campaigns": {
      post: { summary: "Create campaign", tags: ["Campaigns"], responses: { "201": { description: "Campaign created" } } },
    },
    "/templates": {
      get: { summary: "List approved templates", tags: ["Templates"], responses: { "200": { description: "Templates" } } },
    },
    "/numbers": {
      get: { summary: "List connected numbers", tags: ["Numbers"], responses: { "200": { description: "Numbers list" } } },
    },
  },
};

export const docsRouter = Router();
docsRouter.use("/", swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: ".swagger-ui .topbar { background: #0f1117; } .swagger-ui .topbar .link::after { content: 'WAZENLY API'; color: #25D366; font-weight: bold; font-size: 18px; }",
  customSiteTitle: "WAZENLY API Docs",
}));
