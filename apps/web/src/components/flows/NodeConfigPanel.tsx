"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { Node } from "reactflow";
import { TriggerConfig, type TriggerConfigData } from "./config/TriggerConfig";
import { MessageConfig, type MessageConfigData } from "./config/MessageConfig";
import { ConditionConfig, type ConditionConfigData } from "./config/ConditionConfig";
import { ActionConfig, type ActionConfigData } from "./config/ActionConfig";
import { InputConfig, type InputConfigData } from "./config/InputConfig";
import { DelayConfig, type DelayConfigData } from "./config/DelayConfig";
import { JumpConfig, type JumpConfigData } from "./config/JumpConfig";

type NodeConfig = TriggerConfigData | MessageConfigData | ConditionConfigData | ActionConfigData | InputConfigData | DelayConfigData | JumpConfigData;

export interface NodeData {
  label: string;
  type: string;
  config?: NodeConfig | object;
}

export function NodeConfigPanel({
  node,
  allNodes,
  currentFlowId,
  onClose,
  onSave,
}: {
  node: Node<NodeData>;
  allNodes: Node<NodeData>[];
  currentFlowId?: string;
  onClose: () => void;
  onSave: (label: string, config: NodeConfig) => void;
}) {
  const [label, setLabel] = useState(node.data.label);
  const [config, setConfig] = useState<NodeConfig>((node.data.config as NodeConfig) || ({} as NodeConfig));

  useEffect(() => {
    setLabel(node.data.label);
    setConfig((node.data.config as NodeConfig) || ({} as NodeConfig));
  }, [node.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const type = node.data.type;

  return (
    <div className="w-96 bg-white border-l border-gray-100 flex-shrink-0 flex flex-col h-full">
      <div className="h-14 flex items-center justify-between px-5 border-b border-gray-100 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{type} node</span>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Node label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        {type === "trigger" && <TriggerConfig config={config as TriggerConfigData} onChange={setConfig} />}
        {type === "message" && <MessageConfig config={config as MessageConfigData} onChange={setConfig} />}
        {type === "condition" && <ConditionConfig config={config as ConditionConfigData} onChange={setConfig} />}
        {type === "action" && <ActionConfig config={config as ActionConfigData} onChange={setConfig} />}
        {type === "input" && <InputConfig config={config as InputConfigData} onChange={setConfig} />}
        {type === "delay" && <DelayConfig config={config as DelayConfigData} onChange={setConfig} />}
        {type === "jump" && (
          <JumpConfig
            config={config as JumpConfigData}
            onChange={setConfig}
            currentFlowId={currentFlowId}
            flowNodes={allNodes.filter((n) => n.id !== node.id).map((n) => ({ id: n.id, label: n.data.label, type: n.data.type }))}
          />
        )}
      </div>

      <div className="p-4 border-t border-gray-100 flex-shrink-0">
        <button
          onClick={() => onSave(label, config)}
          className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-600"
        >
          Save node
        </button>
      </div>
    </div>
  );
}
