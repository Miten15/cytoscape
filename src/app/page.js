"use client";  // Necessary for using client-side hooks like useEffect

import React, { useEffect } from 'react';
import cytoscape from 'cytoscape';
import networkData from '../data/networkgraph.json';

const Page = () => {
  useEffect(() => {
    const elements = createCytoscapeData(networkData);

    const cy = cytoscape({
      container: document.getElementById('cy'),
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': function (ele) {
              const vendor = ele.data('vendor');
              return `${ele.data('label')} (${vendor})`;  // Show MAC and Vendor
            },
            'background-color': function(ele) {
              const deviceType = ele.data('type');
              return deviceType === 'IT' ? '#0074D9' : (deviceType === 'OT' ? '#FF4136' : '#2ECC40');
            },
            'font-size': '10px',
            'text-valign': 'center',
            'text-halign': 'center',
            'width': '30px',
            'height': '30px'
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

const createCytoscapeData = (data) => {
  const elements = [];

  if (Array.isArray(data) && data.length > 0 && data[0].mac_data) {
    const macData = data[0].mac_data;

    macData.forEach((category) => {
      Object.keys(category).forEach((deviceType) => {
        category[deviceType].forEach((device) => {
          const macAddress = device.MAC;
          const vendor = device.Vendor;   // Vendor info
          const status = device.Status;   // Status info

          if (macAddress && device[macAddress]) {
            // Each OT device is now treated separately
            const mainNode = { 
              data: { id: macAddress, label: macAddress, type: deviceType.includes('OT') ? 'OT' : (deviceType.includes('IT') ? 'IT' : 'Other'), vendor, status }
            };
            elements.push(mainNode);

            // Add connections (edges) based on connected MACs
            device[macAddress].forEach((connectedMac) => {
              const protocol = device.Protocol || 'unknown';  // Protocol info
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

export default Page;
