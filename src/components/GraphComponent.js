import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Network, Server, Router } from 'lucide-react';
import ReactDOMServer from 'react-dom/server';

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
        icon: Server
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
        icon: Router
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
    
    // Create node tooltip with absolute positioning
    const tooltipContainer = d3.select('body')
      .append('div')
      .attr('class', 'graph-tooltip')
      .style('position', 'absolute') // Changed from fixed to absolute
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
      .style('transition', 'opacity 0.1s ease-in-out');

    // Create link tooltip with absolute positioning
    const linkTooltip = d3.select('body')
      .append('div')
      .attr('class', 'link-tooltip')
      .style('position', 'absolute') // Changed from fixed to absolute
      .style('background-color', 'rgba(0, 0, 0, 0.9)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 9999);

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
    const link = container.append('g')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', d => d.source.id?.includes('Cluster') && d.target.id?.includes('Cluster') ? 2 : 1)
      .attr('fill', 'none')
      .attr('marker-end', 'url(#arrow)');

    // Create an invisible wider path for better hover detection
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

        const bounds = svg.node().getBoundingClientRect();
        const mouseX = event.pageX - bounds.left;
        const mouseY = event.pageY - bounds.top;

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

    // Draw nodes
    const nodeGroup = container.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g');

    // Add invisible larger circle for better hover detection
    const nodeHitArea = nodeGroup
      .append('circle')
      .attr('r', d => d.id.includes('Cluster') ? 25 : 12)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all');

    // Add visible circles for nodes
    const node = nodeGroup
      .append('circle')
      .attr('r', d => d.id.includes('Cluster') ? 20 : 8)
      .attr('fill', d => clusters[d.type]?.color || 'gray')
      .attr('stroke', d => d.status === 'true' ? '#00ff00' : '#ff0000')
      .attr('stroke-width', 1.5);

    // Add icons for cluster nodes
nodeGroup.each(function(d) {
  if (d.id.includes('Cluster')) {
    const IconComponent = clusters[d.id.split('_')[0]]?.icon;
    if (IconComponent) {
      const foreignObject = d3.select(this)
        .append('foreignObject')
        .attr('width', 24)
        .attr('height', 24)
        .attr('x', -12)
        .attr('y', -12);

      const div = foreignObject
        .append('xhtml:div')
        .style('width', '100%')
        .style('height', '100%')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'center');

      const icon = document.createElement('div');
      icon.innerHTML = ReactDOMServer.renderToStaticMarkup(
        <IconComponent width={16} height={16} stroke="white" strokeWidth={2} />
      );
      div.node().appendChild(icon.firstChild);
    }
  }
});

    // Add labels
    const labels = nodeGroup
      .append('text')
      .attr('dy', d => d.id.includes('Cluster') ? -30 : -15)
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
            ${d.connections ? `<strong>Connected to:</strong> ${d.connections.join(', ')}` : ''}
          </div>
        `;

        // Get SVG bounds and mouse position relative to the SVG
        const bounds = svg.node().getBoundingClientRect();
        const mouseX = event.pageX - bounds.left;
        const mouseY = event.pageY - bounds.top;

        // Calculate tooltip position
        const tooltipWidth = 300;
        const tooltipHeight = 200;
        
        let leftPos = mouseX + 15;
        let topPos = mouseY;

        // Adjust position if tooltip would go off screen
        if (leftPos + tooltipWidth > bounds.width) {
          leftPos = mouseX - tooltipWidth - 15;
        }
        if (topPos + tooltipHeight > bounds.height) {
          topPos = mouseY - tooltipHeight;
        }

        tooltipContainer
          .html(content)
          .style('left', `${leftPos}px`)
          .style('top', `${topPos}px`)
          .style('opacity', 1);

        // Highlight the node
        d3.select(event.currentTarget.parentNode)
          .select('circle:not([fill="transparent"])')
          .attr('r', 10)
          .attr('stroke-width', 2);
      }
    };

    const hideTooltip = (event) => {
      tooltipContainer.style('opacity', 0);
      d3.select(event.currentTarget.parentNode)
        .select('circle:not([fill="transparent"])')
        .attr('r', d => d.id.includes('Cluster') ? 20 : 8)
        .attr('stroke-width', 1.5);
    };

    // Add hover behavior to hit area
    nodeHitArea
      .on('mouseover', showTooltip)
      .on('mouseout', hideTooltip)
      .on('mousemove', showTooltip);

    // Curved links function
    function linkArc(d) {
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      const dr = Math.sqrt(dx * dx + dy * dy);
      const curve = d.source.id?.includes('Cluster') && d.target.id?.includes('Cluster') ? 2 : 1;
      return `M${d.source.x},${d.source.y}A${dr * curve},${dr * curve} 0 0,1 ${d.target.x},${d.target.y}`;
    }

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

    nodeGroup.call(drag);

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

      g.append('circle')
        .attr('r', 6)
        .attr('stroke', item.color)
        .attr('fill', 'none')
        .attr('stroke-width', 2);

      g.append('text')
        .attr('x', 15)
        .attr('y', 5)
        .attr('fill', 'white')
        .text(item.label);
    });

    // Add cluster type legend
    const typeLegend = legend.append('g')
      .attr('transform', 'translate(0, 80)');

    typeLegend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('fill', 'white')
      .text('Cluster Types:');

    Object.entries(clusters).forEach(([type, cluster], i) => {
      const g = typeLegend.append('g')
        .attr('transform', `translate(0, ${i * 25 + 15})`);

      g.append('circle')
        .attr('r', 6)
        .attr('fill', cluster.color);

      g.append('text')
        .attr('x', 15)
        .attr('y', 5)
        .attr('fill', 'white')
        .text(cluster.label);
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
    };
  }, [data]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default GraphComponent;