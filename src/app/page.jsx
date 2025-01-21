"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BackgroundLines } from "@/components/ui/background-lines"
import { FileUpload } from "@/components/ui/file-upload"

export default function Page() {
  const router = useRouter()
  const [networkData, setNetworkData] = useState(null)

  const handleFileUpload = async (data) => {
    if (data) {
      // Store data in localStorage instead of URL params
      localStorage.setItem("networkData", JSON.stringify(data))
      router.push("/graph-page")
    }
  }

  return (
    <div className="min-h-screen">
      <BackgroundLines className="flex items-center justify-center w-full flex-col px-4">
        <h2 className="bg-clip-text text-transparent text-center bg-gradient-to-b from-neutral-900 to-neutral-700 dark:from-neutral-600 dark:to-white text-2xl md:text-4xl lg:text-7xl font-sans py-2 md:py-10 relative z-20 font-bold tracking-tight">
          Network Graph Uploader
        </h2>
        <FileUpload onChange={handleFileUpload} />

        <div className="py-10 w-full text-center">
          <p className="max-width-xl mx-auto text-sm md:text-lg text-neutral-700 dark:text-neutral-400">
            Please upload a valid JSON file to display the graph.
          </p>
        </div>
      </BackgroundLines>
    </div>
  )
}

