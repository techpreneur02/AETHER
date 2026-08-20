export const deviceCatalog: Record<string, string[]> = {
  Cisco: ["Catalyst 9200", "Catalyst 9300", "Catalyst 9400", "Catalyst 9500", "Catalyst 9600", "Meraki MS250", "Meraki MS350", "ISR 4331", "ISR 4431", "ASR 1001-X"],
  "HPE Aruba": ["Aruba CX 6100", "Aruba CX 6200", "Aruba CX 6300", "Aruba CX 6400", "Aruba CX 8325", "Aruba 2930F", "Aruba AP-515", "Aruba AP-635"],
  Juniper: ["EX2300", "EX3400", "EX4100", "EX4650", "QFX5120", "SRX300", "SRX345", "Mist AP45"],
  Fortinet: ["FortiGate 40F", "FortiGate 60F", "FortiGate 100F", "FortiGate 200F", "FortiSwitch 148F", "FortiAP 231F"],
  "Palo Alto Networks": ["PA-220", "PA-400", "PA-800", "PA-1400", "PA-3400", "PA-5400", "PA-5450"],
  Ubiquiti: ["UniFi Dream Machine Pro", "UniFi Dream Machine SE", "UniFi USW-Pro-24", "UniFi USW-Pro-48", "UniFi U6 Pro", "UniFi U7 Pro"],
  Dell: ["PowerSwitch N1548", "PowerSwitch S4112F", "PowerSwitch S5248F", "PowerEdge R650", "PowerEdge R750", "PowerEdge R760"],
  Lenovo: ["ThinkSystem SR630", "ThinkSystem SR650", "ThinkSystem SR665", "ThinkSystem SR950"],
  APC: ["Smart-UPS 1500", "Smart-UPS 3000", "Smart-UPS SRT 5000", "NetShelter Rack PDU"],
  Axis: ["M2035-LE", "P3245-LVE", "Q3515-LVE", "Q6075-E"],
  Hikvision: ["DS-2CD2143G2", "DS-2CD2387G2", "DS-2DE7A425IWG", "DS-7732NI-I4"],
  Ruckus: ["R550", "R650", "R750", "R770", "ICX 7150", "ICX 7650"],
  MikroTik: ["hEX S", "RB5009", "CCR2004", "CRS326", "CRS354", "L009UiGS"],
  Synology: ["DS923+", "DS1522+", "RS1221+", "RS2423+"],
};

export const catalogVendors = Object.keys(deviceCatalog);
