import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface ScanFilter {
  serviceUUIDs: string[];
  rssiThreshold: number;
  allowDuplicates: boolean;
}

// Instead of using index signature [key: string]: number[], use a string map
// This is compatible with Codegen
export interface ManufacturerData {
  // Use a fixed set of possible keys with optional properties
  // This avoids the index signature that Codegen doesn't support
  companyIdentifiers: {
    data: number[];
    id: string;
  }[];
}

export interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  manufacturerData: ManufacturerData;
  serviceUUIDs: string[];
  isConnectable: boolean;
}

export interface Spec extends TurboModule {
  // Legacy function
  multiply(a: number, b: number): number;

  // Scan methods
  createScanFilter(
    serviceUUIDs: string[],
    rssiThreshold: number,
    allowDuplicates: boolean
  ): ScanFilter;

  startScan(filter: ScanFilter, callback: (device: BLEDevice) => void): void;
  stopScan(callback: (success: boolean, error: string) => void): void;
  isScanning(callback: (scanning: boolean) => void): void;

  // Connection methods
  connect(
    deviceId: string,
    callback: (success: boolean, deviceId: string, error: string) => void
  ): void;

  disconnect(
    deviceId: string,
    callback: (success: boolean, error: string) => void
  ): void;

  isConnected(deviceId: string, callback: (connected: boolean) => void): void;

  // GATT operations
  discoverServices(
    deviceId: string,
    callback: (success: boolean, error: string) => void
  ): void;

  getServices(deviceId: string, callback: (services: string[]) => void): void;

  getCharacteristics(
    deviceId: string,
    serviceId: string,
    callback: (characteristics: string[]) => void
  ): void;

  readCharacteristic(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    callback: (success: boolean, error: string) => void
  ): void;

  writeCharacteristic(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    data: number[],
    withResponse: boolean,
    callback: (success: boolean, error: string) => void
  ): void;

  subscribeToCharacteristic(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    callback: (characteristicId: string, data: number[]) => void,
    statusCallback: (success: boolean, error: string) => void
  ): void;

  unsubscribeFromCharacteristic(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    callback: (success: boolean, error: string) => void
  ): void;

  // Bluetooth state
  isBluetoothEnabled(callback: (enabled: boolean) => void): void;
  requestBluetoothEnable(
    callback: (success: boolean, error: string) => void
  ): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BluetoothNitroNexus');
