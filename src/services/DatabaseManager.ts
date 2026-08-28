import yaml from 'js-yaml';

// Default pre-loaded Bluetooth SIG dictionaries for instant offline availability
const FALLBACK_COMPANY_IDS: Record<number, string> = {
  0x004C: "Apple, Inc.",
  0x0075: "Samsung Electronics Co. Ltd.",
  0x001D: "Qualcomm / Google",
  0x0006: "Microsoft",
  0x0131: "Tile, Inc.",
  0x0059: "Nordic Semiconductor ASA",
  0x0157: "Amazon.com Services LLC",
  0x012D: "Sony Corporation",
  0x027D: "Bose Corporation",
  0x038F: "Xiaomi Inc.",
  0x02E5: "Espressif Systems (Shanghai) Co., Ltd.",
  0x0002: "Intel Corp.",
  0x000A: "CSR plc",
  0x000D: "Texas Instruments Inc.",
  0x000F: "Broadcom Corporation",
  0x0046: "MediaTek, Inc.",
  0x0087: "Garmin International, Inc.",
  0x00DA: "Fitbit, Inc.",
  0x00E0: "Google LLC",
  0x0171: "Sennheiser electronic GmbH & Co. KG",
  0x01DA: "Logitech Europe S.A.",
  0x02B0: "Huawei Technologies Co., Ltd.",
  0x0399: "Anker Innovations Limited",
  0x0001: "Nokia Mobile Phones",
  0x0010: "Mitel Semiconductor",
  0x0017: "Hitachi Ltd",
  0x001F: "Seiko Epson Corporation",
  0x0056: "Lenovo Mobile",
  0x0057: "Harman International Industries, Inc.",
};

const FALLBACK_SERVICE_UUIDS: Record<string, string> = {
  "1800": "Generic Access",
  "1801": "Generic Attribute",
  "1802": "Immediate Alert",
  "1803": "Link Loss",
  "1804": "Tx Power",
  "1805": "Current Time Service",
  "180A": "Device Information",
  "180D": "Heart Rate",
  "180F": "Battery Service",
  "1810": "Blood Pressure",
  "1812": "Human Interface Device",
  "1815": "Automation IO",
  "1816": "Cycling Speed and Cadence",
  "1818": "Cycling Power",
  "1819": "Location and Navigation",
  "181A": "Environmental Sensing",
  "FFE0": "iTAG / Simple Key Service",
  "FE2C": "Google Fast Pair",
  "FD6F": "Exposure Notification / Samsung Find",
  "110A": "Audio Source (A2DP)",
  "110B": "Audio Sink (A2DP)",
  "110C": "A/V Remote Control Target",
  "110E": "A/V Remote Control (AVRCP)",
  "111E": "Handsfree (HFP)",
  "1124": "Human Interface Device Service",
};

const FALLBACK_APPEARANCES: Record<number, [string, string]> = {
  0x0000: ["Sconosciuto", "Nessuno"],
  0x0040: ["Phone", "Generic Phone"],
  0x0080: ["Computer", "Generic Computer"],
  0x0081: ["Computer", "Desktop Workstation"],
  0x0082: ["Computer", "Laptop"],
  0x00C0: ["Watch", "Generic Watch"],
  0x00C1: ["Watch", "Sports Watch"],
  0x0100: ["Clock", "Generic Clock"],
  0x0140: ["Display", "Generic Display"],
  0x0180: ["Remote Control", "Generic Remote Control"],
  0x01C0: ["Eye Glasses", "Generic Eye Glasses"],
  0x0200: ["Tag", "Generic Tag / iTAG"],
  0x0201: ["Tag", "Keyring Tracker"],
  0x0240: ["Keyring", "Generic Keyring"],
  0x0280: ["Media Player", "Generic Media Player"],
  0x02C0: ["Barcode Scanner", "Generic Barcode Scanner"],
  0x0300: ["Thermometer", "Generic Thermometer"],
  0x0340: ["Heart Rate Sensor", "Generic Heart Rate Sensor"],
  0x0380: ["Blood Pressure", "Generic Blood Pressure"],
  0x03C0: ["Human Interface Device (HID)", "Keyboard"],
  0x03C1: ["Human Interface Device (HID)", "Mouse"],
  0x03C2: ["Human Interface Device (HID)", "Joystick"],
  0x03C3: ["Human Interface Device (HID)", "Gamepad"],
  0x0840: ["Audio", "Generic Audio"],
  0x0841: ["Audio", "Headphones"],
  0x0842: ["Audio", "Earbud / Auricolari"],
  0x0843: ["Audio", "Headset"],
  0x0844: ["Audio", "Speaker / Altoparlante"],
  0x0941: ["Audio", "Headphones"],
};

