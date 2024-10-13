'use client';
import ReactDOMServer from 'react-dom/server';
import React, { useEffect } from 'react';
import cytoscape from 'cytoscape';
import cise from 'cytoscape-cise';
import networkData from '../data/networkgraph.json'; // Your JSON data
import { FaDesktop, FaNetworkWired } from 'react-icons/fa';
import { GiServerRack } from 'react-icons/gi'; // Example icon for OT

cytoscape.use(cise); // Use CiSE layout

const GraphComponent = ({ data }) => {
  useEffect(() => {
    const container = document.getElementById('cy');

    // Check if the container exists to avoid the "notify" error
    if (!container) {
      console.error("Cytoscape container not found");
      return;
    }

    const elements = createCytoscapeData(data || networkData);

    // Initialize Cytoscape with proper layout and style
    const cy = cytoscape({
      container,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-image': function (ele) {
              const type = ele.data('type');
              if (type === 'IT') {
                return `data:image/svg+xml,${encodeURIComponent(renderIcon(<FaDesktop />))}`; // Desktop icon for IT
              }
              if (type === 'OT') {
                return `data:image/svg+xml,${encodeURIComponent(renderIcon(<GiServerRack />))}`; // Server Rack icon for OT
              }
              if (type === 'Network') {
                return `data:image/svg+xml,${encodeURIComponent(renderIcon(<FaNetworkWired />))}`; // Router icon for Network
              }
              return '#bdc3c7'; // Default gray
            },
            'background-fit': 'contain',
            'background-opacity': 1,
            'label': function (ele) {
              if (ele.data('isCluster')) {
                return `${ele.data('label')}`; // Display cluster label on top
              }
              return `${ele.data('vendor') || ''}`; // Show only vendor name as the label for nodes
            },
            'text-wrap': 'wrap',
            'text-max-width': '70px',
            'color': '#0047AB', // Label text color
            'font-size': '12px',
            'text-valign': 'top', // Cluster labels will appear on top
            'text-halign': 'center',
            'width': '70px', // Increased node size for clusters
            'height': '70px',
            'border-width': 2,
            'background-color': function (ele) {
              const type = ele.data('type');
              return type === 'IT' ? '#3498db' : type === 'OT' ? '#e67e22' : '#2ecc71';
            },
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
      ],
      layout: {
        name: 'cise',
        clusters: function (node) {
          return node.data('cluster'); // Ensure cluster info is provided
        },
        animate: false, // Disable animation to reduce jitter
        padding: 100, // Increased padding around the graph
        allowNodesInsideCircle: true,
        nodeRepulsion: 12000, // Further increased node repulsion for more space
        idealInterClusterEdgeLengthCoefficient: 2.5, // Increase the distance between clusters
        nodeSeparation: 50, // Further increased node separation for more space between nodes
        refresh: 10,
        fit: true,
        nodeDimensionsIncludeLabels: true,
        maxIterations: 1000, // Limit iterations
        refreshIterations: 50,
      },
    });

    cy.on('layoutstop', () => {
      console.log('Layout has finished');
    });

    // Tap event to display node details
    cy.on('tap', 'node', (event) => {
      const node = event.target;
      const nodeData = node.data();

      alert(`
        MAC Address: ${nodeData.id}
        Vendor: ${nodeData.vendor}
        Type: ${nodeData.type}
        IP: ${nodeData.ip || 'N/A'}
        Protocols: ${nodeData.protocols || 'N/A'}
      `);
    });

  }, [data]);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <div id="cy" style={{ height: '100%', width: '100%' }}></div>
    </div>
  );
};

// Helper function to render React icons as SVG strings
const renderIcon = (icon) => {
  return ReactDOMServer.renderToStaticMarkup(icon);
};

