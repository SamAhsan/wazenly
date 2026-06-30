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

    // Delete existing nodes (edges cascade) and triggers
    await prisma.$transaction([
      prisma.flowNode.deleteMany({ where: { flowId: req.params.id } }),
      prisma.flowTrigger.deleteMany({ where: { flowId: req.params.id } }),
    ]);

    // Update flow metadata and triggers
    await prisma.flow.update({
      where: { id: req.params.id },
      data: {
        name: body.name,
        description: body.description,
        numberId: body.numberId,
        triggers: body.triggers?.length
          ? { create: body.triggers.map((t) => ({ type: t.type, keywords: t.keywords || [] })) }
          : undefined,
      },
    });

    // Create nodes one-by-one to track React Flow client ID → DB UUID mapping
    const nodeIdMap = new Map<string, string>();
    if (body.nodes?.length) {
      for (const n of body.nodes) {
        const dbNode = await prisma.flowNode.create({
          data: {
            flowId: req.params.id,
            type: n.type,
            label: n.label,
            positionX: n.positionX,
            positionY: n.positionY,
            data: n.data as any,
          },
          select: { id: true },
        });
        nodeIdMap.set(n.id, dbNode.id);
      }
    }

    // Create edges using mapped DB IDs (edges carry React Flow node IDs from client)
    if (body.edges?.length) {
      await prisma.flowEdge.createMany({
        data: body.edges
          .filter((e) => nodeIdMap.has(e.sourceNodeId) && nodeIdMap.has(e.targetNodeId))
          .map((e) => ({
            flowId: req.params.id,
            sourceNodeId: nodeIdMap.get(e.sourceNodeId)!,
            targetNodeId: nodeIdMap.get(e.targetNodeId)!,
            label: e.label,
            condition: e.condition as any,
          })),
      });
    }

    const flow = await prisma.flow.findFirst({
      where: { id: req.params.id },
      include: { nodes: true, edges: true, triggers: true },
    });
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
