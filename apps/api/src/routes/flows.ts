import { Router } from "express";
import { z } from "zod";
import { prisma } from "@wazenly/db";
import { requireAuth, requireWorkspace, AuthRequest } from "../middleware/auth";

export const flowsRouter = Router();
flowsRouter.use(requireAuth, requireWorkspace);

const flowSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  numberId: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    label: z.string(),
    positionX: z.number(),
    positionY: z.number(),
    data: z.record(z.unknown()),
  })).optional(),
  edges: z.array(z.object({
    id: z.string(),
    sourceNodeId: z.string(),
    targetNodeId: z.string(),
    label: z.string().optional(),
    condition: z.record(z.unknown()).optional(),
  })).optional(),
  triggers: z.array(z.object({
    type: z.enum(["KEYWORD", "ANY_MESSAGE", "OPT_IN", "CAMPAIGN_REPLY"]),
    keywords: z.array(z.string()).optional(),
  })).optional(),
});

// GET /api/flows
flowsRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const flows = await prisma.flow.findMany({
      where: { workspaceId: req.workspaceId! },
      include: { _count: { select: { nodes: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(flows);
  } catch (err) {
    next(err);
  }
});

// POST /api/flows
flowsRouter.post("/", async (req: AuthRequest, res, next) => {
  try {
    const body = flowSchema.parse(req.body);
    const flow = await prisma.flow.create({
      data: {
        workspaceId: req.workspaceId!,
        name: body.name,
        description: body.description,
        numberId: body.numberId,
        status: "DRAFT",
        nodes: body.nodes?.length
          ? { create: body.nodes.map((n) => ({ ...n, data: n.data as any })) }
          : undefined,
        triggers: body.triggers?.length
          ? { create: body.triggers.map((t) => ({ type: t.type, keywords: t.keywords || [] })) }
          : undefined,
      },
      include: { nodes: true, edges: true, triggers: true },
    });
    res.status(201).json(flow);
  } catch (err) {
    next(err);
  }
});

// GET /api/flows/:id
flowsRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const flow = await prisma.flow.findFirst({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      include: { nodes: true, edges: true, triggers: true },
    });
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    res.json(flow);
  } catch (err) {
    next(err);
  }
});

// PUT /api/flows/:id
flowsRouter.put("/:id", async (req: AuthRequest, res, next) => {
  try {
    const body = flowSchema.parse(req.body);

    // Delete and recreate nodes/edges for simplicity
    await prisma.$transaction([
      prisma.flowNode.deleteMany({ where: { flowId: req.params.id } }),
      prisma.flowTrigger.deleteMany({ where: { flowId: req.params.id } }),
    ]);

    const flow = await prisma.flow.update({
      where: { id: req.params.id },
      data: {
        name: body.name,
        description: body.description,
        numberId: body.numberId,
        nodes: body.nodes?.length
          ? { create: body.nodes.map((n) => ({ ...n, data: n.data as any })) }
          : undefined,
        triggers: body.triggers?.length
          ? { create: body.triggers.map((t) => ({ type: t.type, keywords: t.keywords || [] })) }
          : undefined,
      },
      include: { nodes: true, edges: true, triggers: true },
    });

    // Re-create edges after nodes are created
    if (body.edges?.length) {
      const nodeMap = new Map(flow.nodes.map((n) => [n.id, n.id]));
      await prisma.flowEdge.createMany({
        data: body.edges
          .filter((e) => nodeMap.has(e.sourceNodeId) && nodeMap.has(e.targetNodeId))
          .map((e) => ({
            flowId: req.params.id,
            sourceNodeId: e.sourceNodeId,
            targetNodeId: e.targetNodeId,
            label: e.label,
            condition: e.condition as any,
          })),
      });
    }

    res.json(flow);
  } catch (err) {
    next(err);
  }
});

// POST /api/flows/:id/activate
flowsRouter.post("/:id/activate", async (req: AuthRequest, res, next) => {
  try {
    await prisma.flow.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      data: { status: "ACTIVE" },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/flows/:id/deactivate
flowsRouter.post("/:id/deactivate", async (req: AuthRequest, res, next) => {
  try {
    await prisma.flow.updateMany({
      where: { id: req.params.id, workspaceId: req.workspaceId! },
      data: { status: "INACTIVE" },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/flows/:id
flowsRouter.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    await prisma.flow.deleteMany({ where: { id: req.params.id, workspaceId: req.workspaceId! } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
