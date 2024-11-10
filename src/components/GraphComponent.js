import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const GraphComponent = ({ data }) => {
  const svgRef = useRef();
  const tooltipRef = useRef();

  useEffect(() => {
    if (!data || !Array.isArray(data) || !data[0].mac_data) {
      console.error('Invalid data format. Expected an array with "mac_data".');
      return;
    }

    const macData = data[0].mac_data;
    const nodes = [];
    const links = [];

    // Define cluster nodes with fixed positions and larger areas
    const clusters = {
      IT: { id: 'IT_Cluster', label: 'IT Cluster', color: '#4287f5', x: 400, y: 800, width: 600, height: 1800 },
      OT: { id: 'OT_Cluster', label: 'OT Cluster', color: '#42f54e', x: 950, y: 600, width: 600, height: 1800 },
      Network: { id: 'Network_Cluster', label: 'Network Cluster', color: '#f54242', x: 1500, y: 800, width: 600, height: 1800 }
    };

    // Add cluster nodes
    Object.values(clusters).forEach(cluster => {
      nodes.push({
        ...cluster,
        fx: cluster.x,
        fy: cluster.y
      });
    });

    // Process device nodes
    macData.forEach((category, index) => {
      const clusterType = index === 0 ? 'IT' : index === 1 ? 'OT' : 'Network';
      const cluster = clusters[clusterType];
      const clusterId = cluster.id;

      Object.entries(category).forEach(([_, devices]) => {
        devices.forEach((device, deviceIndex) => {
          const angle = (deviceIndex * 2.399) % (2 * Math.PI);
          const radius = Math.sqrt(deviceIndex) * 50;
          const randomX = cluster.x + Math.cos(angle) * radius;
          const randomY = cluster.y + Math.sin(angle) * radius;

          const deviceNode = {
            id: device.MAC,
            IP: device.IP,
            MAC: device.MAC,
            Vendor: device.Vendor,
            Protocol: Array.isArray(device.Protocol) ? device.Protocol.join(', ') : device.Protocol,
            Port: Array.isArray(device.Port) ? device.Port.join(', ') : device.Port,
            status: device.status,
            type: clusterType,
            connections: device[device.MAC],
            x: randomX,
            y: randomY
          };
          nodes.push(deviceNode);

          links.push({
            source: device.MAC,
            target: clusterId,
            Protocol: Array.isArray(device.Protocol) ? device.Protocol.join(', ') : device.Protocol
          });
        });
      });
    });

    const width = 1950;
    const height = 1200;

    // Remove existing tooltip if any
    d3.select('#graph-tooltip').remove();
    
    // Create tooltip container that stays within SVG
    const tooltipContainer = d3.select('body')
      .append('div')
      .attr('id', 'graph-tooltip')
      .style('position', 'fixed') // Changed from absolute to fixed
      .style('background-color', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '12px')
      .style('border', '1px solid #ccc')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 9999)
      .style('max-width', '300px')
      .style('box-shadow', '0 4px 8px rgba(0, 0, 0, 0.2)')
      .style('transition', 'opacity 0.2s ease-in-out');

    // Clear existing SVG content
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('background-color', '#1a1a1a');

    svg.selectAll('*').remove();

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 5])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create a container for all elements that will be zoomed
    const container = svg.append('g');

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(200).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-800))
      .force('x', d3.forceX(d => d.x))
      .force('y', d3.forceY(d => d.y))
      .force('collision', d3.forceCollide().radius(50).strength(0.9));

    // Draw links
    const link = container.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1);

    // Draw nodes
    const node = container.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => d.id.includes('Cluster') ? 12 : 8)
      .attr('fill', d => clusters[d.type]?.color || 'gray')
      .attr('stroke', d => d.status === 'true' ? '#00ff00' : '#ff0000')
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer');

    // Add labels
    const labelGroups = container.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('pointer-events', 'none');

    // Add label backgrounds
    labelGroups.append('text')
      .attr('dy', -20)
      .attr('text-anchor', 'middle')
      .attr('fill', 'black')
      .attr('stroke', '#1a1a1a')
      .attr('stroke-width', 4)
      .attr('font-size', '12px')
      .style('pointer-events', 'none')
      .text(d => d.id.includes('Cluster') ? d.label : d.Vendor);

    // Add label text
    labelGroups.append('text')
      .attr('dy', -20)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .style('pointer-events', 'none')
      .text(d => d.id.includes('Cluster') ? d.label : d.Vendor);

    // Enhanced tooltip behavior
    const showTooltip = (event, d) => {
      if (!d.id.includes('Cluster')) {
        const content = `
          <div style="min-width: 200px;">
            <strong>MAC:</strong> ${d.MAC}<br>
            <strong>IP:</strong> ${d.IP || 'N/A'}<br>
            <strong>Vendor:</strong> ${d.Vendor || 'Unknown'}<br>
            <strong>Type:</strong> ${d.type}<br>
            <strong>Status:</strong> ${d.status === 'true' ? 'Active' : 'Inactive'}<br>
            <strong>Protocols:</strong> ${d.Protocol || 'N/A'}<br>
            <strong>Ports:</strong> ${d.Port || 'N/A'}<br>
            ${d.connections ? `<strong>Connected to:</strong> ${d.connections.join(', ')}` : ''}
          </div>
        `;

        // Get mouse position relative to viewport
        const mouseX = event.clientX;
        const mouseY = event.clientY;

        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate tooltip dimensions
        const tooltipWidth = 300;
        const tooltipHeight = 200;

        // Calculate tooltip position to keep it within viewport
        let leftPos = mouseX + 15;
        let topPos = mouseY + 15;

        // Adjust position if tooltip would overflow right edge
        if (leftPos + tooltipWidth > viewportWidth) {
          leftPos = mouseX - tooltipWidth - 15;
        }

        // Adjust position if tooltip would overflow bottom edge
        if (topPos + tooltipHeight > viewportHeight) {
          topPos = mouseY - tooltipHeight - 15;
        }

        // Position and show tooltip
        tooltipContainer
          .html(content)
          .style('left', `${leftPos}px`)
          .style('top', `${topPos}px`)
          .style('opacity', 1);

        // Highlight node
        d3.select(event.currentTarget)
          .attr('stroke-width', 3)
          .attr('r', d => d.id.includes('Cluster') ? 14 : 10);
      }
    };

    const hideTooltip = (event) => {
      tooltipContainer
        .style('opacity', 0);

      d3.select(event.currentTarget)
        .attr('stroke-width', 1.5)
        .attr('r', d => d.id.includes('Cluster') ? 12 : 8);
    };

    node
      .on('mouseover', showTooltip)
      .on('mouseout', hideTooltip)
      .on('mousemove', (event, d) => {
        if (!d.id.includes('Cluster')) {
          showTooltip(event, d);
        }
      });

    // Drag behavior
    const drag = d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        if (!d.id.includes('Cluster')) {
          d.fx = null;
          d.fy = null;
        }
      });

    node.call(drag);

    // Simulation update
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      labelGroups
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Cleanup function
    return () => {
      simulation.stop();
      tooltipContainer.remove();
    };
  }, [data]);

  return <svg ref={svgRef}></svg>;
};

export default GraphComponent;