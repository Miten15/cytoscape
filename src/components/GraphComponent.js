'use client';

import ReactDOMServer from 'react-dom/server';
import React, { useEffect } from 'react';
import cytoscape from 'cytoscape';
import cise from 'cytoscape-cise';
import networkData from '../data/networkgraph.json'; // Import the default network data (JSON format)
import { FaDesktop, FaNetworkWired } from 'react-icons/fa'; // Import React icons for IT and Network devices
import { GiServerRack } from 'react-icons/gi'; // Import React icon for OT (Operational Technology)

// Enable the CiSE layout for the Cytoscape graph
cytoscape.use(cise); 

const GraphComponent = ({ data }) => {
  useEffect(() => {
    // Get the container element where the graph will be rendered
    const container = document.getElementById('cy');

    // Check if the container exists to avoid errors
    if (!container) {
      console.error("Cytoscape container not found");
      return; // Exit if the container is not found
    }

    // Create Cytoscape elements using the provided data or default data
    const elements = createCytoscapeData(data || networkData);

    // Initialize Cytoscape with proper layout and style
    const cy = cytoscape({
      container,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            // Set background image for nodes based on their type
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
              return '#bdc3c7'; // Default gray color for other nodes
            },
            'background-fit': 'contain', // Ensure the icon fits within the node
            'background-opacity': 1, // Set opacity for the background
            'label': function (ele) {
              // Show the cluster label or vendor name as the label
              if (ele.data('isCluster')) {
                return `${ele.data('label')}`; // Display cluster label on top
              }
              return `${ele.data('vendor') || ''}`; // Show vendor name for nodes
            },
            'text-wrap': 'wrap', // Allow text to wrap within the node
            'text-max-width': '70px', // Set max width for the text
            'color': '#FFFFFF', // Label text color
            'font-size': '12px', // Font size for labels
            'text-valign': 'top', // Align text to the top of the node
            'text-halign': 'center', // Center align text horizontally
            'width': '70px', // Width of the node
            'height': '70px', // Height of the node
            'border-width': 2, // Width of the border around the node
            'background-color': function (ele) {
              // Set background color based on node type
              const type = ele.data('type');
              return type === 'IT' ? '#3498db' : type === 'OT' ? '#e67e22' : '#2ecc71'; // Assign colors based on type
            },
          },
        },
        {
          selector: 'edge', // Styling for edges (connections between nodes)
          style: {
            'width': 2, // Width of the edges
            'line-color': '#ccc', // Color of the edges
            'target-arrow-color': '#ccc', // Color of the arrow at the end of the edge
            'target-arrow-shape': 'triangle', // Shape of the arrow at the end of the edge
            'curve-style': 'bezier', // Curved edges for better visualization
          },
        },
      ],
      layout: {
        name: 'cise', // Use the CiSE layout
        clusters: function (node) {
          return node.data('cluster');  // Assign nodes to a cluster based on your data
        },
        animate: false, // Disable animation for layout
        padding: 250, // Padding around the graph
        allowNodesInsideCircle: false, // Prevent nodes from being placed inside cluster circles
        nodeRepulsion: 4500,           // High repulsion to space nodes apart
        idealInterClusterEdgeLengthCoefficient: 5.0,  // Increase the distance between clusters
        nodeSeparation: 150,           // Helps space out nodes within the cluster
        refresh: 20,                   // Refresh rate for the layout
        fit: true,                     // Fit the graph into the view
        nodeDimensionsIncludeLabels: true, // Include labels in node dimensions
        maxIterations: 2000,           // Maximum iterations for layout
        refreshIterations: 50,         // Refresh iterations
        gravityRangeCompound: 5.5,     // Strength of the gravity for clusters
        gravityCompound: 10.           // Gravity for tightly connected clusters
      }
    });

    cy.on('layoutstop', () => {
      console.log('Layout has finished'); // Log when layout finishes
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

    // Mouseover event for edges to display IP and MAC addresses
    cy.on('tap', 'edge', (event) => {
      const edge = event.target; // Get the edge that triggered the event
      const sourceNode = cy.getElementById(edge.source().id()); // Get the source node
      const targetNode = cy.getElementById(edge.target().id()); // Get the target node

      const sourceData = sourceNode.data(); // Get data for source node
      const targetData = targetNode.data(); // Get data for target node

      const message = `
        Source:
        MAC: ${sourceData.id}
        IP: ${sourceData.ip || 'N/A'}

        Target:
        MAC: ${targetData.id}
        IP: ${targetData.ip || 'N/A'}
      `;

      // Display the message in an alert or tooltip
      alert(message);
    });

    // Mouseout event for edges to hide the tooltip
    cy.on('mouseout', 'edge', (event) => {
      console.log('Mouse out of edge'); // Log when mouse leaves edge
    });

  }, [data]);

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <div id="cy" style={{ height: '100%', width: '100%' }}></div>
    </div>  
  );
};

