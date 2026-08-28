import { Constants } from '../constants';
import { DeviceItem, SavedTargetDevice } from '../types';

export type ScannerServiceListener = (event: {
  type: "SCAN_UPDATE" | "STATUS_UPDATE" | "ACTION_NEAR" | "ACTION_FAR";
  payload?: any;
}) => void;

export class ScannerService {
  private static instance: ScannerService | null = null;

  private isNear = false;
  private lastSeenTimestamp = 0;
  private nearTimer: any = null;
  private farTimer: any = null;

  private targetMac: string | null = null;
  private targetName: string | null = null;
  private targetUuid: string | null = null;
  private isTargetSet = false;

  private statusUpdateInterval = 10000; // default 10s
  private statusTimer: any = null;

  private listeners: Set<ScannerServiceListener> = new Set();
  private isRunning = false;

  static getInstance(): ScannerService {
    if (!ScannerService.instance) {
      ScannerService.instance = new ScannerService();
    }
    return ScannerService.instance;
  }

  constructor() {
    this.loadTargetFromStorage();
  }

  loadTargetFromStorage(): SavedTargetDevice {
    try {
      this.targetMac = localStorage.getItem("target_mac");
      this.targetName = localStorage.getItem("target_name");
      this.targetUuid = localStorage.getItem("target_uuid");
      this.isTargetSet = localStorage.getItem("target_set") === "true";
      const intervalStr = localStorage.getItem("update_interval");
      if (intervalStr) {
        this.statusUpdateInterval = Number(intervalStr) || 10000;
      }
    } catch (e) {
      console.warn("Could not read localStorage", e);
    }
    return this.getTargetDevice();
  }

  setTargetDevice(item: DeviceItem) {
    this.targetMac = item.address;
    this.targetName = item.name;
    this.targetUuid = item.uuids;
    this.isTargetSet = true;
    this.lastSeenTimestamp = Date.now();
    this.isNear = item.rssi >= Constants.RSSI_THRESHOLD;

    try {
      localStorage.setItem("target_mac", item.address);
      localStorage.setItem("target_name", item.name);
      localStorage.setItem("target_uuid", item.uuids);
      localStorage.setItem("target_set", "true");
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }

    this.startTracking();
  }

  clearTargetDevice() {
    this.stopTracking();
    this.targetMac = null;
    this.targetName = null;
    this.targetUuid = null;
    this.isTargetSet = false;
    this.isNear = false;
    this.lastSeenTimestamp = 0;

    try {
      localStorage.removeItem("target_mac");
      localStorage.removeItem("target_name");
      localStorage.removeItem("target_uuid");
      localStorage.setItem("target_set", "false");
    } catch (e) {
      console.warn("Could not remove from localStorage", e);
    }

    this.emit({ type: "STATUS_UPDATE", payload: { isNear: false, lastSeen: 0 } });
  }

  getTargetDevice(): SavedTargetDevice {
    return {
      name: this.targetName,
      mac: this.targetMac,
      uuid: this.targetUuid,
      isSet: this.isTargetSet,
      lastSeen: this.lastSeenTimestamp,
      isNear: this.isNear,
    };
  }

  startTracking() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startStatusUpdates();
  }

  stopTracking() {
    this.isRunning = false;
    this.stopStatusUpdates();
    if (this.nearTimer) {
      clearTimeout(this.nearTimer);
      this.nearTimer = null;
    }
    if (this.farTimer) {
      clearTimeout(this.farTimer);
      this.farTimer = null;
    }
  }

  subscribe(listener: ScannerServiceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: { type: "SCAN_UPDATE" | "STATUS_UPDATE" | "ACTION_NEAR" | "ACTION_FAR"; payload?: any }) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (e) {
        console.error("Error in listener", e);
      }
    });
  }

  /**
   * Process a device found in scan
   */
  processScanResult(device: DeviceItem) {
    if (!this.isTargetSet) return;

    const address = device.address;
    const name = device.name;
    const uuids = device.uuids;

    const matchesMac = Boolean(this.targetMac && address === this.targetMac);
    const matchesName = Boolean(this.targetName && name && name.toLowerCase() === this.targetName.toLowerCase());
    const matchesUuid = Boolean(
      this.targetUuid &&
        uuids &&
        (uuids.toLowerCase().includes(this.targetUuid.toLowerCase()) ||
          this.targetUuid.split(",").some((u) => uuids.toLowerCase().includes(u.trim().toLowerCase())))
    );

    if (matchesMac || matchesName || matchesUuid) {
      this.lastSeenTimestamp = Date.now();

      this.emit({
        type: "SCAN_UPDATE",
        payload: {
          name: name || "Sconosciuto",
          address: address,
          rssi: device.rssi,
          isNear: this.isNear,
          timestamp: this.lastSeenTimestamp,
        },
      });

      this.checkProximity(device.rssi);
    }
  }

  private checkProximity(rssi: number) {
    const nearCondition = rssi >= Constants.RSSI_THRESHOLD;

    if (nearCondition && !this.isNear) {
      if (!this.nearTimer) {
        this.nearTimer = setTimeout(() => {
          if (
            Date.now() - this.lastSeenTimestamp <= Constants.NEAR_DEBOUNCE_MS &&
            this.lastSeenTimestamp > 0 &&
            !this.isNear
          ) {
            this.isNear = true;
            this.playChime(true);
            this.emit({ type: "ACTION_NEAR", payload: { rssi, timestamp: Date.now() } });
          }
          this.nearTimer = null;
        }, Constants.NEAR_DEBOUNCE_MS);
      }
    } else if (!nearCondition && this.isNear) {
      if (!this.farTimer) {
        this.farTimer = setTimeout(() => {
          if (Date.now() - this.lastSeenTimestamp >= Constants.FAR_DEBOUNCE_MS) {
            this.isNear = false;
            this.playChime(false);
            this.emit({ type: "ACTION_FAR", payload: { rssi, timestamp: Date.now() } });
          }
          this.farTimer = null;
        }, Constants.FAR_DEBOUNCE_MS);
      }
    }
  }

  private startStatusUpdates() {
    this.stopStatusUpdates();
    this.statusTimer = setInterval(() => {
      // Check if absent for longer than FAR_DEBOUNCE_MS
      if (this.isNear && this.lastSeenTimestamp > 0 && Date.now() - this.lastSeenTimestamp >= Constants.FAR_DEBOUNCE_MS) {
        this.isNear = false;
        this.emit({ type: "ACTION_FAR", payload: { timestamp: Date.now() } });
      }

      this.emit({
        type: "STATUS_UPDATE",
        payload: {
          isNear: this.isNear,
          lastSeen: this.lastSeenTimestamp,
        },
      });
    }, this.statusUpdateInterval);
  }

  private stopStatusUpdates() {
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
  }

  private playChime(isNear: boolean) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isNear) {
        // High ascending tone for NEAR
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.36);
      } else {
        // Low descending tone for FAR
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        osc.frequency.exponentialRampToValueAtTime(261.63, ctx.currentTime + 0.25); // C4
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.41);
      }
    } catch {
      // Audio context might be restricted before user gesture
    }
  }
}