// Helper function to process the data into Cytoscape elements
const createCytoscapeData = (data) => {
  const elements = [];

  // Cluster identifiers for each type
  const clusters = {
    IT: 'IT_Cluster',
    OT: 'OT_Cluster',
    Network: 'Network_Cluster',
  };

  if (!Array.isArray(data) || !data.length || !data[0].mac_data) {
    console.error("Data does not contain the expected structure.");
    return elements; // Return empty elements if data is invalid
  }

  const macData = data[0].mac_data;
  const nodeIds = new Set(); // Track existing node IDs for edge checking

  // Create main clusters with icons and labels
  Object.keys(clusters).forEach(type => {
    elements.push({
      data: {
        id: clusters[type],
        label: type, // Title for the cluster
        type: type,
        cluster: type,
        isCluster: true, // Indicate this is a cluster node
      },
    });
  });

  macData.forEach((category) => {
    Object.keys(category).forEach((deviceType) => {
      category[deviceType].forEach((device) => {
        const macAddress = device.MAC;
        const vendor = device.Vendor;
        const cluster = deviceType.includes('OT') ? 'OT' : (deviceType.includes('IT') ? 'IT' : 'Network'); // Assign cluster based on type

        // Add node to elements and track its ID
        nodeIds.add(macAddress); // Store valid node IDs for edge verification
        elements.push({
          data: {
            id: macAddress,
            label: macAddress, // Label is vendor-only in the visual, but we keep MAC in the data
            type: cluster,
            vendor,
            cluster: cluster,
            ip: device.IP, // Store IP in node data
            protocols: device.Protocol ? device.Protocol.join(', ') : 'N/A', // Store Protocols
          },
        });

        // Connect devices to their respective cluster
        elements.push({
          data: {
            source: macAddress,
            target: clusters[cluster], // Connect to the respective cluster
          },
        });

        // Add edges for connections only to other nodes in the same cluster
        if (device[macAddress] && Array.isArray(device[macAddress])) {
          device[macAddress].forEach((connectedMac) => {
            if (
              connectedMac !== '00:00:00:00:00:00' &&
              nodeIds.has(connectedMac) &&
              cluster === getClusterByMac(connectedMac, elements) // Check if the connected node belongs to the same cluster
            ) {
              elements.push({
                data: { source: macAddress, target: connectedMac }
              });
            }
          });
        }
      });
    });
  });

  // Create one line of connections between clusters
  elements.push({
    data: {
      source: clusters['IT'],
      target: clusters['OT'],
    },
  });

  elements.push({
    data: {
      source: clusters['OT'],
      target: clusters['Network'],
    },
  });

  return elements;
};

// Helper function to determine the cluster of a MAC address
const getClusterByMac = (macAddress, elements) => {
  const node = elements.find(e => e.data && e.data.id === macAddress);
  return node ? node.data.cluster : null;
};
// Placeholder for OT icon (base64 or URL can be added here)...';
const iconOT = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cGF0aCBkPSJNMzg0IDMyMEgyNTZjLTE3LjY3IDAtMzIgMTQuMzMtMzIgMzJ2MTI4YzAgMTcuNjcgMTQuMzMgMzIgMzIgMzJoMTI4YzE3LjY3IDAgMzItMTQuMzMgMzItMzJWMzUyYzAtMTcuNjctMTQuMzMtMzItMzItMzJ6TTQ5NiA2NGgtMTI4Yy0xNy42NyAwLTMyIDE0LjMzLTMyIDMydjEyOGMwIDE3LjY3IDE0LjMzIDMyIDMyIDMyaDEyOGMxNy42NyAwIDMyLTE0LjMzIDMyLTMyVjk2YzAtMTcuNjctMTQuMzMtMzItMzItMzJ6TTE0NCAzMjBIMTZjLTE3LjY3IDAtMzIgMTQuMzMtMzIgMzJ2MTI4YzAgMTcuNjcgMTQuMzMgMzIgMzIgMzJoMTI4YzE3LjY3IDAgMzItMTQuMzMgMzItMzJWMzUyYzAtMTcuNjctMTQuMzMtMzItMzItMzJ6TTM4NCA2NEgyNTZjLTE3LjY3IDAtMzIgMTQuMzMtMzIgMzJ2MTI4YzAgMTcuNjcgMTQuMzMgMzIgMzIgMzJoMTI4YzE3LjY3IDAgMzItMTQuMzMgMzItMzJWOTZjMC0xNy42Ny0xNC4zMy0zMi0zMi0zMnpNMTQ0IDY0SDE2QzguODIgNjQgMi45NCA2OS43OCAwIDc3LjY1VjI0MGMwIDE3LjY3IDE0LjMzIDMyIDMyIDMyaDEyOGMxNy42NyAwIDMyLTE0LjMzIDMyLTMyVjk2YzAtMTcuNjctMTQuMzMtMzItMzItMzJ6Ii8+PC9zdmc+';
export default GraphComponent;
