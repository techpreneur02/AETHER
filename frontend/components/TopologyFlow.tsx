"use client";

import { useEffect, useState } from "react";
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, type Connection, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Topology } from "../lib/api";

type TopologyFlowProps = { topology: Topology; selectedNodeId?: string; onNodeClick?: (nodeId: string) => void; onConnect?: (connection: Connection) => void; onNodeDragStop?: (node: Node) => void; onEdgeClick?: (edgeId: string) => void };
type DeviceNodeData = { label: string; vendor: string; model: string; portCount: number; kind: string; ports: string[]; category: string };

function defaultPortLabels(portCount: number): string[] {
  return Array.from({ length: Math.max(4, portCount || 4) }, (_, index) => {
    const portNumber = index + 1;
    return portCount <= 8 ? `Gi1/0/${portNumber}` : `Eth${portNumber}`;
  });
}

function DeviceNode({ data, selected }: NodeProps<Node<DeviceNodeData>>) {
  const visiblePorts = data.ports?.length ? data.ports : defaultPortLabels(data.portCount || 4);
  const category = data.category || "device";

  return <div className={`flow-device-node ${selected ? "selected" : ""} ${category}`}>
    <Handle type="target" position={Position.Top} id="top" />
    <Handle type="target" position={Position.Left} id="left" />
    <div className="flow-device-header">
      <span className="flow-device-badge">{category === "gateway" ? "GW" : category === "switch" ? "SW" : category === "controller" ? "CTRL" : category === "ap" ? "AP" : category === "internet" ? "NET" : "DEV"}</span>
      <b>{data.label}</b>
    </div>
    <div className="flow-device-meta">{data.vendor || "Custom"}{data.model ? ` · ${data.model}` : ""}</div>
    <div className="flow-device-ports">
      {visiblePorts.slice(0, 8).map((port) => <span key={port}>{port}</span>)}
    </div>
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

  const nodes: Node<DeviceNodeData>[] = topology.nodes.map((node, index) => {
    const portList = [
      ...(topology.links.filter((link) => link.source === node.id && link.source_port).map((link) => link.source_port as string)),
      ...(topology.links.filter((link) => link.target === node.id && link.target_port).map((link) => link.target_port as string)),
    ].filter(Boolean);

    const category = /internet/i.test(node.name)
      ? "internet"
      : /gateway|router|vpn/i.test(node.name)
        ? "gateway"
        : /switch|core/i.test(node.name)
          ? "switch"
          : /controller|omada/i.test(node.name)
            ? "controller"
            : /ap|access point|wireless/i.test(node.name)
              ? "ap"
              : "device";

    return {
      id: node.id,
      type: "device",
      position: positions[node.id] ?? { x: (index % 3) * 220 + 80, y: Math.floor(index / 3) * 150 + 80 },
      data: {
        label: node.name,
        vendor: node.vendor ?? "",
        model: node.model ?? "",
        portCount: node.port_count ?? Math.max(portList.length, 4),
        kind: node.kind,
        ports: portList.length ? Array.from(new Set(portList)) : defaultPortLabels(node.port_count ?? 4),
        category,
      },
      selected: node.id === selectedNodeId,
    };
  });
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
