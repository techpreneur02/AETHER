"use client";

import { useEffect, useRef, useState } from "react";
import { Background, Controls, Handle, MiniMap, Position, ReactFlow, type Connection, type Edge, type Node, type NodeProps, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Topology } from "../lib/api";

type TopologyFlowProps = { topology: Topology; selectedNodeId?: string; onNodeClick?: (nodeId: string) => void; onConnect?: (connection: Connection) => void; onNodeDragStop?: (node: Node) => void; onEdgeClick?: (edgeId: string) => void; fitViewTrigger?: number; showMiniMap?: boolean };
type DeviceNodeData = { label: string; vendor: string; model: string; portCount: number; kind: string; ports: string[]; category: string };

export const TOPOLOGY_CANVAS_WIDTH = 3200;
export const TOPOLOGY_CANVAS_HEIGHT = 1400;

function defaultPortLabels(portCount: number): string[] {
  return Array.from({ length: Math.max(1, portCount || 4) }, (_, index) => {
    const portNumber = index + 1;
    return portCount <= 8 ? `Gi1/0/${portNumber}` : `Eth${portNumber}`;
  });
}

function devicePortInventory(portCount: number, assignedPorts: string[]): string[] {
  const expectedCount = Math.max(1, portCount || 4);
  const inventory = Array.from(new Set(assignedPorts));

  for (const port of defaultPortLabels(expectedCount)) {
    if (inventory.length >= expectedCount) break;
    if (!inventory.includes(port)) inventory.push(port);
  }

  return inventory;
}

function DeviceNode({ data, selected }: NodeProps<Node<DeviceNodeData>>) {
  const visiblePorts = data.ports?.length ? data.ports : defaultPortLabels(data.portCount || 4);
  const category = data.category || "device";

  return <div className={`flow-device-node ${selected ? "selected" : ""} ${category}`}>
    <Handle type="target" position={Position.Top} id="top" />
    <div className="flow-device-header">
      <span className="flow-device-badge">{category === "gateway" ? "GW" : category === "switch" ? "SW" : category === "controller" ? "CTRL" : category === "ap" ? "AP" : category === "internet" ? "NET" : "DEV"}</span>
      <b>{data.label}</b>
    </div>
    <div className="flow-device-meta">{data.vendor || "Custom"}{data.model ? ` · ${data.model}` : ""}</div>
    <div className="flow-device-ports">
      {visiblePorts.slice(0, 8).map((port) => <span key={port}>{port}</span>)}
    </div>
    <small>{data.portCount} ports</small>
    <Handle type="source" position={Position.Bottom} id="bottom" />
  </div>;
}

const nodeTypes = { device: DeviceNode };

export default function TopologyFlow({ topology, selectedNodeId, onNodeClick, onConnect, onNodeDragStop, onEdgeClick, fitViewTrigger = 0, showMiniMap = false }: TopologyFlowProps) {
  const [flowNodes, setFlowNodes] = useState<Node<DeviceNodeData>[]>([]);
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const reactFlowInstance = useRef<ReactFlowInstance<Node<DeviceNodeData>, Edge> | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setColorMode(root.dataset.theme === "dark" ? "dark" : "light");
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (fitViewTrigger > 0 && reactFlowInstance.current) {
      reactFlowInstance.current.fitView({ padding: 0.22, duration: 200 });
    }
  }, [fitViewTrigger]);

  useEffect(() => {
    setFlowNodes((current) => {
      const next = topology.nodes.map((node, index) => {
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

        const position = {
          x: node.floorplan_x != null ? node.floorplan_x * TOPOLOGY_CANVAS_WIDTH : (index % 3) * 220 + 80,
          y: node.floorplan_y != null ? node.floorplan_y * TOPOLOGY_CANVAS_HEIGHT : Math.floor(index / 3) * 150 + 80,
        };

        return {
          id: node.id,
          type: "device",
          position,
          data: {
            label: node.name,
            vendor: node.vendor ?? "",
            model: node.model ?? "",
            portCount: node.port_count ?? Math.max(portList.length, 4),
            kind: node.kind,
            ports: devicePortInventory(node.port_count ?? 4, portList),
            category,
          },
          selected: node.id === selectedNodeId,
          draggable: true,
        };
      });

      return next;
    });
  }, [selectedNodeId, topology]);

  const edges: Edge[] = topology.links.map((link) => {
    const stableId = `edge-${link.source}-${link.target}`;
    return {
      id: stableId,
      source: link.source,
      target: link.target,
      sourceHandle: "bottom",
      targetHandle: "top",
      type: "step",
      label: `${link.medium} · ${link.source_port || "Unassigned"} → ${link.target_port || "Unassigned"}${link.operational_status === "down" ? " · DOWN" : ""}`,
      animated: link.medium === "wireless" && link.operational_status !== "down",
      style: { stroke: link.operational_status === "down" ? "#f05a67" : link.medium === "fiber" ? "#49c9df" : link.medium === "wireless" ? "#b27ef2" : "#8ba4b5", strokeWidth: 2, strokeDasharray: link.operational_status === "down" ? "7 5" : undefined },
      labelStyle: { fill: colorMode === "light" ? "#344656" : "#d9e6f2", fontSize: 10 },
    };
  });

  function handleNodeDragStop(_: MouseEvent | TouchEvent, node: Node) {
    const snapped = {
      x: Math.round(node.position.x / 20) * 20,
      y: Math.round(node.position.y / 20) * 20,
    };
    setFlowNodes((current) => current.map((item) => item.id === node.id ? { ...item, position: snapped } : item));
    onNodeDragStop?.({ ...node, position: snapped });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!selectedNodeId || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const current = flowNodes.find((item) => item.id === selectedNodeId)?.position ?? { x: 80, y: 80 };
    const distance = event.shiftKey ? 40 : 20;
    const next = {
      x: current.x + (event.key === "ArrowLeft" ? -distance : event.key === "ArrowRight" ? distance : 0),
      y: current.y + (event.key === "ArrowUp" ? -distance : event.key === "ArrowDown" ? distance : 0),
    };
    const snapped = { x: Math.round(next.x / 20) * 20, y: Math.round(next.y / 20) * 20 };
    setFlowNodes((items) => items.map((item) => item.id === selectedNodeId ? { ...item, position: snapped } : item));
    if (flowNodes.find((item) => item.id === selectedNodeId)) onNodeDragStop?.({ ...flowNodes.find((item) => item.id === selectedNodeId)!, position: snapped });
  }

  return <div className="flow-wrap" tabIndex={0} onKeyDown={handleKeyDown}><ReactFlow<Node<DeviceNodeData>, Edge> nodes={flowNodes} edges={edges} nodeTypes={nodeTypes} snapToGrid snapGrid={[20, 20]} nodesDraggable nodesConnectable fitView colorMode={colorMode} onInit={(instance) => { reactFlowInstance.current = instance; }} onNodeClick={(_, node) => onNodeClick?.(node.id)} onNodeDragStop={handleNodeDragStop} onEdgeClick={(_, edge) => onEdgeClick?.(edge.id)} onConnect={onConnect}><Background color={colorMode === "light" ? "#d7e0e7" : "#29445a"} gap={24} /><Controls />{showMiniMap && <MiniMap nodeColor={colorMode === "light" ? "#087f8c" : "#49c9df"} />}</ReactFlow></div>;
}
