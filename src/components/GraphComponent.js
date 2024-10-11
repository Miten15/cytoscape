"use client";  // Necessary for using client-side hooks like useEffect

import React, { useEffect } from 'react';
import cytoscape from 'cytoscape';
import cise from 'cytoscape-cise';
import ReactDOMServer from 'react-dom/server';  // This allows us to render React components to strings
import networkData from '../data/networkgraph.json';  // Assuming the JSON data is in this file

import { FaDesktop, FaServer } from 'react-icons/fa';

cytoscape.use(cise);  // Use the CiSE plugin

const GraphComponent = ({ data }) => {
  useEffect(() => {
    const elements = createCytoscapeData(data || networkData);  // Pass the user-provided data

    const cy = cytoscape({
      container: document.getElementById('cy'),
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-image': function (ele) {
              const deviceType = ele.data('type');
              if (deviceType === 'IT') {
                return `data:image/svg+xml,${encodeURIComponent(renderIcon(<FaDesktop />))}`;
              }
              if (deviceType === 'OT') {
                return `data:image/svg+xml,${encodeURIComponent(renderIcon(<FaServer />))}`;
              }
              return `data:image/svg+xml,${encodeURIComponent(renderIcon(<FaDesktop />))}`;
            },
            'background-fit': 'cover',
            'background-opacity': 0.9,
            'label': function (ele) {
              const vendor = ele.data('vendor');
              return `${ele.data('label')} (${vendor})`;  // Text content of the label
            },
            'color': '#0047AB',  // Set the label text color
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
          return node.data('cluster');  // Ensure cluster info is provided
        },
        animate: true,
        animationDuration: 500,  // Adjust the animation duration for a smoother layout
        padding: 10,
        allowNodesInsideCircle: true,
        nodeRepulsion: 4500,
        idealInterClusterEdgeLengthCoefficient: 1.8,  // Adjusted to prevent overlap
        nodeSeparation: 12.5,
        refresh: 10,
        fit: true,
        nodeDimensionsIncludeLabels: true,
        // Setting maxIterations to prevent endless loops
        maxIterations: 1000,  // Limit the number of iterations to stop endless movement
        refreshIterations: 50,  // Refresh the layout every 50 iterations
      },
    });

    cy.on('layoutstop', () => {
      console.log('Layout has finished');
      // Stop animation or layout when done
    });

  }, [data]);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <div id="cy" style={{ height: '100%', width: '100%' }}></div>
    </div>
  );
};

// Function to render React icon component to an SVG string
const renderIcon = (icon) => {
  return ReactDOMServer.renderToStaticMarkup(icon);
};

// Function to transform the user data into Cytoscape elements
const createCytoscapeData = (data) => {
  const elements = [];

  if (Array.isArray(data) && data.length > 0 && data[0].mac_data) {
    const macData = data[0].mac_data;

    macData.forEach((category) => {
      Object.keys(category).forEach((deviceType) => {
        category[deviceType].forEach((device) => {
          const macAddress = device.MAC;
          const vendor = device.Vendor;
          const status = device.Status;
          const cluster = device.Cluster || 'default_cluster';  // Add clustering info

          if (macAddress && device[macAddress]) {
            const mainNode = { 
              data: { id: macAddress, label: macAddress, type: deviceType.includes('OT') ? 'OT' : (deviceType.includes('IT') ? 'IT' : 'Other'), vendor, status, cluster }
            };
            elements.push(mainNode);

            device[macAddress].forEach((connectedMac) => {
              const protocol = device.Protocol || 'unknown';
              const connectedNode = { 
                data: { id: connectedMac, label: connectedMac, type: 'unknown', cluster }  // Ensure cluster info is passed
              };
              elements.push(connectedNode);

              const edge = { 
                data: { source: macAddress, target: connectedMac, protocol }
              };
              elements.push(edge);
            });
          }
        });
      });
    });
  } else {
    console.error("Data does not contain the expected structure or MAC addresses.");
  }

  return elements;
};

export default GraphComponent;
