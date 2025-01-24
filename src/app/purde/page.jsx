"use client";

import { useState } from "react";
import PurdueGraph from "@/components/purdue-graph";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PurduePage() {
  const [mode, setMode] = useState("normal"); // Removed TypeScript type annotation

  // Sample data 
  const sampleData = [
    { name: "Enterprise", level: 4, y: 0, color: "#4287f553", devices: ["Servers", "Workstations"] },
    { name: "DMZ", level: 3, y: ZONE_HEIGHT + LEVEL_GAP, color: "#f5424253", devices: ["Firewalls", "Proxies"] },
    { name: "Operations", level: 2, y: (ZONE_HEIGHT + LEVEL_GAP) * 2, color: "#42f54e4b", devices: ["HMIs", "SCADA"] },
    { name: "Control", level: 1, y: (ZONE_HEIGHT + LEVEL_GAP) * 3, color: "#4287f553", devices: ["PLCs", "RTUs"] },
    { name: "Process", level: 0, y: (ZONE_HEIGHT + LEVEL_GAP) * 4, color: "#f5424253", devices: ["Sensors", "Actuators"] },
  ]
  
  
  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Network Visualization</h1>
        <div className="flex items-center gap-4">
          <Select value={mode} onValueChange={(value) => setMode(value)}>
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
  );
}
