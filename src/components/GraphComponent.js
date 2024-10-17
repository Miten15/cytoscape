import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const GraphComponent = ({ macData }) => {
  const svgRef = useRef();

  useEffect(() => {
    // Check if macData is valid
    if (!macData || !macData.IT) {
      console.error("macData is undefined or does not contain 'IT'");
      return; // Exit if data is not valid
    }

    // Transform macData into nodes and edges
    const { nodes, edges } = transformMacDataToGraph(macData);

    // Set dimensions for the SVG
    const width = 800;
    const height = 600;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink().id(d => d.id))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .on("tick", ticked);

    // Add links (edges)
    const link = svg.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(edges)
      .enter().append("line")
      .attr("class", "link")
      .style("stroke", "gray")
      .style("stroke-width", 1);

    // Add nodes
    const node = svg.append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(nodes)
      .enter().append("circle")
      .attr("r", 10)
      .style("fill", "blue")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.append("title")
      .text(d => d.id);

    // Update positions on each tick of the simulation
    function ticked() {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    }

    // Define drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  }, [macData]);

  // Function to transform macData to graph format
  function transformMacDataToGraph(macData) {
    const nodes = [];
    const edges = [];

    // Check if macData has the expected structure
    if (!Array.isArray(macData.IT)) {
      console.error("macData.IT is not an array");
      return { nodes, edges };
    }

    macData.IT.forEach(device => {
      // Add each device as a node
      nodes.push({ id: device.MAC, ip: device.IP, protocols: device.Protocol });

      // Create edges based on shared Protocols
      macData.IT.forEach(otherDevice => {
        if (device.MAC !== otherDevice.MAC) {
          const sharedProtocols = device.Protocol.filter(protocol => otherDevice.Protocol.includes(protocol));

          if (sharedProtocols.length > 0) {
            edges.push({
              source: device.MAC,
              target: otherDevice.MAC,
              protocols: sharedProtocols
            });
          }
        }
      });
    });

    return { nodes, edges };
  }

  return <svg ref={svgRef}></svg>;
};

export default GraphComponent;
