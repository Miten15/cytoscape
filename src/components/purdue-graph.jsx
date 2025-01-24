"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import PropTypes from "prop-types"
import * as d3 from "d3"
import { CircuitBoard, Laptop, Router, Server, Wifi, Monitor, Database, Cpu, Terminal, Radio, Gauge, Power } from "lucide-react"
import ReactDOMServer from "react-dom/server"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

// Constants
const ICON_SIZE = 26
const ZONE_PADDING = 40
const LABEL_PADDING = 20
const ZONE_HEIGHT = 150
const LEVEL_GAP = 80

// Protocol to Purdue level mapping
const PROTOCOL_ZONE_MAPPING = {
  Modbus: { level: 0 },
  DNP3: { level: 0 },
  BACnet: { level: 1 },
  "OPC UA": { level: 2 },
  SCADA: { level: 2 },
  HTTP: { level: 4 },
  HTTPS: { level: 4 },
}

// Purdue zones definition
const ZONE_DEFINITIONS = [
  { name: "Enterprise", level: 4, y: 0, color: "#4287f553", devices: ["Servers", "Workstations"] },
  { name: "DMZ", level: 3, y: ZONE_HEIGHT + LEVEL_GAP, color: "#f5424253", devices: ["Firewalls", "Proxies"] },
  { name: "Operations", level: 2, y: (ZONE_HEIGHT + LEVEL_GAP) * 2, color: "#42f54e4b", devices: ["HMIs", "SCADA"] },
  { name: "Control", level: 1, y: (ZONE_HEIGHT + LEVEL_GAP) * 3, color: "#4287f553", devices: ["PLCs", "RTUs"] },
  { name: "Process", level: 0, y: (ZONE_HEIGHT + LEVEL_GAP) * 4, color: "#f5424253", devices: ["Sensors", "Actuators"] },
]

