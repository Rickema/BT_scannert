export interface DeviceItem {
  name: string;
  address: string;
  rssi: number;
  type: "BLE" | "Classic";
  category: string;      // categoria principale (es. Audio, Tracker, Computer)
  uuids: string;         // UUID o service names
  manufacturer: string;  // produttore
  appearance: string;    // descrizione aspetto
  modelId: string;       // Fast Pair Model ID (se trovato)
  classificationType: string;
  classificationBrand: string;
  classificationConfidence: number;
  scanResult?: any;
  bluetoothDevice?: any;
}

export interface Classification {
  type: string;      // es. "Tracker", "Auricolari", "Smartwatch"
  brand: string;     // es. "Apple", "Samsung", "Sconosciuto"
  model: string;     // eventuale modello (es. "Fast Pair device")
  confidence: number; // 0..100
}

export interface SavedTargetDevice {
  name: string | null;
  mac: string | null;
  uuid: string | null;
  isSet: boolean;
  selectedAt?: number;
  lastSeen?: number;
  isNear?: boolean;
  rssi?: number;
}

export interface ScanRecordRaw {
  bytes?: Uint8Array | number[];
  serviceUuids?: string[];
  manufacturerSpecificData?: Map<number, Uint8Array | number[]> | { [companyId: number]: number[] };
  serviceData?: { [uuid: string]: number[] };
}
