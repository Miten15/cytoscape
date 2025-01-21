import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { CircuitBoard, Laptop, Router, Monitor } from "lucide-react"
import ReactDOMServer from "react-dom/server"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const styles = `
  @keyframes blink {
    0% { opacity: 0.4; }
    50% { opacity: 1; }
    100% { opacity: 0.4; }
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
  .link-tooltip {
    background: rgba(0, 0, 0, 0.95);
    border: 1px solid #666;
    border-radius: 8px;
    color: white;
    padding: 12px;
    position: fixed;
    max-width: 300px;
    z-index: 1000;
    pointer-events: none;
    font-size: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  }
  .link-tooltip .connection-details {
    margin-bottom: 8px;
    font-weight: bold;
  }
  .link-tooltip .connection-item {
    margin-bottom: 4px;
  }
  .link-tooltip .label {
    color: #9ca3af;
    margin-right: 4px;
  }
  .link-tooltip .protocol {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #666;
  }
  body, html {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
`

const ICON_SIZE = 26
const CLUSTER_RADIUS = 200
const CLUSTER_PADDING = 60

const GraphComponent = ({ data }) => {
  const svgRef = useRef()
  const [selectedNode, setSelectedNode] = useState(null)
  const [showDialog, setShowDialog] = useState(false)
  const [nodes, setNodes] = useState([])
  const [links, setLinks] = useState([])

  useEffect(() => {
    const styleSheet = document.createElement("style")
    styleSheet.innerText = styles
    document.head.appendChild(styleSheet)

    if (!data?.[0]?.mac_data) {
      console.error("Invalid data format")
      return
    }

    const macData = data[0].mac_data
    const newNodes = []
    const newLinks = []
    const nodeConnections = new Map()

    // Define cluster centers
    const clusters = {
      IT: {
        id: "IT_Cluster",
        label: "IT Cluster",
        x: window.innerWidth * 0.15,
        y: window.innerHeight * 0.3,
        icon: Laptop,
        color: "#4287f5",
      },
      Network: {
        id: "Network_Cluster",
        label: "Network Cluster",
        x: window.innerWidth * 0.85,
        y: window.innerHeight * 0.3,
        icon: Router,
        color: "#f54242",
      },
      OT: {
        id: "OT_Cluster",
        label: "OT Cluster",
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.3,
        icon: CircuitBoard,
        color: "#42f54e",
      },
      Unconnected: {
        id: "Unconnected_Cluster",
        label: "Unconnected Devices",
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 1.1,
        icon: Monitor,
        color: "#666666",
      },
    }

    // Function to check if IP is public
    const isPublicIP = (ip) => {
      if (!ip || typeof ip !== "string") return false
      const parts = ip.split(".")
      if (parts.length !== 4) return false
      return !(
        parts[0] === "10" ||
        (parts[0] === "172" && Number.parseInt(parts[1], 10) >= 16 && Number.parseInt(parts[1], 10) <= 31) ||
        (parts[0] === "192" && parts[1] === "168")
      )
    }

    // Process nodes
    let hasUnconnectedNodes = false
    macData.forEach((category, index) => {
      const clusterType = index === 0 ? "IT" : index === 1 ? "Network" : "OT"

      Object.values(category).forEach((devices) => {
        devices.forEach((device) => {
          const isPublic = isPublicIP(device.IP)
          const deviceType = isPublic ? "Unconnected" : clusterType

          if (isPublic) {
            hasUnconnectedNodes = true
          }

          const deviceNode = {
            id: device.MAC,
            IP: device.IP,
            MAC: device.MAC,
            Vendor: device.Vendor,
            Protocol: Array.isArray(device.Protocol) ? device.Protocol : [device.Protocol],
            Port: Array.isArray(device.Port) ? device.Port : [device.Port],
            status: device.status,
            type: deviceType,
            connections: device[device.MAC] || [],
            cluster: clusters[deviceType],
            fx: null,
            fy: null,
          }
          newNodes.push(deviceNode)
          nodeConnections.set(device.MAC, deviceNode)
        })
      })
    })

    // Add connections
    newNodes.forEach((node) => {
      if (Array.isArray(node.connections)) {
        node.connections.forEach((targetMac) => {
          if (targetMac !== "00:00:00:00:00:00" && nodeConnections.has(targetMac)) {
            newLinks.push({
              source: node.id,
              target: targetMac,
              protocol: node.Protocol,
              sourceNode: node,
              targetNode: nodeConnections.get(targetMac),
            })
          }
        })
      }
    })

    setNodes(newNodes)
    setLinks(newLinks)

    const width = window.innerWidth
    const height = window.innerHeight

    // Setup SVG
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("background-color", "#1a1a1a")

    svg.selectAll("*").remove()

    // Create tooltips
    const nodeTooltip = d3.select("body").append("div").attr("class", "node-popup").style("opacity", 0)

    const linkTooltip = d3.select("body").append("div").attr("class", "link-tooltip").style("opacity", 0)

    const container = svg.append("g")

    // Add zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform)
      })

    svg.call(zoom)

    // Create visible clusters
    const visibleClusters = Object.values(clusters).filter(
      (cluster) => cluster.id !== "Unconnected_Cluster" || hasUnconnectedNodes,
    )

    // Create cluster regions
    const clusterGroups = container
      .append("g")
      .selectAll("g")
      .data(visibleClusters)
      .join("g")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)

    // Add cluster circles
    clusterGroups
      .append("circle")
      .attr("r", CLUSTER_RADIUS)
      .attr("fill", "none")
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5")

    // Add cluster labels
    clusterGroups
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", -CLUSTER_RADIUS - 20)
      .attr("fill", "white")
      .attr("font-size", "20px")
      .attr("font-weight", "bold")
      .text((d) => d.label)

    // Improved force simulation
    const simulation = d3
      .forceSimulation(newNodes)
      .force(
        "link",
        d3
          .forceLink(newLinks)
          .id((d) => d.id)
          .distance(100),
      )
      .force("charge", d3.forceManyBody().strength(-1000))
      .force("collision", d3.forceCollide(ICON_SIZE * 2))
      .force("x", d3.forceX(width / 2).strength(0.1))
      .force("y", d3.forceY(height / 2).strength(0.1))
      .force("cluster", (alpha) => {
        newNodes.forEach((node) => {
          if (node.cluster) {
            const k = alpha * 0.8
            const dx = node.x - node.cluster.x
            const dy = node.y - node.cluster.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            if (dist > CLUSTER_RADIUS - CLUSTER_PADDING) {
              const angle = Math.atan2(dy, dx)
              node.x = node.cluster.x + (CLUSTER_RADIUS - CLUSTER_PADDING) * Math.cos(angle)
              node.y = node.cluster.y + (CLUSTER_RADIUS - CLUSTER_PADDING) * Math.sin(angle)
            }
          }
        })
      })

    // Create links with enhanced tooltips
    const link = container
      .append("g")
      .selectAll("line")
      .data(newLinks)
      .join("line")
      .attr("stroke", "#666")
      .attr("stroke-width", 0.2)
      //.attr("stroke-dasharray", "5,5")
      .on("mouseover", (event, d) => {
        const content = `
          <div class="connection-details">Connection Details</div>
          <div class="connection-item">
            <span class="label">From:</span> ${d.sourceNode.Vendor} (${d.sourceNode.MAC})
          </div>
          <div class="connection-item">
            <span class="label">To:</span> ${d.targetNode.Vendor} (${d.targetNode.MAC})
          </div>
          ${
            d.protocol
              ? `
            <div class="protocol">
              <span class="label">Protocol:</span> ${Array.isArray(d.protocol) ? d.protocol.join(", ") : d.protocol}
            </div>
          `
              : ""
          }
        `
        linkTooltip
          .html(content)
          .style("left", `${event.pageX + 15}px`)
          .style("top", `${event.pageY}px`)
          .style("opacity", 1)
      })
      .on("mousemove", (event) => {
        linkTooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY}px`)
      })
      .on("mouseout", () => {
        linkTooltip.style("opacity", 0)
      })

    // Create nodes
    const node = container
      .append("g")
      .selectAll("g")
      .data(newNodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        setSelectedNode(d)
        setShowDialog(true)
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
          `
          nodeTooltip
            .html(content)
            .style("left", `${event.pageX + 15}px`)
            .style("top", `${event.pageY}px`)
            .style("opacity", 1)
        }
      })
      .on("mouseout", () => {
        nodeTooltip.style("opacity", 0)
      })

    // Add icons to nodes
    node.each(function (d) {
      const IconComponent = getIconForDevice(d.type)
      if (IconComponent) {
        const foreignObject = d3
          .select(this)
          .append("foreignObject")
          .attr("width", ICON_SIZE)
          .attr("height", ICON_SIZE)
          .attr("x", -ICON_SIZE / 2)
          .attr("y", -ICON_SIZE / 2)

        const div = foreignObject
          .append("xhtml:div")
          .style("width", "100%")
          .style("height", "100%")
          .style("display", "flex")
          .style("align-items", "center")
          .style("justify-content", "center")

        const icon = document.createElement("div")
        icon.innerHTML = ReactDOMServer.renderToStaticMarkup(
          <IconComponent width={ICON_SIZE} height={ICON_SIZE} stroke="white" strokeWidth={1.5} />,
        )
        div.node().appendChild(icon.firstChild)
      }
    })

    // Add status indicators
    node
      .append("circle")
      .attr("class", "status-indicator")
      .attr("r", 4)
      .attr("cx", 0)
      .attr("cy", ICON_SIZE / 2 + 4)
      .attr("fill", (d) => (d.status === "true" ? "#00ff00" : "#ff0000"))

    // Add labels
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", -ICON_SIZE / 2 - 8)
      .attr("fill", "white")
      .attr("font-size", "14px")
      .text((d) => d.Vendor)

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y)

      node.attr("transform", (d) => `translate(${d.x},${d.y})`)
    })

    return () => {
      simulation.stop()
      nodeTooltip.remove()
      linkTooltip.remove()
      document.head.removeChild(styleSheet)
    }
  }, [data])

  function getIconForDevice(type) {
    const icons = {
      IT: Laptop,
      OT: CircuitBoard,
      Network: Router,
      Unconnected: Monitor,
    }
    return icons[type] || Monitor
  }

  return (
    <div className="relative w-full h-full" style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
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
                  <div className="text-sm max-h-40 overflow-y-auto">
                    {selectedNode.connections.map((mac, index) => {
                      const connectedNode = nodes.find((node) => node.MAC === mac)
                      return (
                        <div key={index} className="flex items-center gap-2 py-1">
                          <div className="w-2 h-2 rounded-full bg-primary"></div>
                          <div>{connectedNode ? `${connectedNode.Vendor} (${mac})` : mac}</div>
                        </div>
                      )
                    })}
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
  )
}

export default GraphComponent

