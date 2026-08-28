import { Classification, ScanRecordRaw } from '../types';
import { DatabaseManager } from './DatabaseManager';

export class BluetoothFingerprinter {
  static readonly APPLE_ID = 0x004c;
  static readonly SAMSUNG_ID = 0x0075;
  static readonly GOOGLE_ID = 0x001d;
  static readonly MICROSOFT_ID = 0x0006;
  static readonly TILE_ID = 0x0131;
  static readonly NORDIC_ID = 0x0059;
  static readonly AMAZON_ID = 0x0157;

  constructor(private db: DatabaseManager) {}

  classify(scanRecord?: ScanRecordRaw | null): Classification {
    let score = 0;
    let type = "Sconosciuto";
    let brand = "Sconosciuto";
    let model = "N/D";

    if (!scanRecord) {
      return { type, brand, model, confidence: 0 };
    }

    // 1. Estrai Manufacturer ID e nome produttore
    let companyId: number | null = null;
    if (scanRecord.manufacturerSpecificData) {
      const keys = scanRecord.manufacturerSpecificData instanceof Map
        ? Array.from(scanRecord.manufacturerSpecificData.keys())
        : Object.keys(scanRecord.manufacturerSpecificData).map(Number);

      if (keys.length > 0) {
        companyId = keys[0];
        brand = this.db.getCompanyName(companyId) || `0x${companyId.toString(16).toUpperCase()}`;
        score += 20;
      }
    }

    // 2. Estrai Service UUIDs
    const serviceUuids = (scanRecord.serviceUuids || []).map((u) => u.toLowerCase());

    // 3. Estrai Appearance
    const appearanceValue = this.extractAppearance(scanRecord);
    const appearanceName =
      appearanceValue !== null
        ? this.db.getAppearanceName(appearanceValue)?.[0] || "N/D"
        : "N/D";

    // 4. Regole di classificazione
    // 4a. Tracker generici: UUID FFE0 o manufacturer sconosciuto ma con UUID simile
    if (
      serviceUuids.some(
        (u) =>
          u === "0000ffe0-0000-1000-8000-00805f9b34fb" ||
          u === "ffe0" ||
          u.includes("ffe0")
      )
    ) {
      type = "Tracker";
      score += 30;
    }

    // 4b. Dispositivi audio: appearance o UUID audio
    const audioUuids = [
      "0000110b-0000-1000-8000-00805f9b34fb", // A2DP Sink
      "0000110e-0000-1000-8000-00805f9b34fb", // AVRCP
      "0000111e-0000-1000-8000-00805f9b34fb", // HFP
      "110b",
      "110e",
      "111e"
    ];

    if (appearanceValue !== null && appearanceValue >= 0x0080 && appearanceValue <= 0x00ff) {
      type = "Audio";
      score += 40;
    } else if (
      appearanceValue !== null &&
      (appearanceValue === 0x0840 ||
       appearanceValue === 0x0841 ||
       appearanceValue === 0x0842 ||
       appearanceValue === 0x0843 ||
       appearanceValue === 0x0941)
    ) {
      type = "Audio";
      score += 40;
    } else if (serviceUuids.some((u) => audioUuids.includes(u))) {
      type = "Audio";
      score += 40;
    }

    // 4c. Apple specifico
    if (companyId === BluetoothFingerprinter.APPLE_ID) {
      brand = "Apple";
      score += 10;
      if (
        serviceUuids.some(
          (u) =>
            u === "0000fe2c-0000-1000-8000-00805f9b34fb" ||
            u === "fe2c" ||
            u.includes("fe2c")
        )
      ) {
        type = "Fast Pair device";
        model = this.parseFastPairModelId(scanRecord);
        score += 50;
      }
    }

    // 4d. Samsung specifico
    if (companyId === BluetoothFingerprinter.SAMSUNG_ID) {
      brand = "Samsung";
      score += 10;
      if (serviceUuids.some((u) => u.startsWith("0000fd") || u.startsWith("fd"))) {
        type = "SmartTag/Find";
        score += 40;
      }
    }

    // 4e. Tile tracker
    if (companyId === BluetoothFingerprinter.TILE_ID) {
      brand = "Tile";
      type = "Tracker";
      score += 50;
    }

    // 4f. Se appearance è nota, usala
    if (appearanceName !== "N/D" && type === "Sconosciuto") {
      type = appearanceName;
      score += 20;
    }

    // Limita score a 100
    const finalScore = Math.min(score, 100);
    return { type, brand, model, confidence: finalScore };
  }

  extractAppearance(scanRecord: ScanRecordRaw): number | null {
    const bytes = scanRecord.bytes;
    if (!bytes || bytes.length === 0) return null;

    let i = 0;
    while (i < bytes.length) {
      const length = bytes[i] & 0xff;
      if (length === 0) break;
      if (i + 1 >= bytes.length) break;
      const type = bytes[i + 1] & 0xff;
      if (type === 0x19) {
        // GAP Appearance
        if (length >= 3 && i + 3 < bytes.length) {
          return (bytes[i + 2] & 0xff) | ((bytes[i + 3] & 0xff) << 8);
        }
      }
      i += length + 1;
    }
    return null;
  }

  parseFastPairModelId(scanRecord: ScanRecordRaw): string {
    const serviceData = scanRecord.serviceData;
    if (!serviceData) return "N/D";

    // Lookup 0000fe2c-0000-1000-8000-00805f9b34fb or fe2c
    let data: number[] | Uint8Array | undefined;
    for (const [key, val] of Object.entries(serviceData)) {
      if (
        key.toLowerCase() === "0000fe2c-0000-1000-8000-00805f9b34fb" ||
        key.toLowerCase() === "fe2c" ||
        key.toLowerCase().includes("fe2c")
      ) {
        data = val;
        break;
      }
    }

    if (!data || data.length < 3) return "N/D";
    const toHex = (n: number) => (n & 0xff).toString(16).padStart(2, "0").toUpperCase();
    return `${toHex(data[0])}:${toHex(data[1])}:${toHex(data[2])}`;
  }
}
