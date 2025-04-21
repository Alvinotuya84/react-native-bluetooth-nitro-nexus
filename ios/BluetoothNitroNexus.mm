#import "BluetoothNitroNexus.h"

#import <React/RCTUtils.h>
#import <CoreBluetooth/CoreBluetooth.h>

@interface BluetoothNitroNexus() <CBCentralManagerDelegate, CBPeripheralDelegate>
@property (nonatomic, strong) CBCentralManager *centralManager;
@property (nonatomic, strong) NSMutableDictionary<NSString *, CBPeripheral *> *peripherals;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSMutableDictionary *> *servicesAndCharacteristics;
@property (nonatomic, strong) NSMutableDictionary<NSString *, RCTResponseSenderBlock> *scanCallbacks;
@property (nonatomic, strong) NSMutableDictionary<NSString *, RCTResponseSenderBlock> *connectionCallbacks;
@property (nonatomic, strong) NSMutableDictionary<NSString *, RCTResponseSenderBlock> *operationCallbacks;
@property (nonatomic, strong) NSMutableDictionary<NSString *, RCTResponseSenderBlock> *characteristicUpdateCallbacks;
@end

@implementation BluetoothNitroNexus

RCT_EXPORT_MODULE()

- (instancetype)init {
    if (self = [super init]) {
        _centralManager = [[CBCentralManager alloc] initWithDelegate:self queue:dispatch_get_main_queue()];
        _peripherals = [NSMutableDictionary new];
        _servicesAndCharacteristics = [NSMutableDictionary new];
        _scanCallbacks = [NSMutableDictionary new];
        _connectionCallbacks = [NSMutableDictionary new];
        _operationCallbacks = [NSMutableDictionary new];
        _characteristicUpdateCallbacks = [NSMutableDictionary new];
        
        // Set platform implementation
        bluetoothnexus::BluetoothNexusCore::getInstance().setPlatformImplementation((__bridge void*)self);
    }
    return self;
}

#pragma mark - JS Methods

- (NSNumber *)multiply:(double)a b:(double)b {
    NSNumber *result = @(bluetoothnexus::multiply(a, b));
    return result;
}

- (NSDictionary *)createScanFilter:(NSArray<NSString *> *)serviceUUIDs 
                     rssiThreshold:(NSNumber *)rssiThreshold 
                    allowDuplicates:(BOOL)allowDuplicates {
    // Since we can't return a C++ object directly, return a dictionary representation
    // We'll construct the actual ScanFilter in the startScan method
    return @{
        @"serviceUUIDs": serviceUUIDs ?: @[],
        @"rssiThreshold": rssiThreshold ?: @(-100),
        @"allowDuplicates": @(allowDuplicates)
    };
}