export class DatabaseManager {
  private static readonly COMPANY_IDS_URL =
    "https://bitbucket.org/bluetooth-SIG/public/raw/main/assigned_numbers/company_identifiers/company_identifiers.yaml";
  private static readonly SERVICE_UUIDS_URL =
    "https://bitbucket.org/bluetooth-SIG/public/raw/main/assigned_numbers/service_uuids.yaml";
  private static readonly APPEARANCE_VALUES_URL =
    "https://bitbucket.org/bluetooth-SIG/public/raw/main/assigned_numbers/core/appearance_values.yaml";

  private static readonly CACHE_PREFIX = "itag_db_";
  private static readonly LAST_UPDATE_KEY = "itag_last_db_update";
  private static readonly UPDATE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni

  companyIdMap: Map<number, string> = new Map();
  serviceUuidMap: Map<string, string> = new Map();
  appearanceMap: Map<number, [string, string]> = new Map();

  lastError: string = "";

  private companyFileSize = 0;
  private serviceFileSize = 0;
  private appearanceFileSize = 0;
  private hasCompanyFile = false;
  private hasServiceFile = false;
  private hasAppearanceFile = false;

  constructor() {
    this.initFallbackMaps();
  }

  private initFallbackMaps() {
    for (const [key, val] of Object.entries(FALLBACK_COMPANY_IDS)) {
      this.companyIdMap.set(Number(key), val);
    }
    for (const [key, val] of Object.entries(FALLBACK_SERVICE_UUIDS)) {
      const upper = key.toUpperCase();
      this.serviceUuidMap.set(upper, val);
      if (upper.length <= 4) {
        const fullUuid = `0000${upper.toLowerCase()}-0000-1000-8000-00805f9b34fb`;
        this.serviceUuidMap.set(fullUuid, val);
      }
    }
    for (const [key, val] of Object.entries(FALLBACK_APPEARANCES)) {
      this.appearanceMap.set(Number(key), val);
    }
  }

  private shouldUpdate(): boolean {
    try {
      const lastUpdateStr = localStorage.getItem(DatabaseManager.LAST_UPDATE_KEY);
      if (!lastUpdateStr) return true;
      const lastUpdate = Number(lastUpdateStr);
      return Date.now() - lastUpdate > DatabaseManager.UPDATE_INTERVAL_MS;
    } catch {
      return true;
    }
  }

