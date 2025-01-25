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
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ICON_SIZE = 40
const ZONE_PADDING = 60
const ZONE_WIDTH = 1600
const ZONE_HEIGHT = 220
const LEVEL_GAP = 40
const NODES_PER_LINE = 12
const NODE_GAP = 120

const ZONE_DEFINITIONS = [
  {
    name: "OT Devices (Level 1)",
    level: 1,
    y: ZONE_HEIGHT * 2 + LEVEL_GAP * 2,
    color: "from-emerald-50 to-emerald-100/80",
    borderColor: "border-emerald-200",
    height: ZONE_HEIGHT * 1.5, // Increased height for OT zone
  },
  {
    name: "Network Devices (Level 2)",
    level: 2,
    y: ZONE_HEIGHT + LEVEL_GAP,
    color: "from-amber-50 to-amber-100/80",
    borderColor: "border-amber-200",
    height: ZONE_HEIGHT,
  },
  {
    name: "IT Devices (Level 3)",
    level: 3,
    y: 0,
    color: "from-blue-50 to-blue-100/80",
    borderColor: "border-blue-200",
    height: ZONE_HEIGHT,
  },
]

export default function PurdueGraph({ data, mode }) {
  const svgRef = useRef(null)
  const tooltipRef = useRef(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [showDialog, setShowDialog] = useState(false)

  const classifyDevice = useCallback((device) => {
    const ips = Array.isArray(device.IP) ? device.IP : [device.IP || ""]

    if (device.Vendor?.includes("Cisco") || device.Type === "Network") {
      return ZONE_DEFINITIONS.find((z) => z.level === 2)
    }

    if (
      ips.some((ip) => ip?.startsWith("172.")) ||
      ["PLC", "RTU", "Sensor", "Actuator"].some((type) => device.Type?.includes(type))
    ) {
      return ZONE_DEFINITIONS.find((z) => z.level === 1)
    }

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

  const calculatePosition = useCallback((index, zoneY, totalNodes) => {
    const rows = Math.ceil(totalNodes / NODES_PER_LINE)
    const lastRowNodes = totalNodes % NODES_PER_LINE || NODES_PER_LINE
    const isLastRow = Math.floor(index / NODES_PER_LINE) === rows - 1
    const nodesInThisRow = isLastRow ? lastRowNodes : NODES_PER_LINE

    const row = Math.floor(index / NODES_PER_LINE)
    const col = index % NODES_PER_LINE

    // Calculate offset to center nodes in the row
    const rowOffset = ((NODES_PER_LINE - nodesInThisRow) * NODE_GAP) / 2

    const x = ZONE_PADDING + col * NODE_GAP + NODE_GAP / 2 + rowOffset
    const y = zoneY + ZONE_PADDING + row * NODE_GAP + NODE_GAP / 2
    return { x, y }
  }, [])

  useEffect(() => {
    if (!svgRef.current || !data?.[0]?.mac_data) return

    const width = ZONE_WIDTH
    const height = ZONE_HEIGHT * 3 + LEVEL_GAP * 2

    const svg = d3.select(svgRef.current).attr("width", width).attr("height", height).style("background-color", "white")

    svg.selectAll("*").remove()

    // Create tooltip
    const tooltip = d3
      .select(tooltipRef.current)
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background-color", "rgba(255, 255, 255, 0.95)")
      .style("border", "1px solid #e2e8f0")
      .style("border-radius", "8px")
      .style("padding", "12px")
      .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1)")
      .style("font-size", "12px")
      .style("z-index", "50")

    // Create zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 2])
      .on("zoom", (event) => {
        container.attr("transform", event.transform)
      })

    svg.call(zoom)

    const container = svg.append("g")

    // Draw zones
    ZONE_DEFINITIONS.forEach((zone) => {
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
        .attr("stop-color", zone.level === 1 ? "#10B98160" : zone.level === 2 ? "#F59E0B60" : "#3B82F630")

      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", zone.level === 1 ? "#10B98130" : zone.level === 2 ? "#F59E0B30" : "#3B82F630")

      container
        .append("rect")
        .attr("x", ZONE_PADDING)
        .attr("y", zone.y)
        .attr("width", width - ZONE_PADDING * 2)
        .attr("height", zone.height || ZONE_HEIGHT) // Use custom height if specified
        .attr("fill", `url(#${gradientId})`)
        .attr("rx", 16)
        .attr("filter", "drop-shadow(0 4px 6px rgb(0 0 0 / 0.05))")
        .attr("stroke", zone.level === 1 ? "#10B98140" : zone.level === 2 ? "#F59E0B40" : "#3B82F640")
        .attr("stroke-width", 2)

      container
        .append("text")
        .attr("x", ZONE_PADDING + 20)
        .attr("y", zone.y + 30)
        .style("font-size", "16px")
        .style("font-weight", "600")
        .attr("fill", "#1a2b4b")
        .text(zone.name)
    })

    // Process nodes
    const nodes = []
    const links = []
    const nodeMap = new Map()
    const nodesByZone = new Map(ZONE_DEFINITIONS.map((zone) => [zone.level, []]))

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

    // Position nodes
    nodesByZone.forEach((zoneNodes, level) => {
      const zone = ZONE_DEFINITIONS.find((z) => z.level === level)

      zoneNodes.forEach((node, index) => {
        const position = calculatePosition(index, zone.y, zoneNodes.length)
        node.fx = position.x
        node.fy = position.y
      })
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

    // Draw connections
    const link = container
      .append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", "connection-line")
      .attr("stroke", "#64748b30")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,4")
      .attr("fill", "none")

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

    simulation.on("tick", () => {
      nodeGroup.attr("transform", (d) => `translate(${d.fx},${d.fy})`)

      link.attr("d", (d) => {
        const dx = d.target.fx - d.source.fx
        const dy = d.target.fy - d.source.fy
        const dr = Math.sqrt(dx * dx + dy * dy) * 2
        return `M${d.source.fx},${d.source.fy}A${dr},${dr} 0 0,1 ${d.target.fx},${d.target.fy}`
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

    return () => simulation.stop()
  }, [data, classifyDevice, getIconForDevice, calculatePosition])

  const handleZoom = (delta) => {
    const svg = d3.select(svgRef.current)
    const zoom = d3.zoom()
    svg.transition().duration(300).call(zoom.scaleBy, delta)
  }

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-slate-50 to-white">
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <Button variant="outline" size="icon" onClick={() => handleZoom(1.2)} className="bg-white/80 backdrop-blur-sm">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => handleZoom(0.8)} className="bg-white/80 backdrop-blur-sm">
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>

      <div className="overflow-auto w-full h-full">
        <svg ref={svgRef} className="w-full h-full" />
        <div ref={tooltipRef} />
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

