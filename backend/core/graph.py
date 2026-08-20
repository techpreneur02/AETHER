import networkx as nx

from backend.models.topology import Topology


class TopologyGraph:
    def __init__(self) -> None:
        self._graph = nx.MultiGraph()

    def sync(self, topology: Topology) -> None:
        self._graph.clear()
        self._graph.add_nodes_from(
            (node.id, {"name": node.name, "kind": node.kind})
            for node in topology.nodes
        )
        self._graph.add_edges_from(
            (link.source, link.target, {"medium": link.medium})
            for link in topology.links
        )

    def snapshot(self) -> Topology:
        return Topology(
            nodes=[
                {
                    "id": node_id,
                    "name": attributes["name"],
                    "kind": attributes["kind"],
                }
                for node_id, attributes in self._graph.nodes(data=True)
            ],
            links=[
                {
                    "source": source,
                    "target": target,
                    "medium": attributes["medium"],
                }
                for source, target, attributes in self._graph.edges(data=True)
            ],
        )

    def has_node(self, node_id: str) -> bool:
        return self._graph.has_node(node_id)

    def node_count(self) -> int:
        return self._graph.number_of_nodes()

    def link_count(self) -> int:
        return self._graph.number_of_edges()