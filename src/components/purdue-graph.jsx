"use client"
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react"
import * as d3 from "d3"
import { Server, Router, Cpu, Terminal, Camera, Gauge } from "lucide-react"
import ReactDOMServer from "react-dom/server"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

const PurdueHierarchy = ({ data }) => {
  const svgRef = useRef(null)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const { toast } = useToast()

  // Memoize LEVELS to prevent unnecessary recreations
  const LEVELS = useMemo(() => [
    { name: "Level 3", y: 50, devices: ["OT", "Endpoint", "Camera", "Streamer"] },
    { name: "Level 2", y: 250, devices: ["SCADA Server", "HMI", "Engineering Station"] },
    { name: "Level 1", y: 450, devices: ["PLC"] }
  ], [])

  const processDeviceData = useCallback((rawData) => {
    try {
      if (!rawData?.[0]?.mac_data) {
        throw new Error("Invalid data structure")
      }

      const nodes = []
      const nodeMap = new Map()

      rawData[0].mac_data.forEach(category => {
        Object.values(category).forEach(devices => {
          devices.forEach(device => {
            const node = {
              id: device.MAC,
              mac: device.MAC,
              ip: device.IP,
              vendor: device.Vendor,
              protocols: device.Protocol,
              status: device.status,
              type: device.Type,
              connections: device[device.MAC] || []
            }
            nodes.push(node)
            nodeMap.set(device.MAC, node)
          })
        })
      })

      return { nodes, nodeMap }
    } catch (error) {
      console.error("Data processing error:", error)
      toast({
        title: "Data Error",
        description: "Failed to process network data",
        variant: "destructive"
      })
      return { nodes: [], nodeMap: new Map() }
    }
  }, [toast])

  const renderConnections = useCallback((svg, nodes, nodeMap) => {
    const connections = []
    
    nodes.forEach(node => {
      node.connections.forEach(targetMac => {
        if (nodeMap.has(targetMac)) {
          connections.push({
            source: node,
            target: nodeMap.get(targetMac)
          })
        }
      })
    })

    svg.selectAll(".connection")
      .data(connections)
      .join("line")
      .attr("class", "connection")
      .attr("stroke", "#ced4da")
      .attr("stroke-width", 1.5)
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y)
  }, [])

  const renderDevices = useCallback((svg, processedData) => {
    const { nodes } = processedData

    nodes.forEach(node => {
      const level = LEVELS.find(l => l.devices.includes(node.type))
      if (!level) return

      const deviceGroup = svg.append("g")
        .attr("transform", `translate(${node.x},${node.y})`)
        .attr("class", "device-group")
        .on("click", () => setSelectedDevice(node))

      // Device card
      deviceGroup.append("rect")
        .attr("width", 180)
        .attr("height", 80)
        .attr("fill", "#fff")
        .attr("stroke", "#dee2e6")
        .attr("rx", 6)

      // Device icon
      const iconMap = {
        PLC: Cpu,
        "SCADA Server": Server,
        HMI: Terminal,
        Router: Router,
        Camera: Camera
      }
      
      const Icon = iconMap[node.type] || Gauge
      deviceGroup.append("foreignObject")
        .attr("x", 20)
        .attr("y", 15)
        .attr("width", 40)
        .attr("height", 40)
        .html(ReactDOMServer.renderToStaticMarkup(<Icon size={40} className="text-primary" />))

      // Device info
      deviceGroup.append("text")
        .attr("x", 70)
        .attr("y", 30)
        .text(node.vendor)
      
      deviceGroup.append("text")
        .attr("x", 70)
        .attr("y", 50)
        .text(node.ip)
    })
  }, [LEVELS])

  useEffect(() => {
    if (!svgRef.current || !data) return

    const width = 1200
    const height = 600
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("background", "#f8f9fa")

    // Clear previous elements
    svg.selectAll("*").remove()

    try {
      // Process data and create hierarchy
      const processedData = processDeviceData(data)
      
      // Create force simulation
      const simulation = d3.forceSimulation(processedData.nodes)
        .force("charge", d3.forceManyBody().strength(-50))
        .force("x", d3.forceX(width/2).strength(0.1))
        .force("y", d3.forceY(d => LEVELS.find(l => l.devices.includes(d.type))?.y || height/2).strength(0.5))
        .force("collision", d3.forceCollide(60))

      // Create zones
      LEVELS.forEach(level => {
        svg.append("rect")
          .attr("x", 50)
          .attr("y", level.y)
          .attr("width", width - 100)
          .attr("height", 150)
          .attr("fill", "#fff")
          .attr("stroke", "#adb5bd")
          .attr("rx", 8)

        svg.append("text")
          .attr("x", 70)
          .attr("y", level.y + 30)
          .attr("font-size", "16px")
          .attr("font-weight", "600")
          .text(level.name)
      })

      // Render elements
      simulation.on("tick", () => {
        renderConnections(svg, processedData.nodes, processedData.nodeMap)
        renderDevices(svg, processedData)
      })

      return () => simulation.stop()
    } catch (error) {
      console.error("Rendering error:", error)
      toast({
        title: "Rendering Error",
        description: "Failed to visualize network",
        variant: "destructive"
      })
    }
  }, [data, LEVELS, processDeviceData, renderConnections, renderDevices, toast])

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <svg ref={svgRef} className="w-full" />
      
      <Dialog open={!!selectedDevice} onOpenChange={() => setSelectedDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDevice?.vendor}</DialogTitle>
          </DialogHeader>
          {selectedDevice && (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>MAC:</div>
                <div className="font-mono">{selectedDevice.mac}</div>
                <div>IP:</div>
                <div>{selectedDevice.ip}</div>
                <div>Type:</div>
                <div>{selectedDevice.type}</div>
                <div>Status:</div>
                <div className={selectedDevice.status === "true" ? "text-green-500" : "text-red-500"}>
                  {selectedDevice.status === "true" ? "Active" : "Inactive"}
                </div>
              </div>
              <div className="mt-2">
                <h3 className="font-semibold mb-1">Protocols</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedDevice.protocols?.map((protocol, i) => (
                    <span key={i} className="px-2 py-1 text-xs rounded-full bg-gray-100">
                      {protocol}
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

export default PurdueHierarchy