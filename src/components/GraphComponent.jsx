"use client"

import React, { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { CircuitBoard, Laptop, Router, Monitor } from "lucide-react"
import ReactDOMServer from "react-dom/server"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

const ICON_SIZE = 26
const NODE_GAP = 80
const NODES_PER_ROW = 30
const FORCE_STRENGTH = -120
const COLLISION_RADIUS = NODE_GAP / 2 + ICON_SIZE / 2 // Updated collision radius

// Define clusters with improved styling
const CLUSTERS = {
  IT: {
    id: "IT_Cluster",
    label: "IT Cluster",
    icon: Laptop,
    color: "#4287f520",
    strokeColor: "#0c1930",
  },
  Network: {
    id: "Network_Cluster",
    label: "Network Cluster",
    icon: Router,
    color: "#f5424220",
    strokeColor: "#2b0808",
  },
  OT: {
    id: "OT_Cluster",
    label: "OT Cluster",
    icon: CircuitBoard,
    color: "#42f54e20",
    strokeColor: "#020e02",
  },
  Unconnected: {
    id: "Unconnected_Cluster",
    label: "Public Devices",
    icon: Monitor,
    color: "#66666620",
    strokeColor: "#666666f0",
  },
}

// Styles for the graph
const styles = `
  .node-tooltip {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #1e293b;
    padding: 12px;
    position: fixed;
    max-width: 300px;
    z-index: 1000;
    pointer-events: none;
    font-size: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  .link-tooltip {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #1e293b;
    padding: 12px;
    position: fixed;
    max-width: 300px;
    z-index: 1000;
    pointer-events: none;
    font-size: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  @keyframes blink {
    0% { opacity: 0.4; }
    50% { opacity: 1; }
    100% { opacity: 0.4; }
  }
  .status-indicator {
    animation: blink 2s infinite;
  }
`

function calculateInitialPosition(index, total, centerX, centerY, radius) {
  const nodesPerRing = Math.floor((Math.PI * radius) / NODE_GAP)
  const ringIndex = Math.floor(index / nodesPerRing)
  const nodeInRing = index % nodesPerRing

  const ringRadius = (radius * (ringIndex + 1)) / Math.ceil(total / nodesPerRing)

  const goldenRatio = (1 + Math.sqrt(5)) / 2
  const angle = 2 * Math.PI * goldenRatio * nodeInRing

  return {
    x: centerX + ringRadius * Math.cos(angle),
    y: centerY + ringRadius * Math.sin(angle),
  }
}

function calculateClusterRadius(nodeCount) {
  const baseRadius = 400
  const scaleFactor = Math.sqrt(nodeCount / 30)
  return Math.max(baseRadius, Math.min(baseRadius * scaleFactor, 1200))
}

function GraphComponent({ data }) {
  const svgRef = useRef()
  const [selectedNode, setSelectedNode] = useState(null)
  const [showDialog, setShowDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const styleSheet = document.createElement("style")
    styleSheet.innerText = styles
    document.head.appendChild(styleSheet)

    if (!data?.[0]?.mac_data) {
      console.error("Invalid data format")
      return
    }

    console.log("Processing data:", data[0].mac_data)

    const width = window.innerWidth
    const height = window.innerHeight
    const svg = d3.select(svgRef.current).attr("width", width).attr("height", height).style("background-color", "white")

    svg.selectAll("*").remove()

    // Create tooltips
    const nodeTooltip = d3.select("body").append("div").attr("class", "node-tooltip").style("opacity", 0)
    const linkTooltip = d3.select("body").append("div").attr("class", "link-tooltip").style("opacity", 0)

    const container = svg.append("g")

    // Initialize zoom with a starting transform to show the entire graph
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform)
      })

    // Calculate initial zoom to fit all clusters
    const initialScale = 0.2
    const initialX = width / 2 - (width * initialScale) / 2
    const initialY = height / 2 - (height * initialScale) / 2

    svg.call(zoom).call(zoom.transform, d3.zoomIdentity.translate(initialX, initialY).scale(initialScale))

    // Process nodes and organize by cluster
    const nodesByCluster = {
      IT: [],
      Network: [],
      OT: [],
      Unconnected: [],
    }

    const nodeMap = new Map()
    const links = []

    function wrap(text, width) {
      text.each(function () {
        const text = d3.select(this)
        const words = text.text().split(/\s+/).reverse()
        let word
        let line = []
        let lineNumber = 0
        const lineHeight = 1.1
        const y = text.attr("y")
        const dy = Number.parseFloat(text.attr("dy")) || 0
        let tspan = text
          .text(null)
          .append("tspan")
          .attr("x", 0)
          .attr("y", y)
          .attr("dy", dy + "em")

        while ((word = words.pop())) {
          line.push(word)
          tspan.text(line.join(" "))
          if (tspan.node().getComputedTextLength() > width) {
            line.pop()
            tspan.text(line.join(" "))
            line = [word]
            tspan = text
              .append("tspan")
              .attr("x", 0)
              .attr("y", y)
              .attr("dy", ++lineNumber * lineHeight + dy + "em")
              .text(word)
          }
        }

        // Center the text vertically based on the number of lines
        const lines = text.selectAll("tspan")
        const totalLines = lines.size()
        lines.attr("y", (d, i) => {
          return -(totalLines * lineHeight) - ICON_SIZE / 2 - 12 + i * lineHeight // Updated label positioning
        })
      })
    }

    // Helper functions
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

      console.log("Device type:", device.type, "Device:", device)

      if (
        (device.type && typeof device.type === "string" && device.type.toLowerCase() === "network") ||
        (device.Type && typeof device.Type === "string" && device.Type.toLowerCase() === "network") ||
        (device.deviceType && typeof device.deviceType === "string" && device.deviceType.toLowerCase() === "network") ||
        (device.Vendor && typeof device.Vendor === "string" && device.Vendor.toLowerCase().includes("router")) ||
        (device.Vendor && typeof device.Vendor === "string" && device.Vendor.toLowerCase().includes("switch")) ||
        (device.Vendor && typeof device.Vendor === "string" && device.Vendor.toLowerCase().includes("gateway"))
      ) {
        console.log("Classified as Network:", device)
        return { clusterType: "Network", hasPublicIP: false }
      }

      const primaryIP = ips[0]

      if (
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
    data[0].mac_data.forEach((category) => {
      console.log("Processing category:", category)
      Object.values(category).forEach((devices) => {
        console.log("Processing devices:", devices)
        devices.forEach((device) => {
          console.log("Processing device:", device)
          const { clusterType, hasPublicIP } = classifyDevice(device)
          console.log("Classified as:", clusterType)

          const node = {
            id: device.MAC,
            IP: device.IP,
            MAC: device.MAC,
            Vendor: device.Vendor,
            Protocol: Array.isArray(device.Protocol) ? device.Protocol : [device.Protocol],
            Port: Array.isArray(device.Port) ? device.Port : [device.Port],
            status: device.status,
            type: clusterType,
            connections: device[device.MAC] || [],
            hasPublicIP,
          }

          nodesByCluster[clusterType].push(node)
          nodeMap.set(device.MAC, node)
        })
      })
    })

    // Create connections
    Object.values(nodesByCluster)
      .flat()
      .forEach((node) => {
        if (Array.isArray(node.connections)) {
          node.connections.forEach((targetMac) => {
            if (targetMac !== "00:00:00:00:00:00" && nodeMap.has(targetMac)) {
              links.push({
                source: node.id,
                target: targetMac,
                protocol: node.Protocol,
                sourceNode: node,
                targetNode: nodeMap.get(targetMac),
              })
            }
          })
        }
      })

    // Define cluster positions
    const clusterPositions = {
      IT: { x: width * -0.9, y: height * 0.5 },
      Network: { x: width * 0.5, y: height * 0.5 },
      OT: { x: width * 1.9, y: height * 0.5 },
      Unconnected: { x: width * 0.5, y: height * 2.9 },
    }

    // Create cluster regions
    Object.entries(CLUSTERS).forEach(([type, cluster]) => {
      const position = clusterPositions[type]
      const nodeCount = nodesByCluster[type].length
      const radius = calculateClusterRadius(nodeCount)
      const nodes = nodesByCluster[type]

      // Draw cluster circle
      container
        .append("circle")
        .attr("cx", position.x)
        .attr("cy", position.y)
        .attr("r", radius)
        .attr("fill", cluster.color)
        .attr("stroke", cluster.strokeColor)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")

      // Add cluster label
      container
        .append("text")
        .attr("x", position.x)
        .attr("y", position.y - radius - 20)
        .attr("text-anchor", "middle")
        .attr("fill", "#1e293b")
        .attr("font-size", "20px")
        .attr("font-weight", "bold")
        .text(cluster.label)

      // Position nodes within cluster using force-directed layout
      nodes.forEach((node, index) => {
        const initialPos = calculateInitialPosition(index, nodes.length, position.x, position.y, radius * 0.8)
        node.x = initialPos.x
        node.y = initialPos.y
      })

      // Apply force-directed layout to nodes within each cluster
      const simulation = d3
        .forceSimulation(nodes)
        .force("center", d3.forceCenter(position.x, position.y))
        .force("charge", d3.forceManyBody().strength(FORCE_STRENGTH))
        .force("collision", d3.forceCollide().radius(COLLISION_RADIUS))
        .force("x", d3.forceX(position.x).strength(0.1))
        .force("y", d3.forceY(position.y).strength(0.1))
        .stop()

      // Run the simulation
      for (let i = 0; i < 300; i++) simulation.tick()

      // Update node positions after simulation
      nodes.forEach((node, index) => {
        node.x = simulation.nodes()[index].x
        node.y = simulation.nodes()[index].y
      })

      // Calculate label positions for nodes
      nodes.forEach((node) => {
        const dx = node.x - position.x
        const dy = node.y - position.y
        const theta = Math.atan2(dy, dx)

        const labelAnchor = "middle"
        const labelDx = 0
        const labelDy = ICON_SIZE / 2 + 12 // Increased padding below the icon
      })
    })

    // Draw connections
    container
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#64748bab")
      .attr("stroke-width", 0.4)
      .attr("x1", (d) => nodeMap.get(d.source).x)
      .attr("y1", (d) => nodeMap.get(d.source).y)
      .attr("x2", (d) => nodeMap.get(d.target).x)
      .attr("y2", (d) => nodeMap.get(d.target).y)
      .on("mouseover", (event, d) => {
        linkTooltip
          .style("opacity", 1)
          .html(`
            <div class="space-y-2">
              <div class="font-semibold">Connection Details</div>
              <div class="text-slate-600">From: ${d.sourceNode.Vendor} (${d.sourceNode.MAC})</div>
              <div class="text-slate-600">To: ${d.targetNode.Vendor} (${d.targetNode.MAC})</div>
              ${
                d.protocol
                  ? `
                <div class="mt-2 pt-2 border-t border-slate-200">
                  <div class="text-slate-600">Protocol: ${Array.isArray(d.protocol) ? d.protocol.join(", ") : d.protocol}</div>
                </div>
              `
                  : ""
              }
            </div>
          `)
          .style("left", `${event.pageX + 15}px`)
          .style("top", `${event.pageY}px`)
      })
      .on("mousemove", (event) => {
        linkTooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY}px`)
      })
      .on("mouseout", () => {
        linkTooltip.style("opacity", 0)
      })

    // Create nodes
    const nodeGroups = container
      .append("g")
      .selectAll("g")
      .data(Object.values(nodesByCluster).flat())
      .join("g")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .attr("cursor", "pointer")
      .on("click", (event, d) => {
        setSelectedNode(d)
        setShowDialog(true)
      })
      .on("mouseover", (event, d) => {
        nodeTooltip
          .style("opacity", 1)
          .html(`
            <div class="space-y-2">
              <div class="font-semibold">${d.Vendor}</div>
              <div class="text-slate-600">MAC: ${d.MAC}</div>
              <div class="text-slate-600">IP: ${Array.isArray(d.IP) ? d.IP.join(", ") : d.IP}</div>
              <div class="flex items-center gap-2">
                <span class="text-slate-600">Status:</span>
                <span class="${d.status === "true" ? "text-emerald-600" : "text-red-600"}">
                  ${d.status === "true" ? "Active" : "Inactive"}
                </span>
              </div>
              ${d.hasPublicIP ? '<div class="text-red-500 font-medium mt-2">Has Public IP</div>' : ""}
            </div>
          `)
          .style("left", `${event.pageX + 15}px`)
          .style("top", `${event.pageY}px`)
      })
      .on("mousemove", (event) => {
        nodeTooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY}px`)
      })
      .on("mouseout", () => {
        nodeTooltip.style("opacity", 0)
      })

    // Add icons to nodes
    nodeGroups.each(function (d) {
      const Icon = CLUSTERS[d.type].icon
      const iconHTML = ReactDOMServer.renderToStaticMarkup(
        <Icon width={ICON_SIZE} height={ICON_SIZE} className="text-slate-700" strokeWidth={1.5} />,
      )

      const foreignObject = d3
        .select(this)
        .append("foreignObject")
        .attr("width", ICON_SIZE)
        .attr("height", ICON_SIZE)
        .attr("x", -ICON_SIZE / 2)
        .attr("y", -ICON_SIZE / 2)

      foreignObject
        .append("xhtml:div")
        .style("width", "100%")
        .style("height", "100%")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .html(iconHTML)
    })

    // Add status indicators
    nodeGroups
      .append("circle")
      .attr("class", "status-indicator")
      .attr("r", 4)
      .attr("cx", 0)
      .attr("cy", ICON_SIZE / 2 + 4)
      .attr("fill", (d) => (d.status === "true" ? "#22c55e" : "#ef4444"))

    // Add labels
    nodeGroups
      .append("text")
      .text((d) => d.Vendor)
      .attr("text-anchor", "middle")
      .attr("x", 0)
      .attr("y", -ICON_SIZE / 2 - 12) // Updated label Y position
      .style("font-size", "10px")
      .style("font-weight", "500")
      .attr("fill", "#1e293b")
      .style("pointer-events", "none")
      .call(wrap, NODE_GAP - 10)

    return () => {
      nodeTooltip.remove()
      linkTooltip.remove()
      document.head.removeChild(styleSheet)
    }
  }, [data, toast])

  return (
    <div className="relative w-full h-full bg-white" style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <svg ref={svgRef} className="w-full h-full"></svg>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-slate-900">{selectedNode?.Vendor}</DialogTitle>
          </DialogHeader>
          {selectedNode && (
            <div className="grid gap-6">
              <div className="grid gap-4">
                <div className="font-medium text-base text-slate-900">Device Information</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <DetailItem label="MAC Address" value={selectedNode.MAC} />
                  <DetailItem
                    label="IP Address"
                    value={Array.isArray(selectedNode.IP) ? selectedNode.IP.join(", ") : selectedNode.IP}
                  />
                  <DetailItem label="Type" value={selectedNode.type} />
                  <DetailItem
                    label="Status"
                    value={selectedNode.status === "true" ? "Active" : "Inactive"}
                    valueClass={selectedNode.status === "true" ? "text-emerald-600" : "text-red-600"}
                  />
                  {selectedNode.hasPublicIP && (
                    <DetailItem label="Public IP" value="Yes" valueClass="text-red-500 font-medium" />
                  )}
                </div>
              </div>

              {selectedNode.connections?.length > 0 && (
                <div className="grid gap-4">
                  <div className="font-medium text-base text-slate-900">Connected Devices</div>
                  <div className="text-sm max-h-40 overflow-y-auto space-y-2">
                    {selectedNode.connections.map((mac, index) => (
                      <div key={index} className="flex items-center gap-2 py-1 text-slate-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                        <span className="font-mono">{mac}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.Protocol?.length > 0 && (
                <div className="grid gap-4">
                  <div className="font-medium text-base text-slate-900">Communication Protocols</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.Protocol.map((protocol, index) => (
                      <span
                        key={index}
                        className="px-2.5 py-1 text-xs rounded-full bg-slate-100 text-slate-700 font-medium"
                      >
                        {protocol}
                      </span>
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

const DetailItem = ({ label, value, valueClass = "" }) => (
  <div className="grid gap-1">
    <div className="text-slate-500 font-medium">{label}</div>
    <div className={`font-mono text-slate-900 ${valueClass}`}>{value || "Unknown"}</div>
  </div>
)

export default GraphComponent



