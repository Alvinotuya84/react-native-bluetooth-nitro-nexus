# Bluetooth Nitro Nexus

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-ios-green.svg)
![React Native](https://img.shields.io/badge/react--native-%3E%3D0.70.0-brightgreen)

A high-performance Bluetooth Low Energy (BLE) module for React Native applications targeting iOS devices. Built with modern C++ and Objective-C++ for seamless native integration via TurboModules.

## Overview

Bluetooth Nitro Nexus provides an efficient bridge between React Native and iOS CoreBluetooth functionality through a layered architecture:

- C++ core implementation for the Bluetooth stack abstraction
- Objective-C++ wrapper for iOS CoreBluetooth integration
- TurboModule interface for TypeScript/JavaScript access

This architecture enables efficient memory management and type-safe operations across the entire stack.

## Current Status

- ✅ iOS support with CoreBluetooth
- ⏳ Android support planned for future releases

## Installation

```bash
npm install react-native-bluetooth-nitro-nexus
# or
yarn add react-native-bluetooth-nitro-nexus
```

### iOS Setup

Add the following to your `Podfile`:

```ruby
pod 'react-native-bluetooth-nitro-nexus', :path => '../node_modules/react-native-bluetooth-nitro-nexus'
```

Add the NSBluetoothAlwaysUsageDescription key to your Info.plist:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>This app uses Bluetooth to connect to nearby devices</string>
```

## Technical Architecture

Bluetooth Nitro Nexus is built on a multi-layer architecture:

1. **C++ Core Implementation (`BluetoothNexusCore`)**

   - Provides a portable, non-platform-specific interface
   - Manages device discovery, connection state, and GATT operations
   - Implements singleton pattern for consistent access across the application

2. **Objective-C++ iOS Bridge (`BluetoothNitroNexus`)**

   - Wraps CoreBluetooth functionality in an Objective-C++ interface
   - Bridges between the C++ core and iOS-specific implementation
   - Manages memory and lifecycle of CoreBluetooth objects

3. **TurboModule TypeScript Interface**
   - Type-safe interface for JavaScript application code
   - Provides Promise-based API with minimal overhead
   - Built on the TurboModule system for direct native communication

## Basic Usage

```typescript
import BluetoothNexus, { ScanFilter } from 'react-native-bluetooth-nitro-nexus';

// Check if Bluetooth is enabled
const isEnabled = await BluetoothNexus.isBluetoothEnabled();
if (!isEnabled) {
  await BluetoothNexus.requestBluetoothEnable();
}

// Scan for devices
const filter: ScanFilter = {
  serviceUUIDs: [], // Empty to discover all
  rssiThreshold: -80, // Only show devices with RSSI greater than -80 dBm
  allowDuplicates: false,
};

await BluetoothNexus.startScan(filter, (device) => {
  console.log('Device found:', device.name, device.id);
});

// Connect to a device
const deviceId = await BluetoothNexus.connect('00:11:22:33:44:55');

// Discover services
await BluetoothNexus.discoverServices(deviceId);
const services = await BluetoothNexus.getServices(deviceId);

// Get characteristics for a service
const characteristics = await BluetoothNexus.getCharacteristics(
  deviceId,
  services[0]
);

// Read a characteristic
await BluetoothNexus.readCharacteristic(
  deviceId,
  services[0],
  characteristics[0]
);

// Write to a characteristic
const data = [0x01, 0x02, 0x03];
await BluetoothNexus.writeCharacteristic(
  deviceId,
  services[0],
  characteristics[0],
  data,
  true // With response
);

// Subscribe to notifications
await BluetoothNexus.subscribeToCharacteristic(
  deviceId,
  services[0],
  characteristics[0],
  (characteristicId, data) => {
    console.log('Notification received:', characteristicId, data);
  }
);

// Disconnect
await BluetoothNexus.disconnect(deviceId);
```

## API Reference

### BluetoothNexus

Singleton instance providing access to all Bluetooth operations.

#### Bluetooth State

- `isBluetoothEnabled(): Promise<boolean>` - Check if Bluetooth is enabled
- `requestBluetoothEnable(): Promise<boolean>` - Request user to enable Bluetooth

#### Device Discovery

- `startScan(filter: ScanFilter, callback: ScanCallback): Promise<boolean>` - Start scanning for devices
- `stopScan(): Promise<boolean>` - Stop scanning for devices
- `isScanning(): Promise<boolean>` - Check if currently scanning

#### Device Connection

- `connect(deviceId: string): Promise<string>` - Connect to a device
- `disconnect(deviceId: string): Promise<boolean>` - Disconnect from a device
- `isConnected(deviceId: string): Promise<boolean>` - Check if connected to a device

#### GATT Operations

- `discoverServices(deviceId: string): Promise<boolean>` - Discover services for a device
- `getServices(deviceId: string): Promise<string[]>` - Get services for a device
- `getCharacteristics(deviceId: string, serviceId: string): Promise<string[]>` - Get characteristics for a service
- `readCharacteristic(deviceId: string, serviceId: string, characteristicId: string): Promise<boolean>` - Read a characteristic
- `writeCharacteristic(deviceId: string, serviceId: string, characteristicId: string, data: number[], withResponse: boolean): Promise<boolean>` - Write to a characteristic
- `subscribeToCharacteristic(deviceId: string, serviceId: string, characteristicId: string, callback: CharacteristicUpdateCallback): Promise<boolean>` - Subscribe to notifications
- `unsubscribeFromCharacteristic(deviceId: string, serviceId: string, characteristicId: string): Promise<boolean>` - Unsubscribe from notifications

### Data Types

```typescript
// Scan filter options
interface ScanFilter {
  serviceUUIDs?: string[]; // UUIDs of services to filter by
  rssiThreshold?: number; // Minimum RSSI value to include device
  allowDuplicates?: boolean; // Whether to report the same device multiple times
}

// Bluetooth device information
interface BLEDevice {
  id: string; // Device identifier
  name: string; // Device name
  rssi: number; // Signal strength in dBm
  manufacturerData: ManufacturerData; // Manufacturer-specific data
  serviceUUIDs: string[]; // Available service UUIDs
  isConnectable: boolean; // Whether the device can be connected to
}

// Manufacturer data format
interface ManufacturerData {
  companyIdentifiers: ManufacturerDataEntry[];
}

interface ManufacturerDataEntry {
  id: string; // Company identifier
  data: number[]; // Manufacturer-specific data as byte array
}

// Callback types
type ScanCallback = (device: BLEDevice) => void;
type ConnectionCallback = (
  success: boolean,
  deviceId: string,
  error: string
) => void;
type OperationCallback = (success: boolean, error: string) => void;
type CharacteristicUpdateCallback = (
  characteristicId: string,
  data: number[]
) => void;
```

## Implementation Details

### C++ Core (BluetoothNexusCore)

The core C++ implementation provides a consistent interface for Bluetooth operations:

```cpp
namespace bluetoothnexus {
  class BluetoothNexusCore {
  public:
    static BluetoothNexusCore& getInstance();

    // Scanner methods
    bool startScan(const ScanFilter& filter, ScanResultCallback callback);
    bool stopScan();
    bool isScanning() const;

    // Connection methods
    bool connect(const std::string& deviceId, ConnectionCallback callback);
    bool disconnect(const std::string& deviceId, OperationCallback callback);
    bool isConnected(const std::string& deviceId) const;

    // GATT operations
    bool readCharacteristic(const std::string& deviceId,
                          const std::string& serviceId,
                          const std::string& characteristicId,
                          OperationCallback callback);
    // ... other methods
  };
}
```

### Objective-C++ Bridge

The iOS implementation bridges the C++ core to CoreBluetooth:

```objectivec
@interface BluetoothNitroNexus : NSObject <CBCentralManagerDelegate, CBPeripheralDelegate>
@property (nonatomic, strong) CBCentralManager *centralManager;
@property (nonatomic, strong) NSMutableDictionary<NSString *, CBPeripheral *> *peripherals;
// ... other properties

// Native method implementations
- (void)startScan:(NSDictionary *)filterDict callback:(RCTResponseSenderBlock)callback;
- (void)connect:(NSString *)deviceId callback:(RCTResponseSenderBlock)callback;
// ... other methods
@end
```

### TypeScript Interface

The type-safe JavaScript interface:

```typescript
export interface Spec extends TurboModule {
  // Scan methods
  startScan(filter: ScanFilter, callback: (device: BLEDevice) => void): void;
  stopScan(callback: (success: boolean, error: string) => void): void;

  // Connection methods
  connect(
    deviceId: string,
    callback: (success: boolean, deviceId: string, error: string) => void
  ): void;
  // ... other methods
}
```

## Performance Best Practices

1. **Scan Management**

   - Limit scan duration to conserve battery
   - Use service filters when possible to reduce processing overhead
   - Stop scanning when not needed

2. **Connection Lifecycle**

   - Maintain a single connection when possible
   - Properly handle disconnection events to prevent resource leaks
   - Cache discovered services and characteristics when appropriate

3. **Memory Management**
   - Unsubscribe from notifications when done
   - Properly clean up resources in component unmount handlers
   - Avoid keeping references to disconnected devices

## Contributing

We welcome contributions to extend functionality and improve the library:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

### Areas for Contribution

- Android implementation
- Additional BLE profile implementations
- Performance optimizations
- Documentation improvements

## License

This project is licensed under the MIT License - see the LICENSE file for details.
