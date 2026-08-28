import { DeviceItem, ScanRecordRaw } from '../types';
import { BluetoothFingerprinter } from './BluetoothFingerprinter';
import { DatabaseManager } from './DatabaseManager';

interface RawAdvertisementDevice {
  name: string;
  address: string;
  baseRssi: number;
  type: "BLE" | "Classic";
  classicCategory?: string;
  companyId?: number;
  serviceUuids?: string[];
  serviceData?: { [uuid: string]: number[] };
  appearanceValue?: number;
  rawBytes?: number[];
}

const PRESET_DEVICES: RawAdvertisementDevice[] = [
  {
    name: "iTAG",
    address: "FC:58:FA:82:11:4E",
    baseRssi: -72,
    type: "BLE",
    companyId: 0x0059, // Nordic Semiconductor
    serviceUuids: ["0000ffe0-0000-1000-8000-00805f9b34fb", "180f", "1800"],
    appearanceValue: 0x0200, // Tag
    rawBytes: [0x02, 0x01, 0x06, 0x03, 0x19, 0x00, 0x02, 0x05, 0x09, 0x69, 0x54, 0x41, 0x47],
  },
  {
    name: "AirTag Tracker",
    address: "4A:8C:3B:19:92:DF",
    baseRssi: -68,
    type: "BLE",
    companyId: 0x004C, // Apple
    serviceUuids: ["0000fe2c-0000-1000-8000-00805f9b34fb", "180a"],
    serviceData: {
      "0000fe2c-0000-1000-8000-00805f9b34fb": [0x2A, 0x1B, 0x0C, 0x44],
    },
    appearanceValue: 0x0201, // Keyring
    rawBytes: [0x02, 0x01, 0x1a, 0x03, 0x19, 0x01, 0x02],
  },
  {
    name: "Galaxy SmartTag2",
    address: "78:4F:43:88:21:04",
    baseRssi: -77,
    type: "BLE",
    companyId: 0x0075, // Samsung
    serviceUuids: ["0000fd6f-0000-1000-8000-00805f9b34fb", "180f"],
    appearanceValue: 0x0200, // Tag
    rawBytes: [0x02, 0x01, 0x06, 0x03, 0x19, 0x00, 0x02],
  },
  {
    name: "Tile Pro Tracker",
    address: "D0:03:4B:91:E2:88",
    baseRssi: -80,
    type: "BLE",
    companyId: 0x0131, // Tile
    serviceUuids: ["180a", "180f", "feed"],
    appearanceValue: 0x0200, // Tag
    rawBytes: [0x02, 0x01, 0x06, 0x03, 0x19, 0x00, 0x02],
  },
  {
    name: "WH-1000XM4 Audio",
    address: "00:18:09:A3:89:12",
    baseRssi: -64,
    type: "BLE",
    companyId: 0x012D, // Sony
    serviceUuids: [
      "0000110b-0000-1000-8000-00805f9b34fb",
      "0000110e-0000-1000-8000-00805f9b34fb",
    ],
    appearanceValue: 0x0941, // Headphones
    rawBytes: [0x02, 0x01, 0x04, 0x03, 0x19, 0x41, 0x09],
  },
  {
    name: "Pixel Buds Pro",
    address: "94:08:53:C2:77:E1",
    baseRssi: -73,
    type: "BLE",
    companyId: 0x001D, // Qualcomm / Google
    serviceUuids: [
      "0000110b-0000-1000-8000-00805f9b34fb",
      "0000fe2c-0000-1000-8000-00805f9b34fb",
    ],
    appearanceValue: 0x0842, // Earbud
    rawBytes: [0x02, 0x01, 0x06, 0x03, 0x19, 0x42, 0x08],
  },
  {
    name: "Laptop Workstation",
    address: "BC:D0:74:10:55:A2",
    baseRssi: -79,
    type: "Classic",
    classicCategory: "Computer",
  },
  {
    name: "BT Audio Soundbar",
    address: "24:F5:AA:71:09:88",
    baseRssi: -83,
    type: "Classic",
    classicCategory: "Audio/Video",
  },
];

export class BluetoothScanner {
  private scanning = false;
  private timer: any = null;
  private onDeviceDiscovered: (device: DeviceItem) => void;
  private dbManager: DatabaseManager;
  private fingerprinter: BluetoothFingerprinter;
  private minRssi: number = -75;
  private includeClassic: boolean = false;

  constructor(
    dbManager: DatabaseManager,
    fingerprinter: BluetoothFingerprinter,
    onDeviceDiscovered: (device: DeviceItem) => void
  ) {
    this.dbManager = dbManager;
    this.fingerprinter = fingerprinter;
    this.onDeviceDiscovered = onDeviceDiscovered;
  }

  setMinRssi(rssi: number) {
    this.minRssi = rssi;
  }

