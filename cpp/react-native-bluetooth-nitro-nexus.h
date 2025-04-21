#ifndef BLUETOOTHNEXUS_H
#define BLUETOOTHNEXUS_H

#include <string>
#include <vector>
#include <memory>
#include <functional>
#include <unordered_map>

namespace bluetoothnexus {

// Data structures
struct ScanFilter {
    std::vector<std::string> serviceUUIDs;
    int rssiThreshold = -100; // Default RSSI threshold
    bool allowDuplicates = false;
};

struct BLEDevice {
    std::string id;
    std::string name;
    int rssi;
    std::unordered_map<std::string, std::vector<uint8_t>> manufacturerData;
    std::vector<std::string> serviceUUIDs;
    bool isConnectable;
};

// Callback types
using ScanResultCallback = std::function<void(const BLEDevice&)>;
using ConnectionCallback = std::function<void(bool, const std::string&, const std::string&)>;
using OperationCallback = std::function<void(bool, const std::string&)>;
using CharacteristicUpdateCallback = std::function<void(const std::string&, const std::vector<uint8_t>&)>;

// Main class for Bluetooth functionality
class BluetoothNexusCore {
public:
    static BluetoothNexusCore& getInstance();
    
    // Prevent copying
    BluetoothNexusCore(const BluetoothNexusCore&) = delete;
    BluetoothNexusCore& operator=(const BluetoothNexusCore&) = delete;
    
    // Scanner methods
    bool startScan(const ScanFilter& filter, ScanResultCallback callback);
    bool stopScan();
    bool isScanning() const;
    
    // Connection methods
    bool connect(const std::string& deviceId, ConnectionCallback callback);
    bool disconnect(const std::string& deviceId, OperationCallback callback);
    bool isConnected(const std::string& deviceId) const;
    
    // GATT operations
    bool discoverServices(const std::string& deviceId, OperationCallback callback);
    std::vector<std::string> getServices(const std::string& deviceId) const;
    std::vector<std::string> getCharacteristics(const std::string& deviceId, const std::string& serviceId) const;
    
    bool readCharacteristic(
        const std::string& deviceId, 
        const std::string& serviceId, 
        const std::string& characteristicId,
        OperationCallback callback);
        
    bool writeCharacteristic(
        const std::string& deviceId, 
        const std::string& serviceId, 
        const std::string& characteristicId,
        const std::vector<uint8_t>& data,
        bool withResponse,
        OperationCallback callback);
        
    bool subscribeToCharacteristic(
        const std::string& deviceId, 
        const std::string& serviceId, 
        const std::string& characteristicId,
        CharacteristicUpdateCallback callback,
        OperationCallback statusCallback);
        
    bool unsubscribeFromCharacteristic(
        const std::string& deviceId, 
        const std::string& serviceId, 
        const std::string& characteristicId,
        OperationCallback callback);
    
    // Bluetooth State
    bool isBluetoothEnabled() const;
    void requestBluetoothEnable(OperationCallback callback);
    
    // Platform implementation to be provided in platform-specific code
    void setPlatformImplementation(void* implementation);
    
private:
    BluetoothNexusCore() = default;
    void* platformImplementation = nullptr;
    
    // State tracking
    bool scanning = false;
    std::unordered_map<std::string, bool> connectedDevices;
};

// Legacy function maintained for backward compatibility
double multiply(double a, double b);

} // namespace bluetoothnexus

#endif /* BLUETOOTHNEXUS_H */