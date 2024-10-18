import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const GraphComponent = ({ data }) => {
  const svgRef = useRef();

  useEffect(() => {
    // Clear previous SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    const width = 800;
    const height = 600;

    // Create the SVG container
    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("background-color", "black");

    // Extract nodes and links from your data structure
    const { nodes, links } = createD3Data(data);

    // Create the simulation with force layout
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(150).strength(1))  // Cluster-to-cluster distance control
      .force('charge', d3.forceManyBody().strength(-300))  // General node repulsion
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50).strength(0.7))
      .force('x', d3.forceX(width / 2).strength(0.05))  // Center the clusters horizontally
      .force('y', d3.forceY(height / 2).strength(0.05)); // Center the clusters vertically

    // Add links (lines)
    const link = svg.selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => d.isClusterLink ? 'white' : 'gray')  // Different color for cluster-to-cluster links
      .attr("stroke-width", 2);

    // Add nodes (circles)
    const node = svg.selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", d => d.isCluster ? 40 : 20)
      .attr("fill", d => d.isCluster ? d.color : getNodeColor(d.cluster))  // Use dynamic color for non-cluster nodes
      .attr("stroke", d => d.isCluster ? 'black' : null)
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Add labels for nodes
    const label = svg.selectAll("text")
      .data(nodes)
      .join("text")
      .attr("x", 6)
      .attr("y", 3)
      .attr("fill", d => d.isCluster ? "white" : getLabelColor(d.cluster))  // Set label color based on cluster
      .text(d => d.isCluster ? d.label : d.label.split(" ")[0]);

    // Update positions of nodes and links
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

      label
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });

    // Drag functions
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

  }, [data]);

  // Helper to assign color based on cluster
  const getNodeColor = (cluster) => {
    switch (cluster) {
      case 'IT':
        return 'blue';
      case 'OT':
        return 'green';
      case 'Network':
        return 'orange';
      default:
        return 'gray';
    }
  };

  // Helper to assign label color based on cluster
  const getLabelColor = (cluster) => {
    switch (cluster) {
      case 'IT':
        return 'lightblue';
      case 'OT':
        return 'lightgreen';
      case 'Network':
        return 'lightcoral';
      default:
        return 'white';
    }
  };

  return <svg ref={svgRef} style={{ width: '100%', height: '600px' }} />;
};

// Helper function to process the data into D3 nodes and links
const createD3Data = (data) => {
  const nodes = [];
  const links = [];
  const uniqueNodes = new Set();

  if (!Array.isArray(data) || !data.length || !data[0].mac_data) {
    console.error("Data does not contain the expected structure.");
    return { nodes, links };
  }

  const macData = data[0].mac_data;

  // Define clusters (subnets)
  const clusters = [
    { id: 'IT', label: 'IT Subnet', color: 'blue' },
    { id: 'OT', label: 'OT Subnet', color: 'green' },
    { id: 'Network', label: 'Network Subnet', color: 'orange' }
  ];

  // Add cluster nodes to the dataset
  clusters.forEach(cluster => {
    nodes.push({ id: cluster.id, label: cluster.label, isCluster: true, color: cluster.color });
    uniqueNodes.add(cluster.id);
  });

  // Iterate through mac_data and process each device
  macData.forEach(deviceCategory => {
    Object.entries(deviceCategory).forEach(([category, devices]) => {
      if (Array.isArray(devices)) {
        devices.forEach(device => {
          const macAddress = device.MAC;
          const vendor = device.Vendor || "Unknown";
          const ip = device.IP || "N/A";
          const subnetMask = device.SubnetMask;

          if (!uniqueNodes.has(macAddress) && macAddress !== "00:00:00:00:00:00") {
            uniqueNodes.add(macAddress);

            // Assign to correct cluster based on the category (e.g., IT, OT, Network)
            let cluster = category === 'IT Devices' ? 'IT' : (category === 'OT Devices' ? 'OT' : 'Network');

            nodes.push({
              id: macAddress,
              label: `${vendor} (${macAddress})`,
              cluster,
              ip,
              isCluster: false
            });

            // Only add link between the device and its cluster (not to other nodes)
            links.push({ source: macAddress, target: cluster });
          }
        });
      } else {
        console.error(`Expected an array but got ${typeof devices} for ${category}`);
      }
    });
  });

  // Add cluster-to-cluster links
  links.push({ source: 'IT', target: 'OT', isClusterLink: true });
  links.push({ source: 'IT', target: 'Network', isClusterLink: true });
  links.push({ source: 'OT', target: 'Network', isClusterLink: true });

  return { nodes, links };
};

export default GraphComponent;
