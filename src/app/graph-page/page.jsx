"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import GraphComponent from "../../components/GraphComponent"

export default function GraphPage() {
  const router = useRouter()
  const [data, setData] = useState(null)

  useEffect(() => {
    try {
      const storedData = localStorage.getItem("networkData")
      if (storedData) {
        setData(JSON.parse(storedData))
      } else {
        router.push("/")
      }
    } catch (error) {
      console.error("Error loading data:", error)
      router.push("/")
    }
  }, [router])

  if (!data) return <div>Loading...</div>

  return (
    <div className="w-full h-screen absolute top-0 left-0">
      <GraphComponent data={data} />
    </div>
  )
}

