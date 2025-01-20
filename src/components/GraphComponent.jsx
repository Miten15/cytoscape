import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { CiServer, CiRouter, CiDesktop } from "react-icons/ci";
import { CircuitBoard } from "lucide-react";
import ReactDOMServer from "react-dom/server";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Add CSS for the blinking animation and popup
const styles = `
  @keyframes blink {
    0% { opacity: 0.4; }
    50% { opacity: 1; }
    100% { opacity: 0.4; }
  }
}
  .status-indicator {
    animation: blink 2s infinite;
  }
  .node-popup {
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid #666;
    border-radius: 8px;
    color: white;
    padding: 16px;
    position: fixed;
    max-width: 400px;
    z-index: 1000;
  }
  .node-popup h3 {
    margin: 0 0 8px 0;
    color: #fff;
  }
  .node-popup ul {
    margin: 0;
    padding: 0 0 0 16px;
  }
  .node-popup li {
    margin: 4px 0;
  }
  body, html {
  margin: 0;
  padding: 0;
  overflow: hidden;
}
`;

const GraphComponent = ({ data }) => {
  const svgRef = useRef();
  const [selectedNode, setSelectedNode] = useState(null);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    // Add the styles to the document
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    if (!data || !Array.isArray(data) || !data[0].mac_data) {
      console.error('Invalid data format. Expected an array with "mac_data".');
      return;
    }

    const macData = data[0].mac_data;
    const nodes = [];
    const links = [];
    const nodeConnections = new Map(); // Track node connections

    // Define cluster nodes with fixed positions
    const clusters = {
      IT: {
        id: "IT_Cluster",
        label: "IT Cluster",
        color: "#4287f5",
        x: window.innerWidth * 0.33,
        y: window.innerHeight * 0.5,
        icon: CiServer,
      },
      Network: {
        id: "Network_Cluster",
        label: "Network Cluster",
        color: "#f54242",
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.5,
        icon: CiRouter,
      },
      OT: {
        id: "OT_Cluster",
        label: "OT Cluster",
        color: "#42f54e",
        x: window.innerWidth * 0.66,
        y: window.innerHeight * 0.5,
        icon: CircuitBoard,
      },
      Unconnected: {
        id: "Unconnected_Cluster",
        label: "Unconnected Devices",
        color: "#666666",
        x: window.innerWidth * 0.1,
        y: window.innerHeight * 0.9,
        icon: CiDesktop,
      },
    };

    // Add cluster nodes
    Object.values(clusters).forEach((cluster) => {
      nodes.push({
        ...cluster,
        fx: cluster.x,
        fy: cluster.y,
        isCluster: true,
      });
    });

    // Process device nodes and track connections
    macData.forEach((category, index) => {
      const clusterType = index === 0 ? "IT" : index === 1 ? "Network" : "OT";
      const cluster = clusters[clusterType];
      const clusterId = cluster.id;

      Object.entries(category).forEach(([_, devices]) => {
        devices.forEach((device, deviceIndex) => {
          const angle = (deviceIndex * 2.399) % (2 * Math.PI);
          const radius = Math.sqrt(deviceIndex) * 50;
          const randomX = cluster.x + Math.cos(angle) * radius;
          const randomY = cluster.y + Math.sin(angle) * radius;

          const deviceNode = {
            id: device.MAC,
            IP: device.IP,
            MAC: device.MAC,
            Vendor: device.Vendor,
            Protocol: Array.isArray(device.Protocol) ? device.Protocol : [device.Protocol],
            Port: Array.isArray(device.Port) ? device.Port : [device.Port],
            status: device.status,
            type: clusterType,
            connections: device[device.MAC] || [],
            x: randomX,
            y: randomY,
            fx: randomX,
            fy: randomY,
          };
          nodes.push(deviceNode);
          nodeConnections.set(device.MAC, deviceNode);

          // Add cluster connection
          links.push({
            source: device.MAC,
            target: clusterId,
            protocol: deviceNode.Protocol,
            isClusterLink: true,
          });
        });
      });
    });

    // Add node-to-node connections
    nodes.forEach((node) => {
      if (node.connections && Array.isArray(node.connections)) {
        node.connections.forEach((targetMac) => {
          if (targetMac !== "00:00:00:00:00:00" && nodeConnections.has(targetMac)) {
            links.push({
              source: node.id,
              target: targetMac,
              protocol: node.Protocol,
              isNodeLink: true,
            });
          }
        });
      }
    });

    // Identify nodes without any node-to-node connections
    const connectedNodes = new Set();
    links.forEach((link) => {
      if (link.isNodeLink) {
        connectedNodes.add(link.source);
        connectedNodes.add(link.target);
      }
    });

    // Move unconnected nodes to "Unconnected_Cluster"
    nodes.forEach((node) => {
      if (!node.isCluster && !connectedNodes.has(node.id)) {
        // Remove existing cluster links
        for (let i = links.length - 1; i >= 0; i--) {
          if (links[i].source === node.id && links[i].isClusterLink) {
            links.splice(i, 1);
          }
        }
        // Add link to "Unconnected_Cluster"
        links.push({
          source: node.id,
          target: "Unconnected_Cluster",
          isClusterLink: true,
        });
      }
    });

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Clear existing SVG content
    const svg = d3
      .select(svgRef.current)
      .attr("width", "100%")
      .attr("height", "100%")
      .style("background-color", "#1a1a1a");

    svg.selectAll("*").remove();

    // Create tooltips
    const nodeTooltip = d3
      .select("body")
      .append("div")
      .attr("class", "graph-tooltip")
      .style("position", "absolute")
      .style("background-color", "rgba(0, 0, 0, 0.9)")
      .style("color", "white")
      .style("padding", "12px")
      .style("border-radius", "6px")
      .style("font-size", "12px")
      .style("opacity", 0)
      .style("pointer-events", "none")
      .style("z-index", 1000);

    const linkTooltip = d3
      .select("body")
      .append("div")
      .attr("class", "link-tooltip")
      .style("position", "absolute")
      .style("background-color", "rgba(0, 0, 0, 0.9)")
      .style("color", "white")
      .style("padding", "8px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("opacity", 0)
      .style("pointer-events", "none")
      .style("z-index", 1000);

    // Create container for zoom
    const container = svg.append("g");

    // Add zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance((d) => (d.isClusterLink ? 100 : 200))
          .strength((d) => (d.isClusterLink ? 0.5 : 0.2))
      )
      .force("charge", d3.forceManyBody().strength(-800))
      .force("collision", d3.forceCollide().radius(30))
      .force(
        "x",
        d3.forceX((d) => d.fx || width / 2).strength((d) => (d.fx ? 1 : 0.1))
      )
      .force(
        "y",
        d3.forceY((d) => d.fy || height / 2).strength((d) => (d.fy ? 1 : 0.1))
      );

    // Create links
    const link = container
      .append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("stroke", (d) => (d.isNodeLink ? "#ff9800" : "#999"))
      .attr("stroke-width", (d) => (d.isNodeLink ? 2 : 1))
      .attr("stroke-dasharray", (d) => (d.isNodeLink ? "10,5" : null)) // Dashed for node links
      .attr("fill", "none")
      .attr("opacity", (d) => (d.isClusterLink ? 0.1 : 0.5))
      .on("mouseover", (event, d) => {
        if (d.protocol) {
          const content = `
            <strong>Protocols:</strong><br>
            ${Array.isArray(d.protocol) ? d.protocol.join("<br>") : d.protocol}
          `;
          linkTooltip
            .html(content)
            .style("left", `${event.pageX + 15}px`)
            .style("top", `${event.pageY}px`)
            .style("opacity", 1);
        }
      })
      .on("mouseout", () => {
        linkTooltip.style("opacity", 0);
      });

    // Create node groups
    const nodeGroup = container
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        if (!d.isCluster) {
          setSelectedNode(d);
          setShowDialog(true);
        }
      })
      .on("mouseover", (event, d) => {
        if (!d.isCluster) {
          const content = `
            <div>
              <strong>${d.Vendor}</strong><br>
              MAC: ${d.MAC}<br>
              IP: ${Array.isArray(d.IP) ? d.IP.join(", ") : d.IP}<br>
              Status: ${d.status === "true" ? "Active" : "Inactive"}
            </div>
          `;
          nodeTooltip
            .html(content)
            .style("left", `${event.pageX + 15}px`)
            .style("top", `${event.pageY}px`)
            .style("opacity", 1);
        }
      })
      .on("mouseout", () => {
        nodeTooltip.style("opacity", 0);
      });

    // Add circles for clusters
    nodeGroup
      .filter((d) => d.isCluster)
      .append("circle")
      .attr("r", 30)
      .attr("fill", (d) => d.color)
      .attr("opacity", 0.3);

    // Add icons
    nodeGroup.each(function (d) {
      const IconComponent = d.isCluster ? d.icon : getIconForDevice(d.type);
      if (IconComponent) {
        const foreignObject = d3
          .select(this)
          .append("foreignObject")
          .attr("width", 24)
          .attr("height", 24)
          .attr("x", -12)
          .attr("y", -12);

        const div = foreignObject
          .append("xhtml:div")
          .style("width", "100%")
          .style("height", "100%")
          .style("display", "flex")
          .style("align-items", "center")
          .style("justify-content", "center");

        const icon = document.createElement("div");
        icon.innerHTML = ReactDOMServer.renderToStaticMarkup(
          <IconComponent width={16} height={16} stroke="white" strokeWidth={1} />
        );
        div.node().appendChild(icon.firstChild);
      }
    });

    // Add status indicators
    nodeGroup
      .filter((d) => !d.isCluster)
      .append("circle")
      .attr("class", "status-indicator")
      .attr("r", 3)
      .attr("cx", 0)
      .attr("cy", 14)
      .attr("fill", (d) => (d.status === "true" ? "#00ff00" : "#ff0000"));

    // Add labels
    nodeGroup
      .append("text")
      .attr("dy", (d) => (d.isCluster ? -40 : -18))
      .attr("text-anchor", "middle")
      .text((d) => (d.isCluster ? d.label : d.Vendor))
      .attr("fill", "white")
      .attr("font-size", "12px");

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link.attr("d", (d) => {
        const sourceNode = typeof d.source === "object" ? d.source : nodes.find((n) => n.id === d.source);
        const targetNode = typeof d.target === "object" ? d.target : nodes.find((n) => n.id === d.target);

        if (!sourceNode || !targetNode) return "";

        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const angle = Math.atan2(dy, dx);

        const sourceOffset = sourceNode.isCluster ? 30 : 12;
        const targetOffset = targetNode.isCluster ? 30 : 12;

        const startX = sourceNode.x + Math.cos(angle) * sourceOffset;
        const startY = sourceNode.y + Math.sin(angle) * sourceOffset;
        const endX = targetNode.x - Math.cos(angle) * targetOffset;
        const endY = targetNode.y - Math.sin(angle) * targetOffset;

        return `M${startX},${startY}L${endX},${endY}`;
      });

      nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    // Add legend
    const legend = svg.append("g").attr("transform", "translate(20, 20)");

    // Add status legend
    const statusItems = [
      { label: "Active", color: "#00ff00" },
      { label: "Inactive", color: "#ff0000" },
    ];

    statusItems.forEach((item, i) => {
      const g = legend.append("g").attr("transform", `translate(0, ${i * 25})`);

      g.append("circle").attr("r", 6).attr("fill", item.color);

      g.append("text").attr("x", 15).attr("y", 5).attr("fill", "white").text(item.label);
    });

    // Add connection type legend
    const connectionLegend = legend.append("g").attr("transform", "translate(0, 70)");

    // Cluster connection
    connectionLegend
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 30)
      .attr("y2", 0)
      .attr("stroke", "#999")
      .attr("stroke-width", 1)
      .attr("opacity", 0.5);

    connectionLegend.append("text").attr("x", 40).attr("y", 5).attr("fill", "white").text("Cluster Connection");

    // Node connection
    connectionLegend
      .append("line")
      .attr("x1", 0)
      .attr("y1", 25)
      .attr("x2", 30)
      .attr("y2", 25)
      .attr("stroke", "#ff9800")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "10,5");

    connectionLegend.append("text").attr("x", 40).attr("y", 30).attr("fill", "white").text("Node Connection");

    // Cleanup
    return () => {
      simulation.stop();
      nodeTooltip.remove();
      linkTooltip.remove();
      document.head.removeChild(styleSheet);
    };
  }, [data]);

  function getIconForDevice(type) {
    const icons = {
      IT: CiDesktop,
      OT: CircuitBoard,
      Network: CiRouter,
    };
    return icons[type] || CiDesktop;
  }

  return (
    <div className="relative w-full h-full" style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <svg ref={svgRef} className="w-full h-full"></svg>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNode?.Vendor}</DialogTitle>
          </DialogHeader>
          {selectedNode && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="font-medium">Device Information</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">MAC Address:</div>
                  <div>{selectedNode.MAC}</div>
                  <div className="text-muted-foreground">IP Address:</div>
                  <div>{Array.isArray(selectedNode.IP) ? selectedNode.IP.join(", ") : selectedNode.IP}</div>
                  <div className="text-muted-foreground">Type:</div>
                  <div>{selectedNode.type}</div>
                  <div className="text-muted-foreground">Status:</div>
                  <div>{selectedNode.status === "true" ? "Active" : "Inactive"}</div>
                </div>
              </div>

              {selectedNode.connections?.length > 0 && (
                <div className="grid gap-2">
                  <div className="font-medium">Connected Devices</div>
                  <div className="text-sm">
                    {selectedNode.connections.map((mac, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <div>{mac}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.Protocol?.length > 0 && (
                <div className="grid gap-2">
                  <div className="font-medium">Communication Protocols</div>
                  <div className="text-sm">
                    {selectedNode.Protocol.map((protocol, index) => (
                      <div key={index}>{protocol}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GraphComponent;