RCT_EXPORT_METHOD(startScan:(NSDictionary *)filterDict
                  callback:(RCTResponseSenderBlock)callback)
{
    // Create a scan filter from dictionary
    bluetoothnexus::ScanFilter filter;
    
    NSArray *serviceUUIDs = filterDict[@"serviceUUIDs"];
    for (NSString *uuidStr in serviceUUIDs) {
        filter.serviceUUIDs.push_back(std::string([uuidStr UTF8String]));
    }
    
    filter.rssiThreshold = [filterDict[@"rssiThreshold"] intValue];
    filter.allowDuplicates = [filterDict[@"allowDuplicates"] boolValue];
    
    // Store the callback to be called when devices are found
    NSString *callbackId = [[NSUUID UUID] UUIDString];
    self.scanCallbacks[callbackId] = callback;
    
    // Convert C++ callback to Objective-C
    // Use bleDevice as parameter name instead of device to avoid shadowing
    bluetoothnexus::ScanResultCallback scanCallback = [self, callbackId](const bluetoothnexus::BLEDevice& bleDevice) {
        // Create a device dictionary to send to JS
        NSMutableDictionary *deviceDict = [NSMutableDictionary dictionary];
        deviceDict[@"id"] = [NSString stringWithUTF8String:bleDevice.id.c_str()];
        deviceDict[@"name"] = [NSString stringWithUTF8String:bleDevice.name.c_str()];
        deviceDict[@"rssi"] = @(bleDevice.rssi);
        deviceDict[@"isConnectable"] = @(bleDevice.isConnectable);
        
        // Convert service UUIDs
        NSMutableArray *serviceUUIDs = [NSMutableArray array];
        for (const auto& uuid : bleDevice.serviceUUIDs) {
            [serviceUUIDs addObject:[NSString stringWithUTF8String:uuid.c_str()]];
        }
        deviceDict[@"serviceUUIDs"] = serviceUUIDs;
        
        // Convert manufacturer data to the codegen-compatible format
        // Instead of a dictionary, use an array of objects with id and data properties
        NSMutableArray *companyIdentifiers = [NSMutableArray array];
        for (const auto& pair : bleDevice.manufacturerData) {
            NSString *key = [NSString stringWithUTF8String:pair.first.c_str()];
            
            // Convert std::vector<uint8_t> to NSArray of numbers
            NSMutableArray *dataArray = [NSMutableArray array];
            for (uint8_t byte : pair.second) {
                [dataArray addObject:@(byte)];
            }
            
            [companyIdentifiers addObject:@{
                @"id": key,
                @"data": dataArray
            }];
        }
        
        deviceDict[@"manufacturerData"] = @{
            @"companyIdentifiers": companyIdentifiers
        };
        
        // Call the JS callback with the device info
        if (self.scanCallbacks[callbackId]) {
            self.scanCallbacks[callbackId](@[deviceDict]);
        }
    };
    
    // Start the scan through the C++ core
    bool success = bluetoothnexus::BluetoothNexusCore::getInstance().startScan(filter, scanCallback);
    if (!success) {
        callback(@[@{@"error": @"Failed to start scan"}]);
    }
}

RCT_EXPORT_METHOD(stopScan:(RCTResponseSenderBlock)callback)
{
    bool success = bluetoothnexus::BluetoothNexusCore::getInstance().stopScan();
    callback(@[@(success), success ? @"" : @"Failed to stop scan"]);
}

RCT_EXPORT_METHOD(isScanning:(RCTResponseSenderBlock)callback)
{
    bool scanning = bluetoothnexus::BluetoothNexusCore::getInstance().isScanning();
    callback(@[@(scanning)]);
}

RCT_EXPORT_METHOD(connect:(NSString *)deviceId
                  callback:(RCTResponseSenderBlock)callback)
{
    NSString *callbackId = [[NSUUID UUID] UUIDString];
    self.connectionCallbacks[callbackId] = callback;
    
    // Convert C++ callback to Objective-C
    // Use deviceIdentifier instead of deviceId to avoid shadowing
    bluetoothnexus::ConnectionCallback connCallback = [self, callbackId](bool success, 
                                                  const std::string& deviceIdentifier, 
                                                  const std::string& error) {
        if (self.connectionCallbacks[callbackId]) {
            NSString *deviceIdStr = [NSString stringWithUTF8String:deviceIdentifier.c_str()];
            NSString *errorStr = [NSString stringWithUTF8String:error.c_str()];
            self.connectionCallbacks[callbackId](@[@(success), deviceIdStr, errorStr]);
            [self.connectionCallbacks removeObjectForKey:callbackId];
        }
    };
    
    // Connect through the C++ core
    bool success = bluetoothnexus::BluetoothNexusCore::getInstance().connect(
        std::string([deviceId UTF8String]), 
        connCallback
    );
    
    if (!success) {
        callback(@[@(NO), deviceId, @"Failed to initiate connection"]);
    }
}

