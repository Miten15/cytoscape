"use client";  // Necessary for using client-side hooks like useEffect

import React, { useEffect } from 'react';
import cytoscape from 'cytoscape';
import networkData from '../data/networkgraph.json';  // Assuming the JSON data is in this file

import { FaDesktop, FaServer } from 'react-icons/fa';
import ReactDOMServer from 'react-dom/server';  // This allows us to render React components to strings

const GraphComponent= () => {
  useEffect(() => {
    const elements = createCytoscapeData(networkData);

    const cy = cytoscape({
      container: document.getElementById('cy'),
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-image': function(ele) {
              // Use icons as background images
              const deviceType = ele.data('type');
              if (deviceType === 'IT') return `data:image/svg+xml,${encodeURIComponent(renderIcon(<FaDesktop />))}`;
              if (deviceType === 'OT') return `data:image/svg+xml,${encodeURIComponent(renderIcon(<FaServer />))}`;
              return `data:image/svg+xml,${encodeURIComponent(renderIcon(<FaDesktop />))}`;  // Default icon
            },
            'background-fit': 'cover',
            'background-opacity': 0.9,
            'label': function(ele) {
              const vendor = ele.data('vendor');
              return `${ele.data('label')} (${vendor})`;
            },
            'font-size': '10px',
            'text-valign': 'center',
            'text-halign': 'center',
            'width': '40px',  // Adjust size of the node to fit the icon
            'height': '40px',
            'border-width': 2,
            'border-color': '#ccc'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
           // 'label': 'data(protocol)',  // Display protocol on edges
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        }
      ],
      layout: {
        name: 'concentric',  // Group nodes by type
        concentric: function(node) {
          return node.data('type') === 'IT' ? 3 : (node.data('type') === 'OT' ? 2 : 1);
        },
        levelWidth: function(nodes) {
          return 1;
        },
        padding: 10,
        animate: true,
        animationDuration: 1000
      }
    });
  }, []);

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

          if (macAddress && device[macAddress]) {
            const mainNode = { 
              data: { id: macAddress, label: macAddress, type: deviceType.includes('OT') ? 'OT' : (deviceType.includes('IT') ? 'IT' : 'Other'), vendor, status }
            };
            elements.push(mainNode);

            device[macAddress].forEach((connectedMac) => {
              const protocol = device.Protocol || 'unknown';
              const connectedNode = { 
                data: { id: connectedMac, label: connectedMac, type: 'unknown' }
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