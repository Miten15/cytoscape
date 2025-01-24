"use client"

import { useState } from "react"
import PurdueGraph from "@/components/purdue-graph"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function PurduePage() {
  const [mode, setMode] = useState<"normal" | "purdue">("normal")

  // Sample data - replace with your actual data structure
  const sampleData = [
    { id: 1, name: "Node 1", zone: "Enterprise" },
    { id: 2, name: "Node 2", zone: "DMZ" },
    { id: 3, name: "Node 3", zone: "Manufacturing" },
    // Add more nodes as needed
  ]

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Network Visualization</h1>
        <div className="flex items-center gap-4">
          <Select value={mode} onValueChange={(value: "normal" | "purdue") => setMode(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select visualization mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal View</SelectItem>
              <SelectItem value="purdue">Purdue Model</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <PurdueGraph data={sampleData} mode={mode} />
    </div>
  )
}