RCT_EXPORT_METHOD(disconnect:(NSString *)deviceId
                 callback:(RCTResponseSenderBlock)callback)
{
    NSString *callbackId = [[NSUUID UUID] UUIDString];
    self.operationCallbacks[callbackId] = callback;
    
    // Convert C++ callback to Objective-C
    // Use errorMessage instead of error to avoid shadowing
    bluetoothnexus::OperationCallback opCallback = [self, callbackId](bool success, const std::string& errorMessage) {
        if (self.operationCallbacks[callbackId]) {
            NSString *errorStr = [NSString stringWithUTF8String:errorMessage.c_str()];
            self.operationCallbacks[callbackId](@[@(success), errorStr]);
            [self.operationCallbacks removeObjectForKey:callbackId];
        }
    };
    
    // Disconnect through the C++ core
    bool success = bluetoothnexus::BluetoothNexusCore::getInstance().disconnect(
        std::string([deviceId UTF8String]), 
        opCallback
    );
    
    if (!success) {
        callback(@[@(NO), @"Failed to initiate disconnection"]);
    }
}

RCT_EXPORT_METHOD(isConnected:(NSString *)deviceId
                  callback:(RCTResponseSenderBlock)callback)
{
    bool connected = bluetoothnexus::BluetoothNexusCore::getInstance().isConnected(
        std::string([deviceId UTF8String])
    );
    callback(@[@(connected)]);
}

RCT_EXPORT_METHOD(discoverServices:(NSString *)deviceId
                  callback:(RCTResponseSenderBlock)callback)
{
    NSString *callbackId = [[NSUUID UUID] UUIDString];
    self.operationCallbacks[callbackId] = callback;
    
    // Convert C++ callback to Objective-C
    // Use errorMessage instead of error to avoid shadowing
    bluetoothnexus::OperationCallback opCallback = [self, callbackId](bool success, const std::string& errorMessage) {
        if (self.operationCallbacks[callbackId]) {
            NSString *errorStr = [NSString stringWithUTF8String:errorMessage.c_str()];
            self.operationCallbacks[callbackId](@[@(success), errorStr]);
            [self.operationCallbacks removeObjectForKey:callbackId];
        }
    };
    
    // Discover services through the C++ core
    bool success = bluetoothnexus::BluetoothNexusCore::getInstance().discoverServices(
        std::string([deviceId UTF8String]), 
        opCallback
    );
    
    if (!success) {
        callback(@[@(NO), @"Failed to initiate service discovery"]);
    }
}

RCT_EXPORT_METHOD(getServices:(NSString *)deviceId
                  callback:(RCTResponseSenderBlock)callback)
{
    std::vector<std::string> services = bluetoothnexus::BluetoothNexusCore::getInstance().getServices(
        std::string([deviceId UTF8String])
    );
    
    NSMutableArray *serviceUUIDs = [NSMutableArray array];
    for (const auto& service : services) {
        [serviceUUIDs addObject:[NSString stringWithUTF8String:service.c_str()]];
    }
    
    callback(@[serviceUUIDs]);
}

RCT_EXPORT_METHOD(getCharacteristics:(NSString *)deviceId
                  serviceId:(NSString *)serviceId
                  callback:(RCTResponseSenderBlock)callback)
{
    std::vector<std::string> characteristics = bluetoothnexus::BluetoothNexusCore::getInstance().getCharacteristics(
        std::string([deviceId UTF8String]),
        std::string([serviceId UTF8String])
    );
    
    NSMutableArray *characteristicUUIDs = [NSMutableArray array];
    for (const auto& characteristic : characteristics) {
        [characteristicUUIDs addObject:[NSString stringWithUTF8String:characteristic.c_str()]];
    }
    
    callback(@[characteristicUUIDs]);
}

RCT_EXPORT_METHOD(readCharacteristic:(NSString *)deviceId
                  serviceId:(NSString *)serviceId
                  characteristicId:(NSString *)characteristicId
                  callback:(RCTResponseSenderBlock)callback)
{
    NSString *callbackId = [[NSUUID UUID] UUIDString];
    self.operationCallbacks[callbackId] = callback;
    
    // Convert C++ callback to Objective-C
    // Use errorMessage instead of error to avoid shadowing
    bluetoothnexus::OperationCallback opCallback = [self, callbackId](bool success, const std::string& errorMessage) {
        if (self.operationCallbacks[callbackId]) {
            NSString *errorStr = [NSString stringWithUTF8String:errorMessage.c_str()];
            self.operationCallbacks[callbackId](@[@(success), errorStr]);
            [self.operationCallbacks removeObjectForKey:callbackId];
        }
    };
    
    // Read characteristic through the C++ core
    bool success = bluetoothnexus::BluetoothNexusCore::getInstance().readCharacteristic(
        std::string([deviceId UTF8String]),
        std::string([serviceId UTF8String]),
        std::string([characteristicId UTF8String]),
        opCallback
    );
    
    if (!success) {
        callback(@[@(NO), @"Failed to initiate characteristic read"]);
    }
}