  setIncludeClassic(include: boolean) {
    this.includeClassic = include;
  }

  isScanning(): boolean {
    return this.scanning;
  }

  startScan() {
    if (this.scanning) return;
    this.scanning = true;

    // Trigger initial burst of discovery
    let index = 0;
    const emitNext = () => {
      if (!this.scanning) return;

      const filteredPresets = PRESET_DEVICES.filter((d) => {
        if (d.type === "Classic" && !this.includeClassic) return false;
        return true;
      });

      if (filteredPresets.length > 0) {
        const raw = filteredPresets[index % filteredPresets.length];
        index++;

        // Add realistic RSSI fluctuation +/- 4 dBm
        const jitter = Math.floor((Math.random() - 0.5) * 8);
        const currentRssi = raw.baseRssi + jitter;

        if (currentRssi >= this.minRssi) {
          const deviceItem = this.convertRawToDeviceItem(raw, currentRssi);
          this.onDeviceDiscovered(deviceItem);
        }
      }

      // Schedule next advertisement packet (every 800ms - 1500ms like real BLE advertising interval)
      const nextDelay = 700 + Math.floor(Math.random() * 800);
      this.timer = setTimeout(emitNext, nextDelay);
    };

    emitNext();
  }

  stopScan() {
    this.scanning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async triggerWebBluetoothPairing(): Promise<DeviceItem | null> {
    if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
      throw new Error("Web Bluetooth API non è supportata in questo browser.");
    }

    try {
      const navBt = (navigator as any).bluetooth;
      const device = await navBt.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["battery_service", "device_information", "0000ffe0-0000-1000-8000-00805f9b34fb"],
      });

      const item: DeviceItem = {
        name: device.name || "Dispositivo Web Bluetooth",
        address: device.id || "WEB-BLE-DEVICE",
        rssi: -65,
        type: "BLE",
        category: "Web Bluetooth",
        uuids: "battery_service, device_information",
        manufacturer: "Dispositivo Connesso",
        appearance: "N/D",
        modelId: "N/D",
        classificationType: "BLE",
        classificationBrand: "Accoppiato",
        classificationConfidence: 90,
        bluetoothDevice: device,
      };

      this.onDeviceDiscovered(item);
      return item;
    } catch (e: any) {
      if (e?.name === "NotFoundError") {
        // User cancelled selection
        return null;
      }
      throw e;
    }
  }

  private convertRawToDeviceItem(raw: RawAdvertisementDevice, rssi: number): DeviceItem {
    if (raw.type === "Classic") {
      return {
        name: raw.name,
        address: raw.address,
        rssi: rssi,
        type: "Classic",
        category: raw.classicCategory || "Altro",
        uuids: "N/D",
        manufacturer: "N/D",
        appearance: "N/D",
        modelId: "N/D",
        classificationType: raw.classicCategory || "Altro",
        classificationBrand: "Sconosciuto",
        classificationConfidence: 50,
      };
    }

    // Build ScanRecordRaw
    const manufacturerData = new Map<number, number[]>();
    if (raw.companyId !== undefined) {
      manufacturerData.set(raw.companyId, [0x01, 0x02]);
    }

    const scanRecord: ScanRecordRaw = {
      bytes: raw.rawBytes,
      serviceUuids: raw.serviceUuids,
      manufacturerSpecificData: manufacturerData,
      serviceData: raw.serviceData,
    };

    const classification = this.fingerprinter.classify(scanRecord);

    // Format UUIDs with SIG names
    const uuidsStr =
      raw.serviceUuids && raw.serviceUuids.length > 0
        ? raw.serviceUuids.map((u) => this.dbManager.getServiceName(u) || u).join(", ")
        : "N/D";

    // Format manufacturer
    let manufacturerStr = "N/D";
    if (raw.companyId !== undefined) {
      const compName = this.dbManager.getCompanyName(raw.companyId) || `0x${raw.companyId.toString(16).toUpperCase()}`;
      manufacturerStr = `${compName} (${raw.companyId})`;
    }

    // Format appearance
    let appearanceStr = "N/D";
    if (raw.appearanceValue !== undefined) {
      const appInfo = this.dbManager.getAppearanceName(raw.appearanceValue);
      appearanceStr = appInfo ? appInfo[0] : "N/D";
    }

    // Format modelId
    const modelIdStr = this.fingerprinter.parseFastPairModelId(scanRecord);

    return {
      name: raw.name,
      address: raw.address,
      rssi: rssi,
      type: "BLE",
      category: classification.type,
      uuids: uuidsStr,
      manufacturer: manufacturerStr,
      appearance: appearanceStr,
      modelId: modelIdStr,
      classificationType: classification.type,
      classificationBrand: classification.brand,
      classificationConfidence: classification.confidence,
    };
  }
}