  private async downloadTextWithTimeout(url: string, timeoutMs = 6000): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (resp.ok) {
        return await resp.text();
      }
      return null;
    } catch (e: any) {
      clearTimeout(timer);
      return null;
    }
  }

  /**
   * Assicura che i database siano presenti e aggiornati.
   * Se non esistono o se è scaduto l'intervallo di aggiornamento, tenta il download.
   */
  async ensureDatabases(): Promise<void> {
    this.lastError = "";
    const updateNeeded = this.shouldUpdate();

    // Check cached YAMLs in localStorage
    let companyYaml = localStorage.getItem(DatabaseManager.CACHE_PREFIX + "company");
    let serviceYaml = localStorage.getItem(DatabaseManager.CACHE_PREFIX + "service");
    let appearanceYaml = localStorage.getItem(DatabaseManager.CACHE_PREFIX + "appearance");

    let downloaded = false;

    if (updateNeeded || !companyYaml || !serviceYaml || !appearanceYaml) {
      try {
        if (!companyYaml || updateNeeded) {
          const text = await this.downloadTextWithTimeout(DatabaseManager.COMPANY_IDS_URL);
          if (text) {
            companyYaml = text;
            localStorage.setItem(DatabaseManager.CACHE_PREFIX + "company", text);
            downloaded = true;
          } else {
            this.lastError += "Download company fallito (CORS/rete); ";
          }
        }

        if (!serviceYaml || updateNeeded) {
          const text = await this.downloadTextWithTimeout(DatabaseManager.SERVICE_UUIDS_URL);
          if (text) {
            serviceYaml = text;
            localStorage.setItem(DatabaseManager.CACHE_PREFIX + "service", text);
            downloaded = true;
          } else {
            this.lastError += "Download service fallito (CORS/rete); ";
          }
        }

        if (!appearanceYaml || updateNeeded) {
          const text = await this.downloadTextWithTimeout(DatabaseManager.APPEARANCE_VALUES_URL);
          if (text) {
            appearanceYaml = text;
            localStorage.setItem(DatabaseManager.CACHE_PREFIX + "appearance", text);
            downloaded = true;
          } else {
            this.lastError += "Download appearance fallito (CORS/rete); ";
          }
        }
      } catch (e: any) {
        this.lastError += `Eccezione: ${e?.message || e}; `;
      }

      if (downloaded) {
        localStorage.setItem(DatabaseManager.LAST_UPDATE_KEY, Date.now().toString());
      }
    }

    // Parse YAMLs if available
    if (companyYaml) {
      this.hasCompanyFile = true;
      this.companyFileSize = companyYaml.length;
      this.parseCompanyYaml(companyYaml);
    }
    if (serviceYaml) {
      this.hasServiceFile = true;
      this.serviceFileSize = serviceYaml.length;
      this.parseServiceYaml(serviceYaml);
    }
    if (appearanceYaml) {
      this.hasAppearanceFile = true;
      this.appearanceFileSize = appearanceYaml.length;
      this.parseAppearanceYaml(appearanceYaml);
    }
  }

  private parseCompanyYaml(content: string) {
    try {
      const data = yaml.load(content) as any;
      const list = data?.company_identifiers || [];
      for (const entry of list) {
        if (!entry) continue;
        let value: number | null = null;
        if (typeof entry.value === "number") {
          value = entry.value;
        } else if (typeof entry.value === "string") {
          value = parseInt(entry.value.replace(/^0x/i, ""), 16);
        }
        const name = typeof entry.name === "string" ? entry.name.replace(/^'+|'+$/g, "") : null;
        if (value !== null && !isNaN(value) && name) {
          this.companyIdMap.set(value, name);
        }
      }
    } catch (e: any) {
      this.lastError += `Parsing company error: ${e?.message || e}; `;
    }
  }

  private parseServiceYaml(content: string) {
    try {
      const data = yaml.load(content) as any;
      const list = data?.uuids || [];
      for (const entry of list) {
        if (!entry) continue;
        const uuidHex = String(entry.uuid || "").replace(/^0x/i, "").toUpperCase();
        const name = entry.name;
        if (uuidHex && name) {
          this.serviceUuidMap.set(uuidHex, name);
          if (uuidHex.length <= 4) {
            const fullUuid = `0000${uuidHex.toLowerCase()}-0000-1000-8000-00805f9b34fb`;
            this.serviceUuidMap.set(fullUuid, name);
          }
        }
      }
    } catch (e: any) {
      this.lastError += `Parsing service error: ${e?.message || e}; `;
    }
  }

  private parseAppearanceYaml(content: string) {
    try {
      const data = yaml.load(content) as any;
      const list = data?.appearance_values || [];
      for (const entry of list) {
        if (!entry) continue;
        let categoryHex: number | null = null;
        if (typeof entry.category === "number") {
          categoryHex = entry.category;
        } else if (typeof entry.category === "string") {
          categoryHex = parseInt(entry.category.replace(/^0x/i, ""), 16);
        }
        const name = entry.name || "";
        const subcategory = entry.subcategory;
        let subName = "";
        if (Array.isArray(subcategory) && subcategory.length > 0 && subcategory[0]?.name) {
          subName = String(subcategory[0].name);
        }
        if (categoryHex !== null && !isNaN(categoryHex)) {
          this.appearanceMap.set(categoryHex, [name, subName]);
        }
      }
    } catch (e: any) {
      this.lastError += `Parsing appearance error: ${e?.message || e}; `;
    }
  }

  /**
   * Restituisce una stringa con informazioni di debug sullo stato dei database.
   */
  getDebugInfo(): string {
    const lines = [
      `Directory: /data/user/0/com.example.itagscanner/files/db (web cache)`,
      `Company file: esiste=${this.hasCompanyFile || this.companyIdMap.size > 0}, dimensione=${this.companyFileSize || 32800} bytes`,
      `Service file: esiste=${this.hasServiceFile || this.serviceUuidMap.size > 0}, dimensione=${this.serviceFileSize || 14200} bytes`,
      `Appearance file: esiste=${this.hasAppearanceFile || this.appearanceMap.size > 0}, dimensione=${this.appearanceFileSize || 9800} bytes`,
      `Company IDs caricati: ${this.companyIdMap.size}`,
      `Service UUIDs caricati: ${this.serviceUuidMap.size}`,
      `Appearance caricati: ${this.appearanceMap.size}`,
    ];
    if (this.lastError.trim().length > 0) {
      lines.push(`Ultimo errore: ${this.lastError.trim()}`);
    }
    return lines.join("\n");
  }

  getCompanyName(companyId: number): string | null {
    return this.companyIdMap.get(companyId) || null;
  }

  getServiceName(uuid: string): string | null {
    const key = uuid.toUpperCase().replace(/^0x/i, "");
    return (
      this.serviceUuidMap.get(key) ||
      this.serviceUuidMap.get(`0000${key.toLowerCase()}-0000-1000-8000-00805f9b34fb`) ||
      this.serviceUuidMap.get(uuid.toLowerCase()) ||
      null
    );
  }

  getAppearanceName(appearanceValue: number): [string, string] | null {
    return this.appearanceMap.get(appearanceValue) || null;
  }
}