RCT_EXPORT_METHOD(writeCharacteristic:(NSString *)deviceId
                  serviceId:(NSString *)serviceId
                  characteristicId:(NSString *)characteristicId
                  data:(NSArray *)dataArray
                  withResponse:(BOOL)withResponse
                  callback:(RCTResponseSenderBlock)callback)
{
    NSString *callbackId = [[NSUUID UUID] UUIDString];
    self.operationCallbacks[callbackId] = callback;
    
    // Convert NSArray to std::vector<uint8_t>
    std::vector<uint8_t> data;
    for (NSNumber *byteNum in dataArray) {
        data.push_back([byteNum unsignedCharValue]);
    }
    
    // Convert C++ callback to Objective-C
    // Use errorMessage instead of error to avoid shadowing
    bluetoothnexus::OperationCallback opCallback = [self, callbackId](bool success, const std::string& errorMessage) {
        if (self.operationCallbacks[callbackId]) {
            NSString *errorStr = [NSString stringWithUTF8String:errorMessage.c_str()];
            self.operationCallbacks[callbackId](@[@(success), errorStr]);
            [self.operationCallbacks removeObjectForKey:callbackId];
        }
    };
    
    // Write characteristic through the C++ core
    bool success = bluetoothnexus::BluetoothNexusCore::getInstance().writeCharacteristic(
        std::string([deviceId UTF8String]),
        std::string([serviceId UTF8String]),
        std::string([characteristicId UTF8String]),
        data,
        withResponse,
        opCallback
    );
    
    if (!success) {
        callback(@[@(NO), @"Failed to initiate characteristic write"]);
    }
}

RCT_EXPORT_METHOD(subscribeToCharacteristic:(NSString *)deviceId
                  serviceId:(NSString *)serviceId
                  characteristicId:(NSString *)characteristicId
                  callback:(RCTResponseSenderBlock)callback
                  statusCallback:(RCTResponseSenderBlock)statusCallback)
{
    NSString *callbackId = [[NSUUID UUID] UUIDString];
    NSString *statusCallbackId = [[NSUUID UUID] UUIDString];
    
    self.characteristicUpdateCallbacks[callbackId] = callback;
    self.operationCallbacks[statusCallbackId] = statusCallback;
    
    // Convert C++ callbacks to Objective-C
    // Use charIdentifier instead of characteristicId to avoid shadowing
    bluetoothnexus::CharacteristicUpdateCallback updateCallback = 
        [self, callbackId](const std::string& charIdentifier, const std::vector<uint8_t>& dataBytes) {
            if (self.characteristicUpdateCallbacks[callbackId]) {
                NSString *charId = [NSString stringWithUTF8String:charIdentifier.c_str()];
                
                // Convert data to NSArray
                NSMutableArray *dataArray = [NSMutableArray array];
                for (uint8_t byte : dataBytes) {
                    [dataArray addObject:@(byte)];
                }
                
                self.characteristicUpdateCallbacks[callbackId](@[charId, dataArray]);
            }
        };
    
    // Use errorMessage instead of error to avoid shadowing
    bluetoothnexus::OperationCallback opCallback = 
        [self, statusCallbackId](bool success, const std::string& errorMessage) {
            if (self.operationCallbacks[statusCallbackId]) {
                NSString *errorStr = [NSString stringWithUTF8String:errorMessage.c_str()];
                self.operationCallbacks[statusCallbackId](@[@(success), errorStr]);
                [self.operationCallbacks removeObjectForKey:statusCallbackId];
            }
        };
    
    // Subscribe to characteristic through the C++ core
    bool success = bluetoothnexus::BluetoothNexusCore::getInstance().subscribeToCharacteristic(
        std::string([deviceId UTF8String]),
        std::string([serviceId UTF8String]),
        std::string([characteristicId UTF8String]),
        updateCallback,
        opCallback
    );
    
    if (!success) {
        statusCallback(@[@(NO), @"Failed to initiate characteristic subscription"]);
    }
}

