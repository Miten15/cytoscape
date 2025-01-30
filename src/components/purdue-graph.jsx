"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import * as d3 from "d3"
import {
  Laptop,
  Router,
  Server,
  PinIcon as Chip,
  Cpu,
  Factory,
  Network,
  HardHat,
  Wrench,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import ReactDOMServer from "react-dom/server"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const ICON_SIZE = 40
const ZONE_PADDING = 60
const ZONE_WIDTH = 3600
const LEVEL_GAP = 40
const NODES_PER_LINE = 20
const NODE_GAP = 169

const ZONE_DEFINITIONS = [
  {
    name: "IT Devices (Level 3)",
    level: 3,
    color: "from-blue-50 to-blue-100/80",
    borderColor: "border-blue-200",
  },
  {
    name: "Network Devices (Level 2)",
    level: 2,
    color: "from-amber-50 to-amber-100/80",
    borderColor: "border-amber-200",
  },
  {
    name: "OT Devices (Level 1)",
    level: 1,
    color: "from-emerald-50 to-emerald-100/80",
    borderColor: "border-emerald-200",
  },
]

const PurdueGraph = ({ data, mode }) => {
  const svgRef = useRef(null)
  const tooltipRef = useRef(null)
  const linkTooltipRef = useRef(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [showDialog, setShowDialog] = useState(false)

  const classifyDevice = useCallback((device) => {
    const ips = Array.isArray(device.IP) ? device.IP : [device.IP || ""]

    // Network devices check
    const isNetworkDevice =
      device.Vendor?.toLowerCase().includes("cisco") ||
      device.Type?.toLowerCase() === "network" ||
      device.Type?.toLowerCase().includes("router") ||
      device.Type?.toLowerCase().includes("switch") ||
      device.Type?.toLowerCase().includes("firewall") ||
      device.Type?.toLowerCase().includes("gateway") ||
      (device.Vendor &&
        ["juniper", "palo alto", "fortinet", "huawei", "arista"].some((vendor) =>
          device.Vendor.toLowerCase().includes(vendor),
        ))

    if (isNetworkDevice) return ZONE_DEFINITIONS.find((z) => z.level === 2)

    // OT devices check
    const isOTDevice =
      ips.some((ip) => ip?.startsWith("172.")) ||
      ["PLC", "RTU", "Sensor", "Actuator"].some((type) => device.Type?.toLowerCase().includes(type.toLowerCase()))

    if (isOTDevice) return ZONE_DEFINITIONS.find((z) => z.level === 1)

    // Default to IT
    return ZONE_DEFINITIONS.find((z) => z.level === 3)
  }, [])

  const getIconForDevice = useCallback((device) => {
    if (device.zone?.level === 1) {
      if (device.Type?.includes("PLC")) return Chip
      if (device.Type?.includes("Sensor")) return Cpu
      if (device.Type?.includes("Actuator")) return Wrench
      return Factory
    }
    if (device.zone?.level === 2) return Network
    return device.Type?.includes("Workstation") ? Laptop : Server
  }, [])

  const calculatePosition = useCallback((index, zoneY, totalNodes, zoneHeight) => {
    const rows = Math.ceil(totalNodes / NODES_PER_LINE)
    const lastRowNodes = totalNodes % NODES_PER_LINE || NODES_PER_LINE
    const isLastRow = Math.floor(index / NODES_PER_LINE) === rows - 1
    const nodesInThisRow = isLastRow ? lastRowNodes : NODES_PER_LINE

    const row = Math.floor(index / NODES_PER_LINE)
    const col = index % NODES_PER_LINE
    const rowOffset = ((NODES_PER_LINE - nodesInThisRow) * NODE_GAP) / 2

    const x = ZONE_PADDING + col * NODE_GAP + NODE_GAP / 2 + rowOffset
    const verticalSpace = zoneHeight - ZONE_PADDING * 2
    const y =
      zoneY +
      ZONE_PADDING +
      (rows === 1
        ? verticalSpace / 2 // Center vertically for single row
        : (row * verticalSpace) / (rows - 1))

    return { x, y }
  }, [])

  useEffect(() => {
    if (!svgRef.current || !data?.[0]?.mac_data) return

    const width = ZONE_WIDTH
    const nodesByZone = new Map(ZONE_DEFINITIONS.map((zone) => [zone.level, []]))

    // Process nodes
    const nodes = []
    const links = []
    const nodeMap = new Map()

    data[0].mac_data.forEach((category) => {
      Object.values(category).forEach((devices) => {
        devices.forEach((device) => {
          const normalizedDevice = {
            MAC: device.MAC || "Unknown",
            IP: Array.isArray(device.IP) ? device.IP : [device.IP || "Unknown"],
            Protocol: Array.isArray(device.Protocol) ? device.Protocol : [device.Protocol || "Unknown"],
            Type: device.Type || "Unknown",
            Vendor: device.Vendor || "Unknown Vendor",
            status: device.status || "unknown",
            connections: device[device.MAC] || [],
          }

          const zone = classifyDevice(normalizedDevice)
          const node = {
            ...normalizedDevice,
            id: normalizedDevice.MAC,
            zone,
          }
          nodes.push(node)
          nodeMap.set(normalizedDevice.MAC, node)
          nodesByZone.get(zone.level).push(node)
        })
      })
    })

    // Calculate zone heights based on the number of nodes
    const zoneHeights = ZONE_DEFINITIONS.map((zone) => {
      const nodesInZone = nodesByZone.get(zone.level).length
      const rows = Math.ceil(nodesInZone / NODES_PER_LINE)
      return Math.max(rows * NODE_GAP + ZONE_PADDING * 2, 220)
    })

    const totalHeight = zoneHeights.reduce((sum, height) => sum + height, 0) + LEVEL_GAP * (ZONE_DEFINITIONS.length - 1)

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", totalHeight)
      .style("background-color", "white")

    svg.selectAll("*").remove()

    // Create tooltip
    const tooltip = d3
      .select(tooltipRef.current)
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "white")
      .style("border", "1px solid #ddd")
      .style("padding", "10px")
      .style("border-radius", "5px")
      .style("z-index", "10")

    // Update: Initialize linkTooltip with blinking effect
    const linkTooltip = d3
      .select(linkTooltipRef.current)
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "white")
      .style("border", "1px solid #ddd")
      .style("border-radius", "5px")
      .style("padding", "10px")
      .style("z-index", "10")
      .style("pointer-events", "none")
      .classed("blinking", true)

    // Create zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform)
      })

    svg.call(zoom)

    const container = svg.append("g")

    // Set initial zoom to fit the entire graph
    const initialScale = Math.min(svg.attr("width") / width, svg.attr("height") / totalHeight) * 0.9
    const initialTransform = d3.zoomIdentity
      .translate((svg.attr("width") - width * initialScale) / 2, (svg.attr("height") - totalHeight * initialScale) / 2)
      .scale(initialScale)
    svg.call(zoom.transform, initialTransform)

    // Draw zones
    let currentY = 0
    ZONE_DEFINITIONS.forEach((zone, index) => {
      const zoneHeight = zoneHeights[index]
      const gradientId = `zone-gradient-${zone.level}`
      const gradient = container
        .append("defs")
        .append("linearGradient")
        .attr("id", gradientId)
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%")

      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", zone.level === 1 ? "#10b98114" : zone.level === 2 ? "#f59f0b18" : "#3b83f614")

      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", zone.level === 1 ? "#10b98114" : zone.level === 2 ? "#f59f0b18" : "#3b83f614")

      container
        .append("rect")
        .attr("x", ZONE_PADDING)
        .attr("y", currentY)
        .attr("width", width - ZONE_PADDING * 2)
        .attr("height", zoneHeight)
        .attr("fill", `url(#${gradientId})`)
        .attr("rx", 16)
        .attr("filter", "drop-shadow(0 4px 6px rgb(0 0 0 / 0.05))")
        .attr("stroke", zone.level === 1 ? "#10b98114" : zone.level === 2 ? "#f59f0b18" : "#3b83f614")
        .attr("stroke-width", 2)

      container
        .append("text")
        .attr("x", ZONE_PADDING + 20)
        .attr("y", currentY + 30)
        .style("font-size", "16px")
        .style("font-weight", "600")
        .attr("fill", "#1a2b4b")
        .text(zone.name)

      // Position nodes within the zone
      const zoneNodes = nodesByZone.get(zone.level)
      zoneNodes.forEach((node, nodeIndex) => {
        const position = calculatePosition(nodeIndex, currentY, zoneNodes.length, zoneHeight)
        node.fx = position.x
        node.fy = position.y
      })

      currentY += zoneHeight + LEVEL_GAP
    })

    // Create connections
    nodes.forEach((node) => {
      node.connections.forEach((targetMac) => {
        if (nodeMap.has(targetMac)) {
          links.push({
            source: node.id,
            target: targetMac,
            protocol: node.Protocol,
          })
        }
      })
    })

    // Update: Draw connections using paths instead of lines
    const link = container
      .append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", "connection-path")
      .attr("stroke", "#64748bab")
      .attr("stroke-width", 1)
      .attr("fill", "none")
      .style("pointer-events", "visibleStroke")
      .on("mouseover", (event, d) => {
        const sourceNode = nodeMap.get(d.source)
        const targetNode = nodeMap.get(d.target)
        linkTooltip
          .style("visibility", "visible")
          .html(`
        <div class="space-y-2">
          <div class="font-semibold">Connection Details</div>
          <div class="text-slate-600">From: ${sourceNode?.Vendor || "Unknown"} (${d.source})</div>
          <div class="text-slate-600">To: ${targetNode?.Vendor || "Unknown"} (${d.target})</div>
          ${
            d.protocol
              ? `<div class="mt-2 pt-2 border-t border-slate-200">
                  <div class="text-slate-600">Protocol: ${Array.isArray(d.protocol) ? d.protocol.join(", ") : d.protocol}</div>
                 </div>`
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
        linkTooltip.style("visibility", "hidden")
      })

    // Create node groups
    const nodeGroup = container
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .on("click", (e, d) => {
        setSelectedNode(d)
        setShowDialog(true)
      })
      .on("mouseover", (event, d) => {
        tooltip
          .style("visibility", "visible")
          .html(`
            <div class="space-y-2">
              <div class="font-semibold">${d.Vendor}</div>
              <div class="text-slate-600">MAC: ${d.MAC}</div>
              <div class="text-slate-600">IP: ${Array.isArray(d.IP) ? d.IP.join(", ") : d.IP}</div>
              <div class="text-slate-600">Type: ${d.Type}</div>
              <div class="flex items-center gap-2">
                <span class="text-slate-600">Status:</span>
                <span class="${d.status === "true" ? "text-emerald-600" : "text-red-600"}">
                  ${d.status === "true" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          `)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 10}px`)
      })
      .on("mousemove", (event) => {
        tooltip.style("left", `${event.pageX + 10}px`).style("top", `${event.pageY - 10}px`)
      })
      .on("mouseout", () => {
        tooltip.style("visibility", "hidden")
      })

    // Add device icons
    nodeGroup.each(function (d) {
      const Icon = getIconForDevice(d)
      const iconHTML = ReactDOMServer.renderToStaticMarkup(
        <Icon
          width={ICON_SIZE}
          height={ICON_SIZE}
          className="text-slate-700 transition-colors duration-200 group-hover:text-slate-900"
          strokeWidth={1.5}
        />,
      )
      d3.select(this)
        .append("foreignObject")
        .attr("width", ICON_SIZE)
        .attr("height", ICON_SIZE)
        .attr("x", -ICON_SIZE / 2)
        .attr("y", -ICON_SIZE / 2)
        .html(iconHTML)
    })

    // Add vendor labels
    nodeGroup
      .append("text")
      .text((d) => d.Vendor)
      .attr("text-anchor", "middle")
      .attr("y", ICON_SIZE / 2 + 20)
      .style("font-size", "11px")
      .style("font-weight", "500")
      .attr("fill", "#1e293b")
      .style("pointer-events", "none")
      .call(wrap, NODE_GAP - 20)

    // Add status indicators
    nodeGroup
      .append("circle")
      .attr("r", 5)
      .attr("cx", ICON_SIZE / 2 - 6)
      .attr("cy", -ICON_SIZE / 2 + 6)
      .attr("fill", (d) => (d.status === "true" ? "#22c55e" : "#ef4444"))
      .attr("filter", "drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))")

    // Simple force simulation for connections
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3.forceLink(links).id((d) => d.id),
      )
      .force("charge", d3.forceManyBody().strength(-50))
      .force("collision", d3.forceCollide(ICON_SIZE))

    // Update: Simulation tick function for line positioning
    simulation.on("tick", () => {
      nodeGroup.attr("transform", (d) => `translate(${d.fx},${d.fy})`)

      link.attr("d", (d) => {
        const sourceX = d.source.fx
        const sourceY = d.source.fy
        const targetX = d.target.fx
        const targetY = d.target.fy
        const midX = (sourceX + targetX) / 2
        const midY = (sourceY + targetY) / 2

        return `M ${sourceX},${sourceY}
            Q ${midX},${midY} ${targetX},${targetY}`
      })
    })

    function wrap(text, width) {
      text.each(function () {
        const text = d3.select(this)
        const words = text.text().split(/\s+/).reverse()
        let word
        let line = []
        let lineNumber = 0
        const lineHeight = 1.1
        const y = text.attr("y")
        const dy = Number.parseFloat(text.attr("dy") || 0)
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
      })
    }

    return () => {
      simulation.stop()
      linkTooltip.remove()
    }
  }, [data, classifyDevice, getIconForDevice, calculatePosition])

  const handleZoom = (delta) => {
    const svg = d3.select(svgRef.current)
    const zoom = d3.zoom()
    svg.transition().duration(300).call(zoom.scaleBy, delta)
  }

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-50 to-white">
      <div className="overflow-auto w-full h-full">
        <svg ref={svgRef} className="w-full h-full" />
        <div ref={tooltipRef} />
        <div ref={linkTooltipRef} />
      </div>

      <div className="absolute bottom-4 right-4 flex space-x-2">
        <button
          onClick={() => handleZoom(1.2)}
          className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition-colors"
        >
          <ZoomIn size={24} />
        </button>
        <button
          onClick={() => handleZoom(0.8)}
          className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition-colors"
        >
          <ZoomOut size={24} />
        </button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-white/95 backdrop-blur-sm max-w-md border-0 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-slate-800">
              {selectedNode?.Vendor || "Unknown Device"}
            </DialogTitle>
          </DialogHeader>

          {selectedNode && (
            <div className="grid gap-6 text-slate-700">
              <div className="grid gap-4">
                <div className="font-semibold text-lg border-b pb-2 text-slate-900">Device Details</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <DetailItem label="MAC" value={selectedNode.MAC} />
                  <DetailItem label="IP" value={selectedNode.IP.join(", ")} />
                  <DetailItem label="Type" value={selectedNode.Type} />
                  <DetailItem label="Zone" value={selectedNode.zone?.name} />
                  <DetailItem
                    label="Status"
                    value={selectedNode.status === "true" ? "Active" : "Inactive"}
                    valueClass={cn("font-medium", selectedNode.status === "true" ? "text-emerald-600" : "text-red-600")}
                  />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="font-semibold text-lg border-b pb-2 text-slate-900">Protocols</div>
                <div className="flex flex-wrap gap-2">
                  {selectedNode.Protocol.map((p, i) => (
                    <span key={i} className="px-3 py-1.5 text-xs rounded-full bg-slate-100 text-slate-700 font-medium">
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="font-semibold text-lg border-b pb-2 text-slate-900">Connected Devices</div>
                <div className="max-h-48 overflow-y-auto">
                  {selectedNode.connections.map((connectedMAC, index) => {
                    const connectedDevice = data[0].mac_data
                      .flatMap((category) => Object.values(category).flat())
                      .find((device) => device.MAC === connectedMAC)
                    return (
                      <div key={index} className="mb-2 p-2 bg-slate-50 rounded-md">
                        <p className="font-medium">{connectedDevice?.Vendor || "Unknown Device"}</p>
                        <p className="text-xs text-slate-500">MAC: {connectedMAC}</p>
                        <p className="text-xs text-slate-500">Type: {connectedDevice?.Type || "Unknown"}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const DetailItem = ({ label, value, valueClass = "" }) => (
  <>
    <div className="font-medium text-slate-500">{label}</div>
    <div className={cn("font-mono tracking-tight", valueClass)}>{value || "Unknown"}</div>
  </>
)

export default PurdueGraph

