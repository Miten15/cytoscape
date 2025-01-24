"use client"

import React, { useState, useEffect } from "react"
import PurdueGraph from "@/components/purdue-graph"
import GraphComponent from "@/components/GraphComponent"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Navbar from "@/components/ui/navbar"

const GraphPage = () => {
  const [data, setData] = useState(null)
  const [mode, setMode] = useState("normal")

  useEffect(() => {
    const savedData = localStorage.getItem("networkData")
    if (savedData) {
      setData(JSON.parse(savedData))
    }
  }, [])

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">No Data Available</h1>
            <p className="text-gray-600">Please upload a network data file first.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="absolute top-16 right-4 z-10">
        <Select value={mode} onValueChange={(value) => setMode(value)}>
          <SelectTrigger className="w-[180px] bg-gray-100">
            <SelectValue placeholder="Select view mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem className="bg-gray-100" value="normal">Normal View</SelectItem>
            <SelectItem className="bg-gray-100" value="purdue">Purdue Model</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === "normal" ? <GraphComponent data={data} /> : <PurdueGraph data={data} mode={mode} />}
    </div>
  )
}

export default GraphPage

