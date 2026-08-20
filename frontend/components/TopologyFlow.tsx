"use client";

import { useEffect, useState } from "react";
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, type Connection, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Topology } from "../lib/api";

type TopologyFlowProps = { topology: Topology; selectedNodeId?: string; onNodeClick?: (nodeId: string) => void; onConnect?: (connection: Connection) => void; onNodeDragStop?: (node: Node) => void; onEdgeClick?: (edgeId: string) => void };
type DeviceNodeData = { label: string; vendor: string; model: string; portCount: number };

function DeviceNode({ data, selected }: NodeProps<Node<DeviceNodeData>>) {
  return <div className={`flow-device-node ${selected ? "selected" : ""}`}>
    <Handle type="target" position={Position.Top} id="top" />
    <Handle type="target" position={Position.Left} id="left" />
    <span className="flow-device-icon" />
    <b>{data.label}</b>
    <small>{data.vendor || "Custom"}{data.model ? ` · ${data.model}` : ""}</small>
    <small>{data.portCount} ports</small>
    <Handle type="source" position={Position.Right} id="right" />
    <Handle type="source" position={Position.Bottom} id="bottom" />
  </div>;
}

const nodeTypes = { device: DeviceNode };

export default function TopologyFlow({ topology, selectedNodeId, onNodeClick, onConnect, onNodeDragStop, onEdgeClick }: TopologyFlowProps) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    setPositions((current) => Object.fromEntries(topology.nodes.map((node, index) => [node.id, current[node.id] ?? { x: node.floorplan_x != null ? node.floorplan_x * 900 : (index % 3) * 220 + 80, y: node.floorplan_y != null ? node.floorplan_y * 600 : Math.floor(index / 3) * 150 + 80 }] )));
  }, [topology.nodes]);

  const nodes: Node<DeviceNodeData>[] = topology.nodes.map((node, index) => ({
    id: node.id,
    type: "device",
    position: positions[node.id] ?? { x: (index % 3) * 220 + 80, y: Math.floor(index / 3) * 150 + 80 },
    data: { label: node.name, vendor: node.vendor ?? "", model: node.model ?? "", portCount: node.port_count ?? 4 },
    selected: node.id === selectedNodeId,
  }));
  const edges: Edge[] = topology.links.map((link, index) => ({ id: `edge-${index}`, source: link.source, target: link.target, label: `${link.medium}${link.source_port || link.target_port ? ` · ${link.source_port || "?"} ↔ ${link.target_port || "?"}` : ""}`, animated: link.medium === "wireless", style: { stroke: link.medium === "fiber" ? "#49c9df" : link.medium === "wireless" ? "#b27ef2" : "#8ba4b5", strokeWidth: 2 }, labelStyle: { fill: "#d9e6f2", fontSize: 10 }, }));

  function handleNodeDragStop(_: MouseEvent | TouchEvent, node: Node) { setPositions((current) => ({ ...current, [node.id]: node.position })); onNodeDragStop?.(node); }
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!selectedNodeId || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const current = positions[selectedNodeId] ?? { x: 80, y: 80 };
    const distance = event.shiftKey ? 40 : 10;
    const next = { x: current.x + (event.key === "ArrowLeft" ? -distance : event.key === "ArrowRight" ? distance : 0), y: current.y + (event.key === "ArrowUp" ? -distance : event.key === "ArrowDown" ? distance : 0) };
    const node = nodes.find((item) => item.id === selectedNodeId);
    setPositions((items) => ({ ...items, [selectedNodeId]: next }));
    if (node) onNodeDragStop?.({ ...node, position: next });
  }

  return <div className="flow-wrap" tabIndex={0} onKeyDown={handleKeyDown}><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} snapToGrid snapGrid={[10, 10]} nodesDraggable nodesConnectable fitView colorMode="dark" onNodeClick={(_, node) => onNodeClick?.(node.id)} onNodeDragStop={handleNodeDragStop} onEdgeClick={(_, edge) => onEdgeClick?.(edge.id)} onConnect={onConnect}><Background color="#29445a" gap={24} /><Controls /><MiniMap nodeColor="#49c9df" /></ReactFlow></div>;
}
