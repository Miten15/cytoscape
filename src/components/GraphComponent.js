"use client";

import React, { useEffect } from 'react';
import cytoscape from 'cytoscape';
import cise from 'cytoscape-cise';
import networkData from '../data/networkgraph.json'; // Your JSON data

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

    // Initialize Cytoscape only if the container is not null
    const cy = cytoscape({
      container, // Pass the container directly
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': function (ele) {
              const type = ele.data('type');
              if (type === 'IT') return '#3498db'; // Blue
              if (type === 'OT') return '#e74c3c'; // Red
              if (type === 'Network') return '#2ecc71'; // Green
              return '#bdc3c7'; // Default gray
            },
            'label': function (ele) {
              return `${ele.data('label')} (${ele.data('vendor') || ''})`; // Add vendor info
            },
            'color': '#0047AB', // Label text color
            'font-size': '12px',
            'text-valign': 'center',
            'width': '50px',
            'height': '50px',
            'border-width': 2,
            'border-color': '#ccc',
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
        animationDuration: 0, // Set duration to 0 if you want to fully disable it
        padding: 10,
        allowNodesInsideCircle: true,
        nodeRepulsion: 4500,
        idealInterClusterEdgeLengthCoefficient: 1.8,
        nodeSeparation: 12.5,
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

  }, [data]);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <div id="cy" style={{ height: '100%', width: '100%' }}></div>
    </div>
  );
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

  // Create main clusters
  Object.keys(clusters).forEach(type => {
    elements.push({
      data: {
        id: clusters[type],
        label: type,
        type: type,
        cluster: type
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
            label: macAddress,
            type: cluster,
            vendor,
            cluster: cluster,
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

export default GraphComponent;
