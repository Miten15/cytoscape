// Helper function to process the data into D3 nodes and links
const createD3Data = (data) => {
  const nodes = [];
  const links = [];
  const uniqueNodes = new Set();

  // Ensure the data is in the expected format
  if (!Array.isArray(data) || !data.length || !data[0].mac_data) {
      console.error("Data does not contain the expected structure.");
      return { nodes, links };
  }

  const macData = data[0].mac_data;

  // Iterate through each device category in mac_data
  macData.forEach(deviceCategory => {
      Object.entries(deviceCategory).forEach(([category, devices]) => {
          devices.forEach(device => {
              const macAddress = device.MAC;
              const vendor = device.Vendor || "Unknown";
              const ip = device.IP || "N/A";
              const type = device.Type || category;
              const subnetMask = device.subnet_mask || "Unknown";
              const nodes = Array.isArray(data.nodes) ? data.nodes : [data.nodes];
              const edges = Array.isArray(data.edges) ? data.edges : [data.edges];
              
              // Add more logging for debugging
              if (!macAddress || macAddress === "00:00:00:00:00:00") {
                  console.error(`MAC address is invalid for device:`, device);
                  return; // Skip this device
              }

              if (!device.subnetMask || !device.MAC) {
                console.error(`Missing data for device: ${device._id || 'Unknown'}`);
                return;
             }
             

              // Create node if it doesn't exist and is not the placeholder MAC
              if (!uniqueNodes.has(macAddress)) {
                  uniqueNodes.add(macAddress);
                  nodes.push({
                      id: macAddress,
                      vendor,
                      type,
                      ip,
                      protocols: device.Protocol ? device.Protocol.join(", ") : "N/A",
                      subnetMask, // Add the subnet mask for nodes
                  });
              }

              // Check for connections and ensure they are valid
              Object.keys(device).forEach(key => {
                  const connections = device[key];
                  if (Array.isArray(connections)) {
                      connections.forEach(conn => {
                          console.log(`Processing connection: ${conn} for MAC Address: ${macAddress}`);
                          if (conn !== "00:00:00:00:00:00") {
                              if (uniqueNodes.has(conn)) {
                                  links.push({
                                      source: macAddress,
                                      target: conn,
                                  });
                              } else {
                                  console.warn(`Invalid connection: ${conn} (does not exist in nodes)`);
                              }
                          }
                      });
                  } else if (typeof connections === 'object') {
                      console.error(`Expected an array but got object for: ${key}`, connections);
                  }
              });
          });
      });
  });

  // Log nodes and links for debugging
  console.log('Nodes:', nodes);
  console.log('Links:', links);

  // Check for any links with invalid nodes
  links.forEach(link => {
      if (!uniqueNodes.has(link.target)) {
          console.error(`Link target not found: ${link.target}`);
      }
  });

  return { nodes, links }; // Return nodes and links for D3
};

// Example usage
const exampleData = [
  {
      mac_data: [
          {
              IT: [
                  { MAC: "00:0c:29:f7:ea:73", Vendor: "Vendor1", IP: "192.168.1.1", Protocol: ["TCP"], subnet_mask: "255.255.255.0" }
              ]
          },
          {
              OT: [
                  { MAC: "00:0c:29:fc:45:56", Vendor: "Vendor2", IP: "192.168.1.2", Protocol: ["UDP"], subnet_mask: "255.255.255.0" }
              ]
          }
      ]
  }
];

// Call the function
const { nodes, links } = createD3Data(exampleData);
console.log("Processed Nodes:", nodes);
console.log("Processed Links:", links);
