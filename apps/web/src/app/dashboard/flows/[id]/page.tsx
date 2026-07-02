"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactFlow, {
  addEdge, Background, Controls, MiniMap, useEdgesState, useNodesState,
  Handle, Position, type Connection, type Edge, type Node, Panel,
} from "reactflow";
import "reactflow/dist/style.css";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, ChevronLeft, Plus } from "lucide-react";
import api from "@/lib/api";
import { NodeConfigPanel, type NodeData } from "@/components/flows/NodeConfigPanel";

const NODE_COLORS: Record<string, string> = {
  trigger: "#25D366",
  message: "#3B82F6",
  condition: "#F59E0B",
  action: "#8B5CF6",
  input: "#EC4899",
  delay: "#6B7280",
  jump: "#EF4444",
};

function CustomNode({ data }: { data: NodeData }) {
  const color = NODE_COLORS[data.type] || "#6B7280";
  return (
    <div className="relative bg-white border-2 rounded-xl px-4 py-3 shadow-sm min-w-[150px]" style={{ borderColor: color }}>
      {data.type !== "trigger" && <Handle type="target" position={Position.Top} className="!bg-gray-400" />}
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{data.type}</span>
      </div>
      <p className="text-sm font-medium text-gray-900 mt-1">{data.label}</p>

      {data.type === "condition" ? (
        <>
          <Handle type="source" position={Position.Bottom} id="yes" style={{ left: "30%" }} className="!bg-green-500" />
          <span className="pointer-events-none absolute -bottom-4 text-[9px] font-semibold text-green-600" style={{ left: "30%", transform: "translateX(-50%)" }}>Yes</span>
          <Handle type="source" position={Position.Bottom} id="no" style={{ left: "70%" }} className="!bg-red-500" />
          <span className="pointer-events-none absolute -bottom-4 text-[9px] font-semibold text-red-600" style={{ left: "70%", transform: "translateX(-50%)" }}>No</span>
        </>
      ) : data.type !== "jump" ? (
        <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
      ) : null}
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

const INITIAL_NODES: Node<NodeData>[] = [
  { id: "trigger-1", type: "custom", position: { x: 100, y: 100 }, data: { label: "Start: Keyword match", type: "trigger", config: { matchType: "keyword", keywords: [] } } },
  { id: "message-1", type: "custom", position: { x: 100, y: 250 }, data: { label: "Send welcome message", type: "message", config: { mode: "text", text: "Welcome!" } } },
];

const INITIAL_EDGES: Edge[] = [
  { id: "e1-2", source: "trigger-1", target: "message-1", animated: true },
];

export default function FlowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";

  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(isNew ? INITIAL_NODES : []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(isNew ? INITIAL_EDGES : []);
  const [flowName, setFlowName] = useState("Untitled Flow");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const { data: flow } = useQuery({
    queryKey: ["flow", id],
    queryFn: () => api.get(`/flows/${id}`).then((r) => r.data),
    enabled: !isNew,
  });

  useEffect(() => {
    if (flow) {
      setFlowName(flow.name);
      if (flow.nodes?.length) {
        setNodes(flow.nodes.map((n: { id: string; type: string; positionX: number; positionY: number; data: object; label: string }) => ({
          id: n.id, type: "custom", position: { x: n.positionX, y: n.positionY }, data: { ...n.data, label: n.label, type: n.type },
        })));
      }
      if (flow.edges?.length) {
        setEdges(flow.edges.map((e: { id: string; sourceNodeId: string; targetNodeId: string; label?: string }) => ({
          id: e.id, source: e.sourceNodeId, target: e.targetNodeId, label: e.label, sourceHandle: e.label === "Yes" ? "yes" : e.label === "No" ? "no" : undefined, animated: true,
        })));
      }
    }
  }, [flow, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => {
    const label = params.sourceHandle === "yes" ? "Yes" : params.sourceHandle === "no" ? "No" : undefined;
    setEdges((eds) => addEdge({ ...params, label, animated: true }, eds));
  }, [setEdges]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: flowName,
        nodes: nodes.map((n) => ({ id: n.id, type: n.data.type, label: n.data.label, positionX: n.position.x, positionY: n.position.y, data: n.data })),
        edges: edges.map((e) => ({ id: e.id, sourceNodeId: e.source, targetNodeId: e.target, label: e.label as string | undefined })),
      };
      return isNew ? api.post("/flows", payload) : api.put(`/flows/${id}`, payload);
    },
    onSuccess: (r) => {
      toast.success("Flow saved");
      if (isNew) router.replace(`/dashboard/flows/${r.data.id}`);
    },
    onError: () => toast.error("Failed to save"),
  });

  function addNode(type: string) {
    const newNode: Node<NodeData> = {
      id: `${type}-${Date.now()}`,
      type: "custom",
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: { label: `New ${type} node`, type, config: {} },
    };
    setNodes((nds) => [...nds, newNode]);
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  function handleSaveNodeConfig(label: string, config: object) {
    setNodes((nds) => nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, label, config } } : n)));
    setSelectedNodeId(null);
    toast.success("Node updated — remember to Save the flow");
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input value={flowName} onChange={(e) => setFlowName(e.target.value)} className="font-semibold text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-primary/30 rounded px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-70">
            <Save className="w-4 h-4" /> {saveMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Node palette */}
        <div className="w-52 bg-white border-r border-gray-100 p-4 flex-shrink-0 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Add Nodes</p>
          <div className="space-y-2">
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <button key={type} onClick={() => addNode(type)} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-left transition-colors group">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium text-gray-700 capitalize">{type}</span>
                <Plus className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 ml-auto" />
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">Click a node on the canvas to configure it.</p>
        </div>

        {/* Flow canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
          >
            <Background gap={20} size={1} color="#e5e7eb" />
            <Controls />
            <MiniMap nodeColor={(n) => NODE_COLORS[(n.data as NodeData).type] || "#6B7280"} className="!bg-white !border-gray-200 !rounded-lg" />
            <Panel position="top-right" className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
              <div className="flex items-center gap-3 text-xs">
                {Object.entries(NODE_COLORS).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-gray-500 capitalize">{type}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            allNodes={nodes}
            currentFlowId={isNew ? undefined : id}
            onClose={() => setSelectedNodeId(null)}
            onSave={handleSaveNodeConfig}
          />
        )}
      </div>
    </div>
  );
}