RCT_EXPORT_METHOD(unsubscribeFromCharacteristic:(NSString *)deviceId
                  serviceId:(NSString *)serviceId
                  characteristicId:(NSString *)characteristicId
                  callback:(RCTResponseSenderBlock)callback)
{
    NSString *callbackId = [[NSUUID UUID] UUIDString];
    self.operationCallbacks[callbackId] = callback;
    
    // Convert C++ callback to Objective-C
    // Use errorMessage instead of error to avoid shadowing
    bluetoothnexus::OperationCallback opCallback = [self, callbackId](bool success, const std::string& errorMessage) {
        if (self.operationCallbacks[callbackId]) {
            NSString *errorStr = [NSString stringWithUTF8String:errorMessage.c_str()];
            self.operationCallbacks[callbackId](@[@(success), errorStr]);
            [self.operationCallbacks removeObjectForKey:callbackId];
        }
    };
    
    // Unsubscribe from characteristic through the C++ core
    bool success = bluetoothnexus::BluetoothNexusCore::getInstance().unsubscribeFromCharacteristic(
        std::string([deviceId UTF8String]),
        std::string([characteristicId UTF8String]),
        std::string([characteristicId UTF8String]),
        opCallback
    );
    
    if (!success) {
        callback(@[@(NO), @"Failed to initiate characteristic unsubscription"]);
    }
}

RCT_EXPORT_METHOD(isBluetoothEnabled:(RCTResponseSenderBlock)callback)
{
    bool enabled = bluetoothnexus::BluetoothNexusCore::getInstance().isBluetoothEnabled();
    callback(@[@(enabled)]);
}

RCT_EXPORT_METHOD(requestBluetoothEnable:(RCTResponseSenderBlock)callback)
{
    NSString *callbackId = [[NSUUID UUID] UUIDString];
    self.operationCallbacks[callbackId] = callback;
    
    // Convert C++ callback to Objective-C
    // Use errorMessage instead of error to avoid shadowing
    bluetoothnexus::OperationCallback opCallback = [self, callbackId](bool success, const std::string& errorMessage) {
        if (self.operationCallbacks[callbackId]) {
            NSString *errorStr = [NSString stringWithUTF8String:errorMessage.c_str()];
            self.operationCallbacks[callbackId](@[@(success), errorStr]);
            [self.operationCallbacks removeObjectForKey:callbackId];
        }
    };
    
    // Request Bluetooth enable through the C++ core
    bluetoothnexus::BluetoothNexusCore::getInstance().requestBluetoothEnable(opCallback);
}

#pragma mark - Core Bluetooth Implementation

// These methods would implement the actual Bluetooth functionality in iOS
// using Core Bluetooth API, but they're left blank for brevity

- (void)centralManagerDidUpdateState:(CBCentralManager *)central {
    // Implementation needed for real functionality
}

- (void)centralManager:(CBCentralManager *)central didDiscoverPeripheral:(CBPeripheral *)peripheral advertisementData:(NSDictionary<NSString *,id> *)advertisementData RSSI:(NSNumber *)RSSI {
    // Implementation needed for real functionality
}

- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral {
    // Implementation needed for real functionality
}

- (void)centralManager:(CBCentralManager *)central didFailToConnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error {
    // Implementation needed for real functionality
}

- (void)centralManager:(CBCentralManager *)central didDisconnectPeripheral:(CBPeripheral *)peripheral error:(NSError *)error {
    // Implementation needed for real functionality
}

#pragma mark - TurboModule Methods

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
    return std::make_shared<facebook::react::NativeBluetoothNitroNexusSpecJSI>(params);
}

@end