// Helper function to render React icons as SVG strings
const renderIcon = (icon) => {
  return ReactDOMServer.renderToStaticMarkup(icon); // Convert React component to SVG string
};

// Helper function to process the data into Cytoscape elements
const createCytoscapeData = (data) => {
  const elements = []; // Array to hold all Cytoscape elements

  // Cluster identifiers for each type
  const clusters = {
    IT: 'IT_Cluster',
    OT: 'OT_Cluster',
    Network: 'Network_Cluster',
  };

  // Validate the incoming data
  if (!Array.isArray(data) || !data.length || !data[0].mac_data) {
    console.error("Data does not contain the expected structure.");
    return elements; // Return empty elements if data is invalid
  }

  const macData = data[0].mac_data; // Get MAC data from the first entry
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
        const macAddress = device.MAC; // Get MAC address
        const vendor = device.Vendor; // Get vendor name
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

  return elements; // Return all created elements for Cytoscape
};

// Helper function to determine the cluster of a MAC address
const getClusterByMac = (macAddress, elements) => {
  const node = elements.find(e => e.data && e.data.id === macAddress);
  return node ? node.data.cluster : null; // Return the cluster of the given MAC address
};

// Placeholder for OT icon (base64 or URL can be added here)...';
const iconOT = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cGF0aCBkPSJNMzg0IDMyMEgyNTZjLTE3LjY3IDAtMzIgMTQuMzMtMzIgMzJ2MTI4YzAgMTcuNjcgMTQuMzMgMzIgMzIgMzJoMTI4YzE3LjY3IDAgMzItMTQuMzMgMzItMzJWMzUyYzAtMTcuNjctMTQuMzMtMzItMzItMzJ6TTQ5NiA2NGgtMTI4Yy0xNy42NyAwLTMyIDE0LjMzLTMyIDMydjEyOGMwIDE3LjY3IDE0LjMzIDMyIDMyIDMyaDEyOGMxNy42NyAwIDMyLTE0LjMzIDMyLTMyVjk2YzAtMTcuNjctMTQuMzMtMzItMzItMzJ6TTE0NCAzMjBIMTZjLTE3LjY3IDAtMzIgMTQuMzMtMzIgMzJ2MTI4YzAgMTcuNjcgMTQuMzMgMzIgMzIgMzJoMTI4YzE3LjY3IDAgMzItMTQuMzMgMzItMzJWMzUyYzAtMTcuNjctMTQuMzMtMzItMzItMzJ6TTM4NCA2NEgyNTZjLTE3LjY3IDAtMzIgMTQuMzMtMzIgMzJ2MTI4YzAgMTcuNjcgMTQuMzMgMzIgMzIgMzJoMTI4YzE3LjY3IDAgMzItMTQuMzMgMzItMzJWOTZjMC0xNy42Ny0xNC4zMy0zMi0zMi0zMnpNMTQ0IDY0SDE2QzguODIgNjQgMi45NCA2OS43OCAwIDc3LjY1VjI0MGMwIDE3LjY3IDE0LjMzIDMyIDMyIDMyaDEyOGMxNy42NyAwIDMyLTE0LjMzIDMyLTMyVjk2YzAtMTcuNjctMTQuMzMtMzItMzItMzJ6Ii8+PC9zdmc+';

export default GraphComponent;
