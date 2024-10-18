import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const GraphComponent = ({ data }) => {
  const svgRef = useRef();

  useEffect(() => {
    // Clear previous SVG content
    d3.select(svgRef.current).selectAll("*").remove();

    const width = 1200;
    const height = 1200;

    // Create the SVG container
    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .style("background-color", "black");

    // Create a tooltip
    const tooltip = d3.select("body").append("div")
      .style("position", "absolute")
      .style("background-color", "black")
      .style("border", "solid")
      .style("border-width", "2px")
      .style("border-radius", "5px")
      .style("padding", "5px")
      .style("pointer-events", "none") // Prevent pointer events on tooltip
      .style("opacity", 0); // Start with hidden tooltip

    // Extract nodes and links from your data structure
    const { nodes, links } = createD3Data(data);

    // Create the simulation with force layout
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(300).strength(1)) // Increased distance for links
      .force('charge', d3.forceManyBody().strength(-600)) // Increased repulsion strength
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60).strength(0.7)) // Increased radius for collision
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    // Add links (lines)
    const link = svg.selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => d.isClusterLink ? 'white' : 'gray')
      .attr("stroke-width", 2)
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(`Sender: ${d.senderIP} (${d.senderMAC})<br>Receiver: ${d.receiverIP} (${d.receiverMAC})`)
          .style("left", (event.pageX + 5) + "px") // Position tooltip near the cursor
          .style("top", (event.pageY - 28) + "px"); // Offset tooltip vertically

        console.log("Hovered Link Data:", d); // Log link data to the console
      })
      .on("mousemove", (event) => {
        tooltip
          .style("left", (event.pageX + 5) + "px") // Follow the mouse
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0); // Hide tooltip on mouse out
      });

    // Add nodes (icons instead of circles)
    const node = svg.selectAll("image")
      .data(nodes)
      .join("image")
      .attr("xlink:href", d => getIcon(d))
      .attr("width", d => d.isCluster ? 60 : 40)
      .attr("height", d => d.isCluster ? 60 : 40)
      .attr("x", d => d.isCluster ? -30 : -20)
      .attr("y", d => d.isCluster ? -30 : -20)
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Add labels for nodes
    const label = svg.selectAll("text.node-label")
      .data(nodes)
      .join("text")
      .attr("class", "node-label")
      .attr("x", 6)
      .attr("y", 3)
      .attr("fill", d => d.isCluster ? "white" : getLabelColor(d.cluster))
      .text(d => d.isCluster ? d.label : d.label.split(" ")[0]);

    // Update positions of nodes and links
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("x", d => d.x - 20)
        .attr("y", d => d.y);

      label
        .attr("x", d => d.x + 25)
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

  // Helper function to get the icon based on the cluster/type
  const getIcon = (d) => {
    if (d.isCluster) {
      switch (d.id) {
        case 'IT':
          return 'https://i.ibb.co/QM9CwyX/it-icon.png';
        case 'OT':
          return 'https://i.ibb.co/WPnMp2T/plc-icon.png';
        case 'Network':
          return 'https://i.ibb.co/vZkWdzL/nw-icon.png';
        default:
          return 'https://i.ibb.co/vZkWdzL/nw-icon.png';
      }
    } else {
      return d.cluster === 'IT' ? 'https://i.ibb.co/QM9CwyX/it-icon.png'
        : d.cluster === 'OT' ? 'https://i.ibb.co/WPnMp2T/plc-icon.png'
          : 'https://i.ibb.co/vZkWdzL/nw-icon.png';
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

          if (!uniqueNodes.has(macAddress) && macAddress !== "00:00:00:00:00") {
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

            // Add link with sender and receiver IPs and MACs
            links.push({
              source: cluster,
              target: macAddress,
              senderIP: cluster === 'IT' ? 'IT IP' : (cluster === 'OT' ? 'OT IP' : 'Network IP'),
              senderMAC: cluster === 'IT' ? 'IT MAC' : (cluster === 'OT' ? 'OT MAC' : 'Network MAC'),
              receiverIP: ip,
              receiverMAC: macAddress,
              isClusterLink: false // Ensure this is set to false
            });
          }
        });
      }
    });
  });

  // Add cluster links between each cluster
  clusters.forEach((clusterA) => {
    clusters.forEach((clusterB) => {
      if (clusterA.id !== clusterB.id) {
        links.push({
          source: clusterA.id,
          target: clusterB.id,
          senderIP: `${clusterA.id} IP`,
          senderMAC: `${clusterA.id} MAC`,
          receiverIP: `${clusterB.id} IP`,
          receiverMAC: `${clusterB.id} MAC`,
          isClusterLink: true // Indicate that this link connects clusters
        });
      }
    });
  });

  return { nodes, links };
};

export default GraphComponent;