const PurdueGraph = ({ data, mode }) => {
  const svgRef = useRef(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [showDialog, setShowDialog] = useState(false)
  const { toast } = useToast()

  const determineNetworkDevicePosition = useCallback((device, connectedDevices) => {
    const zones = connectedDevices
      .filter(d => d.zone)
      .map(d => ZONE_DEFINITIONS.find(z => z.level === d.zone.level))
    
    if (zones.length === 0) return ZONE_DEFINITIONS[0].y + ZONE_HEIGHT/2

    const levels = zones.map(z => z.level)
    const minLevel = Math.min(...levels)
    const maxLevel = Math.max(...levels)
    
    const minZone = ZONE_DEFINITIONS.find(z => z.level === minLevel)
    const maxZone = ZONE_DEFINITIONS.find(z => z.level === maxLevel)
    
    return minZone.y + ((maxZone.y - minZone.y) / 2)
  }, [])

  const classifyDevice = useCallback((device, connectedDevices = []) => {
    const classification = { type: "Unknown", isNetworkDevice: false, targetY: 0 }

    // Network device detection
    if (device.Vendor?.includes("Cisco") || device.type === "Network") {
      classification.type = "Network"
      classification.isNetworkDevice = true
      classification.targetY = determineNetworkDevicePosition(device, connectedDevices)
      return classification
    }

    // Protocol-based classification
    const protocols = Array.isArray(device.Protocol) ? device.Protocol : [device.Protocol]
    const protocolLevels = protocols.map(p => PROTOCOL_ZONE_MAPPING[p]?.level).filter(l => l !== undefined)
    
    if (protocolLevels.length > 0) {
      const avgLevel = Math.round(protocolLevels.reduce((a, b) => a + b, 0) / protocolLevels.length)
      classification.type = avgLevel <= 2 ? "OT" : "IT"
      classification.zone = ZONE_DEFINITIONS.find(z => z.level === avgLevel)
      return classification
    }

    // Fallback to IP-based classification
    const ip = Array.isArray(device.IP) ? device.IP[0] : device.IP
    if (ip?.startsWith("192.168") || ip?.startsWith("10.")) classification.type = "IT"
    if (ip?.startsWith("172.16")) classification.type = "OT"

    return classification
  }, [determineNetworkDevicePosition])

  const getIconForDevice = useCallback((device) => {
    if (device.isNetworkDevice) return Router
    if (device.Protocol?.includes("Modbus")) return Cpu
    if (device.Vendor?.includes("PLC")) return Terminal
    if (device.Vendor?.includes("RTU")) return Radio
    if (device.type === "Sensor") return Gauge
    if (device.type === "Actuator") return Power
    return device.type === "IT" ? Laptop : Server
  }, [])

  useEffect(() => {
    if (!svgRef.current || !data?.[0]?.mac_data) return

    const width = window.innerWidth
    const height = (ZONE_HEIGHT + LEVEL_GAP) * ZONE_DEFINITIONS.length
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("background-color", "#1a1a1a")

    svg.selectAll("*").remove()
    const container = svg.append("g")

    // Draw zones
    container.selectAll(".zone")
      .data(ZONE_DEFINITIONS)
      .join("rect")
      .attr("class", "zone")
      .attr("x", ZONE_PADDING)
      .attr("y", d => d.y)
      .attr("width", width - ZONE_PADDING * 2)
      .attr("height", ZONE_HEIGHT)
      .attr("fill", d => d.color)
      .attr("stroke", d => d.color)

    // Draw switch layers
    container.selectAll(".switch-layer")
      .data(ZONE_DEFINITIONS.slice(0, -1))
      .join("line")
      .attr("class", "switch-layer")
      .attr("x1", ZONE_PADDING)
      .attr("x2", width - ZONE_PADDING)
      .attr("y1", d => d.y + ZONE_HEIGHT + LEVEL_GAP/2)
      .attr("y2", d => d.y + ZONE_HEIGHT + LEVEL_GAP/2)
      .attr("stroke", "#666")
      .attr("stroke-dasharray", "5,5")

    // Process nodes and links
    const nodes = []
    const links = []
    const nodeMap = new Map()

    data[0].mac_data.forEach(category => {
      Object.values(category).forEach(devices => {
        devices.forEach(device => {
          const node = {
            id: device.MAC,
            ...device,
            IP: Array.isArray(device.IP) ? device.IP : [device.IP],
            Protocol: Array.isArray(device.Protocol) ? device.Protocol : [device.Protocol],
            connections: device[device.MAC] || [],
          }
          nodes.push(node)
          nodeMap.set(device.MAC, node)
        })
      })
    })

    nodes.forEach(node => {
      const connectedDevices = node.connections
        .map(mac => nodeMap.get(mac))
        .filter(d => d)
      Object.assign(node, classifyDevice(node, connectedDevices))
    })

    nodes.forEach(node => {
      node.connections.forEach(targetMac => {
        if (nodeMap.has(targetMac)) {
          links.push({
            source: node.id,
            target: targetMac,
            protocol: node.Protocol
          })
        }
      })
    })

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-800))
      .force("collision", d3.forceCollide(ICON_SIZE * 1.5))
      .force("x", d3.forceX(width/2).strength(0.1))
      .force("y", d3.forceY(d => {
        if (d.isNetworkDevice) return d.targetY
        return d.zone?.y ? d.zone.y + ZONE_HEIGHT/2 : height/2
      }).strength(0.7))

    // Draw links
    const link = container.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", "connection-line")
      .attr("stroke", "#666")
      .attr("fill", "none")

    // Draw nodes
    const nodeGroup = container.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("transform", d => `translate(${d.x || width/2},${d.y || height/2})`)
      .attr("cursor", "pointer")
      .on("click", (e, d) => {
        setSelectedNode(d)
        setShowDialog(true)
      })

    // Add icons
    nodeGroup.each(function(d) {
      const Icon = getIconForDevice(d)
      const iconHTML = ReactDOMServer.renderToStaticMarkup(
        <Icon width={ICON_SIZE} height={ICON_SIZE} stroke="white" strokeWidth={1.5} />
      )
      d3.select(this)
        .append("foreignObject")
        .attr("width", ICON_SIZE)
        .attr("height", ICON_SIZE)
        .attr("x", -ICON_SIZE/2)
        .attr("y", -ICON_SIZE/2)
        .html(iconHTML)
    })

    // Add status indicators
    nodeGroup.append("circle")
      .attr("r", 4)
      .attr("cx", ICON_SIZE/2 - 4)
      .attr("cy", ICON_SIZE/2 + 4)
      .attr("fill", d => d.status === "true" ? "#00ff00" : "#ff0000")
      .style("opacity", 0.8)

    // Simulation update handler
    simulation.on("tick", () => {
      nodeGroup.attr("transform", d => `translate(${Math.max(ZONE_PADDING, Math.min(width - ZONE_PADDING, d.x))},${d.y})`)
      
      link.attr("d", d => {
        const dx = d.target.x - d.source.x
        const dy = d.target.y - d.source.y
        const dr = Math.sqrt(dx*dx + dy*dy) * 0.8
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`
      })
    })

    return () => simulation.stop()
  }, [data, classifyDevice, getIconForDevice])

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
      
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNode?.Vendor}</DialogTitle>
          </DialogHeader>
          {selectedNode && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="font-medium">Device Details</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>MAC:</div><div>{selectedNode.MAC}</div>
                  <div>IP:</div><div>{selectedNode.IP.join(", ")}</div>
                  <div>Type:</div><div>{selectedNode.type}</div>
                  <div>Status:</div>
                  <div className={selectedNode.status === "true" ? "text-green-500" : "text-red-500"}>
                    {selectedNode.status === "true" ? "Active" : "Inactive"}
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="font-medium">Protocols</div>
                <div className="flex flex-wrap gap-2">
                  {selectedNode.Protocol.map((p, i) => (
                    <span key={i} className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-800">
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

PurdueGraph.propTypes = {
  data: PropTypes.array.isRequired,
  mode: PropTypes.oneOf(["normal", "purdue"]).isRequired,
}

export default PurdueGraph