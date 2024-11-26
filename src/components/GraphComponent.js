import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Network, Server, Router, Monitor, Cpu } from 'lucide-react';
import ReactDOMServer from 'react-dom/server';
import { CiServer, CiRouter, CiDesktop } from "react-icons/ci";
import { CircuitBoard } from 'lucide-react';

// Add CSS for the blinking animation
const styles = `
  @keyframes blink {
    0% { opacity: 0.4; }
    50% { opacity: 1; }
    100% { opacity: 0.4; }
  }
  .status-indicator {
    animation: blink 2s infinite;
  }
`;

const GraphComponent = ({ data }) => {
  const svgRef = useRef();
  const tooltipRef = useRef();

  useEffect(() => {
    // Add the styles to the document
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);

    if (!data || !Array.isArray(data) || !data[0].mac_data) {
      console.error('Invalid data format. Expected an array with "mac_data".');
      return;
    }

    const macData = data[0].mac_data;
    const nodes = [];
    const links = [];

    // Define cluster nodes with fixed positions, larger areas, and icons
    const clusters = {
      IT: { 
        id: 'IT_Cluster', 
        label: 'IT Cluster', 
        color: '#4287f5', 
        x: 400, 
        y: 800, 
        width: 600, 
        height: 1800,
        icon: CiServer
      },
      OT: { 
        id: 'OT_Cluster', 
        label: 'OT Cluster', 
        color: '#42f54e', 
        x: 950, 
        y: 600, 
        width: 600, 
        height: 1800,
        icon: Network
      },
      Network: { 
        id: 'Network_Cluster', 
        label: 'Network Cluster', 
        color: '#f54242', 
        x: 1500, 
        y: 800, 
        width: 600, 
        height: 1800,
        icon: CiRouter
      }
    };

    // Add cluster nodes
    Object.values(clusters).forEach(cluster => {
      nodes.push({
        ...cluster,
        fx: cluster.x,
        fy: cluster.y
      });
    });

    // Add inter-cluster links
    const clusterLinks = [
      { source: 'IT_Cluster', target: 'OT_Cluster', protocol: 'Inter-cluster Communication' },
      { source: 'OT_Cluster', target: 'Network_Cluster', protocol: 'Inter-cluster Communication' },
      { source: 'Network_Cluster', target: 'IT_Cluster', protocol: 'Inter-cluster Communication' }
    ];
    links.push(...clusterLinks);

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
            protocol: Array.isArray(device.Protocol) ? device.Protocol : [device.Protocol]
          });
        });
      });
    });

    const width = 1950;
    const height = 1200;

    // Remove existing tooltips
    d3.selectAll('.graph-tooltip').remove();
    d3.selectAll('.link-tooltip').remove();
    
    // Create node tooltip with mouse following behavior
    const tooltipContainer = d3.select('body')
      .append('div')
      .attr('class', 'graph-tooltip')
      .style('position', 'absolute')
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
      .style('transition', 'opacity 0.2s ease-out');

    // Create link tooltip with smooth animation
    const linkTooltip = d3.select('body')
      .append('div')
      .attr('class', 'link-tooltip')
      .style('position', 'absolute')
      .style('background-color', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 9999)
      .style('transition', 'all 0.2s ease-out');

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

    // Create a container for all elements
    const container = svg.append('g');

    // Create arrow marker for links
    svg.append('defs').selectAll('marker')
      .data(['end'])
      .join('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', '#999')
      .attr('d', 'M0,-5L10,0L0,5');

    // Force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(200).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-800))
      .force('x', d3.forceX(d => d.x))
      .force('y', d3.forceY(d => d.y))
      .force('collision', d3.forceCollide().radius(50).strength(0.9));

    // Draw links with curved paths
    const linkHitArea = container.append('g')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 10)
      .attr('fill', 'none')
      .on('mouseover', (event, d) => {
        const content = `
          <strong>Protocols:</strong><br>
          ${Array.isArray(d.protocol) ? d.protocol.join('<br>') : d.protocol}
        `;

        const mouseX = event.pageX;
        const mouseY = event.pageY;

        linkTooltip
          .html(content)
          .style('left', `${mouseX + 15}px`)
          .style('top', `${mouseY}px`)
          .style('opacity', 1);

        // Highlight the corresponding visible link
        link.filter(l => l === d)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', d => d.source.id?.includes('Cluster') && d.target.id?.includes('Cluster') ? 4 : 2);
      })
      .on('mouseout', (event, d) => {
        linkTooltip.style('opacity', 0);
        link.filter(l => l === d)
          .attr('stroke-opacity', 0.4)
          .attr('stroke-width', d => d.source.id?.includes('Cluster') && d.target.id?.includes('Cluster') ? 2 : 1);
      });

    // Draw nodes with improved hit detection
    const nodeGroup = container.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer');

    // Add hit area for better interaction
    const nodeHitArea = nodeGroup
      .append('rect')
      .attr('width', 24)
      .attr('height', 24)
      .attr('x', -12)
      .attr('y', -12)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all');

    // Add icons for all nodes
    const getIconForDevice = (type) => {
      const iconMap = {
        'IT': CiDesktop,
        'OT': CircuitBoard,
        'Network': Router,
        'IT_Cluster': CiServer,
        'OT_Cluster': Network,
        'Network_Cluster': CiRouter
      };
      return iconMap[type] || Network;
    };

    nodeGroup.each(function(d) {
      // Add status indicator dot
      if (!d.id.includes('Cluster')) {
        d3.select(this)
          .append('circle')
          .attr('class', 'status-indicator')
          .attr('r', 3)
          .attr('cx', 0)
          .attr('cy', -10)
          .attr('fill', d.status === 'true' ? '#00ff00' : '#ff0000')
          .style('pointer-events', 'none');
      }

      if (d.id.includes('Cluster')) {
        d3.select(this)
          .append('circle')
          .attr('r', 30)
          .attr('fill', d.color || '#666')
          .attr('opacity', 0.3)
          .style('pointer-events', 'none');
      }

      const IconComponent = getIconForDevice(d.type || d.id);
      if (IconComponent) {
        const foreignObject = d3.select(this)
          .append('foreignObject')
          .attr('width', 24)
          .attr('height', 24)
          .attr('x', -12)
          .attr('y', -12)
          .style('pointer-events', 'none');

        const div = foreignObject
          .append('xhtml:div')
          .style('width', '100%')
          .style('height', '100%')
          .style('display', 'flex')
          .style('align-items', 'center')
          .style('justify-content', 'center')
          .style('pointer-events', 'none');

        const icon = document.createElement('div');
        icon.innerHTML = ReactDOMServer.renderToStaticMarkup(
          <IconComponent width={16} height={16} stroke="white" strokeWidth={1} />
        );
        div.node().appendChild(icon.firstChild);
      }
    });

    // Add labels with pointer-events disabled
    const labels = nodeGroup
      .append('text')
      .attr('dy', d => d.id.includes('Cluster') ? -30 : -15)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '12px')
      .style('pointer-events', 'none')
      .text(d => d.id.includes('Cluster') ? d.label : d.Vendor);

    // Enhanced tooltip behavior with mouse following
    const showTooltip = (event, d) => {
      if (!d.id.includes('Cluster')) {
        const content = `
          <div style="min-width: 200px;">
            <strong>MAC:</strong> ${d.MAC}<br>
            <strong>IP:</strong> ${d.IP || 'N/A'}<br>
            <strong>Vendor:</strong> ${d.Vendor || 'Unknown'}<br>
            <strong>Type:</strong> ${d.type}<br>
            <strong>Status:</strong> ${d.status === 'true' ? 'Active' : 'Inactive'}<br>
            ${d.connections ? `<strong>Connected to:</strong> ${d.connections.join(', ')}` : ''}
          </div>
        `;

        tooltipContainer
          .html(content)
          .style('left', `${event.clientX + 15}px`)
          .style('top', `${event.clientY - 10}px`)
          .style('opacity', 1);

        // Highlight the node
        d3.select(event.currentTarget.parentNode)
          .select('foreignObject')
          .transition()
          .duration(200)
          .attr('width', 28)
          .attr('height', 28)
          .attr('x', -14)
          .attr('y', -14);
      }
    };

    const hideTooltip = (event) => {
      tooltipContainer
        .transition()
        .duration(200)
        .style('opacity', 0);

      d3.select(event.currentTarget.parentNode)
        .select('foreignObject')
        .transition()
        .duration(200)
        .attr('width', 24)
        .attr('height', 24)
        .attr('x', -12)
        .attr('y', -12);
    };

    // Update mousemove handler for smooth tooltip following
    nodeHitArea
      .on('mouseover', showTooltip)
      .on('mouseout', hideTooltip)
      .on('mousemove', (event, d) => {
        if (!d.id.includes('Cluster')) {
          const x = event.clientX + window.pageXOffset;
          const y = event.clientY + window.pageYOffset;
          
          tooltipContainer
            .style('left', `${x + 15}px`)
            .style('top', `${y - 10}px`);
        }
      });

    // Modified linkArc function to create straight lines
    function linkArc(d) {
      const sourceNode = d.source;
      const targetNode = d.target;
      
      // Calculate the angle between nodes
      const dx = targetNode.x - sourceNode.x;
      const dy = targetNode.y - sourceNode.y;
      const angle = Math.atan2(dy, dx);
      
      // Set offset based on node type
      const sourceOffset = sourceNode.id?.includes('Cluster') ? 30 : 12;
      const targetOffset = targetNode.id?.includes('Cluster') ? 30 : 12;
      
      // Calculate start and end points
      const startX = sourceNode.x + Math.cos(angle) * sourceOffset;
      const startY = sourceNode.y + Math.sin(angle) * sourceOffset;
      const endX = targetNode.x - Math.cos(angle) * targetOffset;
      const endY = targetNode.y - Math.sin(angle) * targetOffset;
      
      // Return a straight line path
      return `M${startX},${startY}L${endX},${endY}`;
    }

    // Update link paths to use straight lines
    const link = container.append('g')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', d => d.source.id?.includes('Cluster') && d.target.id?.includes('Cluster') ? 2 : 1)
      .attr('fill', 'none')
      .attr('marker-end', 'url(#arrow)');


    // Simulation update
    simulation.on('tick', () => {
      // Update link paths
      link.attr('d', linkArc);
      linkHitArea.attr('d', linkArc);
      
      // Update node positions
      nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Add double-click behavior for centering view
    nodeHitArea.on('dblclick', (event, d) => {
      event.stopPropagation();
      
      const transform = d3.zoomTransform(svg.node());
      const scale = transform.k;
      const x = width / 2 - d.x * scale;
      const y = height / 2 - d.y * scale;
      
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity
          .translate(x, y)
          .scale(scale)
        );
    });

    // Add double-click on background to reset zoom
    svg.on('dblclick', (event) => {
      svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
    });

    // Add legend
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(20, 20)`);

    // Add status legend
    const statusLegend = legend.append('g')
      .attr('transform', 'translate(0, 0)');

    statusLegend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('fill', 'white')
      .text('Status:');

    const statusItems = [
      { label: 'Active', color: '#00ff00' },
      { label: 'Inactive', color: '#ff0000' }
    ];

    statusItems.forEach((item, i) => {
      const g = statusLegend.append('g')
        .attr('transform', `translate(0, ${i * 25 + 15})`);

      g.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', item.color);

      g.append('text')
        .attr('x', 20)
        .attr('y', 10)
        .attr('fill', 'white')
        .text(item.label);
    });

    // Add node type legend
    const typeLegend = legend.append('g')
      .attr('transform', 'translate(0, 80)');

    typeLegend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('fill', 'white')
      .text('Node Types:');

    const nodeTypes = [
      { type: 'IT', label: 'IT', icon: CiDesktop },
      { type: 'OT', label: 'OT', icon: CircuitBoard },
      { type: 'Network', label: 'Network', icon: Router }
    ];

    nodeTypes.forEach((item, i) => {
      const g = typeLegend.append('g')
        .attr('transform', `translate(0, ${i * 25 + 15})`);

      const icon = document.createElement('div');
      icon.innerHTML = ReactDOMServer.renderToStaticMarkup(
        <item.icon width={16} height={16} stroke="white" strokeWidth={1} />
      );

      g.append('foreignObject')
        .attr('width', 16)
        .attr('height', 16)
        .style('pointer-events', 'none')
        .append('xhtml:div')
        .style('width', '100%')
        .style('height', '100%')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center')
        .node()
        .appendChild(icon.firstChild);

      g.append('text')
        .attr('x', 24)
        .attr('y', 12)
        .attr('fill', 'white')
        .text(item.label);
    });

    // Add instructions text
    const instructions = svg.append('g')
      .attr('class', 'instructions')
      .attr('transform', `translate(20, ${height - 60})`);

    instructions.append('text')
      .attr('fill', 'white')
      .attr('opacity', 0.7)
      .selectAll('tspan')
      .data([
        'Instructions:',
        '• Hover over nodes to see details',
        '• Double-click node to center view',
        '• Double-click background to reset view',
        '• Drag nodes to reposition'
      ])
      .join('tspan')
      .attr('x', 0)
      .attr('dy', (d, i) => i === 0 ? 0 : '1.2em')
      .text(d => d);

    // Cleanup function
    return () => {
      simulation.stop();
      d3.selectAll('.graph-tooltip').remove();
      d3.selectAll('.link-tooltip').remove();
      document.head.removeChild(styleSheet);
    };
  }, [data]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default GraphComponent;

