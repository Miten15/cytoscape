import React, { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { CircuitBoard, Laptop, Router, Monitor } from "lucide-react"
import ReactDOMServer from "react-dom/server"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Toast,
  ToastProps,
  ToastActionElement,
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

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
    color: #000000;
    padding: 16px;
    position: fixed;
    max-width: 400px;
    z-index: 1000;
  }
  .link-tooltip {
    background: rgba(0, 0, 0, 0.95);
    border: 1px solid #666;
    border-radius: 8px;
    color: #585858;
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
  const { toast } = useToast()

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
        x: window.innerWidth * 0.2,
        y: window.innerHeight * 0.5,
        icon: Laptop,
        color: "#4287f55c",
      },
      Network: {
        id: "Network_Cluster",
        label: "Network Cluster",
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.5,
        icon: Router,
        color: "#f5424255",
      },
      OT: {
        id: "OT_Cluster",
        label: "OT Cluster",
        x: window.innerWidth * 0.8,
        y: window.innerHeight * 0.5,
        icon: CircuitBoard,
        color: "#42f54e50",
      },
      Unconnected: {
        id: "Unconnected_Cluster",
        label: "Public Devices",
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 1.1,
        icon: Monitor,
        color: "#666666",
      },
    }

    // Function to check if IP is public
    const isPublicIP = (ip) => {
      if (ip === "Null" || !ip || typeof ip !== "string") return true
      const parts = ip.split(".")
      if (parts.length !== 4) return true
      const firstOctet = Number.parseInt(parts[0], 10)
      const secondOctet = Number.parseInt(parts[1], 10)
      return !(
        firstOctet === 10 ||
        (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
        (firstOctet === 192 && secondOctet === 168)
      )
    }

    const isDNSResolverIP = (ip) => {
      const dnsResolverIPs = ["1.1.1.1", "8.8.8.8", "8.8.4.4", "9.9.9.9"]
      return dnsResolverIPs.includes(ip)
    }

    const classifyDevice = (device) => {
      const ips = Array.isArray(device.IP) ? device.IP : [device.IP]
      let clusterType = "Unconnected"
      let hasPublicIP = false

      // Check the first IP (primary IP) for classification
      const primaryIP = ips[0]

      if (device.Vendor.includes("Cisco Systems") || device.type === "Network") {
        clusterType = "Network"
      } else if (
        primaryIP.startsWith("172.16.") ||
        primaryIP.startsWith("172.17.") ||
        primaryIP.startsWith("172.18.") ||
        primaryIP.startsWith("172.19.") ||
        primaryIP.startsWith("172.20.") ||
        primaryIP.startsWith("172.21.") ||
        primaryIP.startsWith("172.22.") ||
        primaryIP.startsWith("172.23.") ||
        primaryIP.startsWith("172.24.") ||
        primaryIP.startsWith("172.25.") ||
        primaryIP.startsWith("172.26.") ||
        primaryIP.startsWith("172.27.") ||
        primaryIP.startsWith("172.28.") ||
        primaryIP.startsWith("172.29.") ||
        primaryIP.startsWith("172.30.") ||
        primaryIP.startsWith("172.31.") ||
        device.Vendor === "Tenda Technology Co.,Ltd.Dongguan branch"
      ) {
        clusterType = "OT"
      } else if (
        primaryIP.startsWith("192.168.") ||
        primaryIP.startsWith("10.") ||
        device.Vendor === "TELEMECANIQUE ELECTRIQUE"
      ) {
        clusterType = "IT"
      }

      // Check for public IPs
      ips.forEach((ip) => {
        if (isPublicIP(ip) && !isDNSResolverIP(ip)) {
          hasPublicIP = true
        }
      })

      if (hasPublicIP) {
        toast({
          title: "Public IP Detected",
          description: `Device ${device.Vendor} (${device.MAC}) has a public IP address.`,
          duration: 5000,
        })
      }

      return { clusterType, hasPublicIP }
    }

    // Process nodes
    let hasUnconnectedNodes = false
    macData.forEach((category) => {
      Object.values(category).forEach((devices) => {
        devices.forEach((device) => {
          const { clusterType, hasPublicIP } = classifyDevice(device)
          hasUnconnectedNodes = hasUnconnectedNodes || clusterType === "Unconnected"

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
            cluster: clusters[clusterType],
            hasPublicIP: hasPublicIP,
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
      .style("background-color", "#afafaf")

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
            const k = alpha * 1.5 // Increased strength
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
        const content = `
          <div>
            <strong>${d.Vendor}</strong><br>
            MAC: ${d.MAC}<br>
            IP: ${Array.isArray(d.IP) ? d.IP.join(", ") : d.IP}<br>
            Status: ${d.status === "true" ? "Active" : "Inactive"}
            ${d.hasPublicIP ? '<br><strong style="color: #ff6b6b;">Has Public IP</strong>' : ""}
          </div>
        `
        nodeTooltip
          .html(content)
          .style("left", `${event.pageX + 15}px`)
          .style("top", `${event.pageY}px`)
          .style("opacity", 1)
      })
      .on("mouseout", () => {
        nodeTooltip.style("opacity", 0)
      })

    // Add icons to nodes
    node.each(function (d) {
      const IconComponent = getIconForDevice(d.type)
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
  }, [data, toast])

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
                  {selectedNode.hasPublicIP && (
                    <>
                      <div className="text-muted-foreground">Public IP:</div>
                      <div className="text-red-500">Yes</div>
                    </>
                  )}
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

