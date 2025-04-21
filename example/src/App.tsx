import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Animated,
  Easing,
  ScrollView,
  Modal,
} from 'react-native';
import type { ListRenderItem } from 'react-native';
// Import our Bluetooth Nexus singleton instance
import BluetoothNexus from 'react-native-bluetooth-nitro-nexus';
import type { ScanFilter, BLEDevice } from 'react-native-bluetooth-nitro-nexus';

// Just for demonstration

// Define interface for our BLE device with additional UI properties
interface ExtendedBLEDevice extends BLEDevice {
  isConnectable: boolean;
}

// Define types for tabs
type TabType = 'scan' | 'services';

const App: React.FC = () => {
  // State for device scanning
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [devices, setDevices] = useState<ExtendedBLEDevice[]>([]);
  const [bluetoothEnabled, setBluetoothEnabled] = useState<boolean>(false);

  // State for device connection
  const [connectedDevice, setConnectedDevice] =
    useState<ExtendedBLEDevice | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [characteristics, setCharacteristics] = useState<string[]>([]);
  const [selectedCharacteristic, setSelectedCharacteristic] = useState<
    string | null
  >(null);
  const [characteristicValue, setCharacteristicValue] = useState<string | null>(
    null
  );

  // State for UI
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('scan');

  // Animations
  const scanButtonScale = useRef(new Animated.Value(1)).current;
  const scanAnimation = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Check if Bluetooth is enabled on startup
  useEffect(() => {
    checkBluetoothStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animation for scanning indicator
  useEffect(() => {
    let scanAnimLoop: Animated.CompositeAnimation | undefined;

    if (isScanning) {
      scanAnimLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnimation, {
            toValue: 1,
            duration: 1500,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnimation, {
            toValue: 0,
            duration: 1500,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      );
      scanAnimLoop.start();
    } else {
      scanAnimation.setValue(0);
    }

    return () => {
      if (scanAnimLoop) {
        scanAnimLoop.stop();
      }
    };
  }, [isScanning, scanAnimation]);

  // Animation for tab switching
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: activeTab === 'scan' ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }, [activeTab, slideAnim, fadeAnim]);

  // Toast animation
  useEffect(() => {
    if (showToast) {
      Animated.sequence([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setShowToast(false));
    }
  }, [showToast, toastOpacity]);

  const checkBluetoothStatus = useCallback(async (): Promise<void> => {
    try {
      const enabled = await BluetoothNexus.isBluetoothEnabled();
      setBluetoothEnabled(enabled);
      if (!enabled) {
        showToastMessage('Bluetooth is disabled. Please enable it.');
      }
    } catch (error) {
      console.error('Error checking Bluetooth status:', error);
      showToastMessage('Error checking Bluetooth status');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enableBluetooth = async (): Promise<void> => {
    try {
      await BluetoothNexus.requestBluetoothEnable();
      setBluetoothEnabled(true);
      showToastMessage('Bluetooth enabled');
    } catch (error) {
      console.error('Error enabling Bluetooth:', error);
      showToastMessage('Failed to enable Bluetooth');
    }
  };

  const showToastMessage = useCallback((message: string): void => {
    setToastMessage(message);
    setShowToast(true);
  }, []);

  const startScan = async (): Promise<void> => {
    if (!bluetoothEnabled) {
      showToastMessage('Bluetooth is not enabled');
      return;
    }

    try {
      // Animate the scan button press
      Animated.sequence([
        Animated.timing(scanButtonScale, {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scanButtonScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      setIsScanning(true);
      setDevices([]);

      // Define the scan filter
      const filter: ScanFilter = {
        serviceUUIDs: [], // Empty to discover all
        rssiThreshold: -80, // Only show devices with RSSI greater than -80 dBm
        allowDuplicates: false,
      };

      // Start scanning and add devices as they're discovered
      await BluetoothNexus.startScan(filter, (device: BLEDevice) => {
        // Add the device to the list if it has a name
        if (device.name) {
          setDevices((prevDevices) => {
            // Check if this device is already in the list
            const idx = prevDevices.findIndex((d) => d.id === device.id);
            if (idx >= 0) {
              // Update existing device
              const updatedDevices = [...prevDevices];
              updatedDevices[idx] = device as ExtendedBLEDevice;
              return updatedDevices;
            } else {
              // Add new device
              return [...prevDevices, device as ExtendedBLEDevice];
            }
          });
        }
      });

      // Stop scanning after 10 seconds
      setTimeout(stopScan, 10000);
    } catch (error) {
      console.error('Error starting scan:', error);
      setIsScanning(false);
      showToastMessage('Error starting scan');
    }
  };

  const stopScan = async (): Promise<void> => {
    if (isScanning) {
      try {
        await BluetoothNexus.stopScan();
        setIsScanning(false);
      } catch (error) {
        console.error('Error stopping scan:', error);
        showToastMessage('Error stopping scan');
      }
    }
  };

  const connectToDevice = async (device: ExtendedBLEDevice): Promise<void> => {
    setIsConnecting(true);

    try {
      const deviceId = await BluetoothNexus.connect(device.id);
      setConnectedDevice(device);
      showToastMessage(`Connected to ${device.name}`);

      // Discover services
      await BluetoothNexus.discoverServices(deviceId);
      const deviceServices = await BluetoothNexus.getServices(deviceId);
      setServices(deviceServices);

      // Switch to the services tab
      setActiveTab('services');
    } catch (error) {
      console.error('Error connecting to device:', error);
      showToastMessage(`Failed to connect to ${device.name}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectFromDevice = async (): Promise<void> => {
    if (connectedDevice) {
      try {
        await BluetoothNexus.disconnect(connectedDevice.id);
        setConnectedDevice(null);
        setServices([]);
        setCharacteristics([]);
        setSelectedService(null);
        setSelectedCharacteristic(null);
        showToastMessage('Disconnected');
        setActiveTab('scan');
      } catch (error) {
        console.error('Error disconnecting:', error);
        showToastMessage('Error disconnecting');
      }
    }
  };

  const selectService = async (serviceId: string): Promise<void> => {
    setSelectedService(serviceId);

    try {
      if (!connectedDevice) {
        throw new Error('No device connected');
      }

      const chars = await BluetoothNexus.getCharacteristics(
        connectedDevice.id,
        serviceId
      );
      setCharacteristics(chars);
    } catch (error) {
      console.error('Error getting characteristics:', error);
      showToastMessage('Error getting characteristics');
    }
  };

  const readCharacteristic = async (
    characteristicId: string
  ): Promise<void> => {
    setSelectedCharacteristic(characteristicId);

    try {
      if (!connectedDevice || !selectedService) {
        throw new Error('Device or service not selected');
      }

      await BluetoothNexus.readCharacteristic(
        connectedDevice.id,
        selectedService,
        characteristicId
      );
      // The value would normally be handled in a callback or event
      // This is simplified for demonstration
      setCharacteristicValue('Reading characteristic...');
      setModalVisible(true);
    } catch (error) {
      console.error('Error reading characteristic:', error);
      showToastMessage('Error reading characteristic');
    }
  };

  const writeToCharacteristic = async (data: string): Promise<void> => {
    if (!selectedCharacteristic || !connectedDevice || !selectedService) return;

    try {
      const encoder = new TextEncoder();
      const byteArray = Array.from(encoder.encode(data));
      await BluetoothNexus.writeCharacteristic(
        connectedDevice.id,
        selectedService,
        selectedCharacteristic,
        byteArray,
        true // With response
      );
      showToastMessage('Write successful');
    } catch (error) {
      console.error('Error writing to characteristic:', error);
      showToastMessage('Error writing to characteristic');
    }
  };

  const subscribeToCharacteristic = async (
    characteristicId: string
  ): Promise<void> => {
    try {
      if (!connectedDevice || !selectedService) {
        throw new Error('Device or service not selected');
      }

      await BluetoothNexus.subscribeToCharacteristic(
        connectedDevice.id,
        selectedService,
        characteristicId,
        (charId: string, data: number[]) => {
          // Handle notification data
          const textDecoder = new TextDecoder();
          const uint8Array = new Uint8Array(data);
          const value = textDecoder.decode(uint8Array);
          setCharacteristicValue(value);
          showToastMessage('Received notification' + charId);
        }
      );
      showToastMessage('Subscribed to notifications');
    } catch (error) {
      console.error('Error subscribing to characteristic:', error);
      showToastMessage('Error subscribing');
    }
  };

  // Helper function to get signal strength color based on RSSI value
  const getSignalStrengthColor = (rssi: number): string => {
    if (rssi > -60) return '#4CAF50'; // Excellent (green)
    if (rssi > -70) return '#8BC34A'; // Good (light green)
    if (rssi > -80) return '#FFC107'; // Fair (yellow)
    return '#FF5722'; // Poor (orange)
  };

  const renderDeviceItem: ListRenderItem<ExtendedBLEDevice> = ({ item }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => connectToDevice(item)}
      disabled={isConnecting}
    >
      <View style={styles.deviceInfoContainer}>
        <Text style={styles.deviceName}>{item.name || 'Unknown Device'}</Text>
        <Text style={styles.deviceId}>ID: {item.id}</Text>
        <Text style={styles.deviceRssi}>Signal: {item.rssi} dBm</Text>
      </View>
      <View
        style={[
          styles.signalStrength,
          { backgroundColor: getSignalStrengthColor(item.rssi) },
        ]}
      />
    </TouchableOpacity>
  );

  // const renderServiceItem: ListRenderItem<string> = ({ item }) => (
  //   <TouchableOpacity
  //     style={[
  //       styles.serviceItem,
  //       selectedService === item && styles.selectedItem
  //     ]}
  //     onPress={() => selectService(item)}
  //   >
  //     <Text style={styles.serviceText}>
  //       {item.substring(0, 8)}...{item.substring(item.length - 4)}
  //     </Text>
  //   </TouchableOpacity>
  // );

  const renderCharacteristicItem: ListRenderItem<string> = ({ item }) => (
    <View style={styles.characteristicContainer}>
      <Text style={styles.characteristicId}>
        {item.substring(0, 8)}...{item.substring(item.length - 4)}
      </Text>
      <View style={styles.characteristicActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => readCharacteristic(item)}
        >
          <Text style={styles.actionButtonText}>Read</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => subscribeToCharacteristic(item)}
        >
          <Text style={styles.actionButtonText}>Notify</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setSelectedCharacteristic(item);
            setModalVisible(true);
          }}
        >
          <Text style={styles.actionButtonText}>Write</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -400], // Adjust based on screen width
  });

  const scanOpacity = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const servicesOpacity = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#2c3e50" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bluetooth Nexus</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'scan' && styles.activeTab]}
          onPress={() => setActiveTab('scan')}
        >
          <Text style={styles.tabText}>Scan</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'services' && styles.activeTab,
            !connectedDevice && styles.disabledTab,
          ]}
          onPress={() => connectedDevice && setActiveTab('services')}
          disabled={!connectedDevice}
        >
          <Text style={styles.tabText}>Services</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.tabContent, { transform: [{ translateX }] }]}
      >
        {/* Scan Tab */}
        <Animated.View style={[styles.scanTabView, { opacity: scanOpacity }]}>
          <View style={styles.bluetoothStatus}>
            <Text style={styles.statusText}>
              Bluetooth: {bluetoothEnabled ? 'Enabled' : 'Disabled'}
            </Text>
            {!bluetoothEnabled && (
              <TouchableOpacity
                style={styles.enableButton}
                onPress={enableBluetooth}
              >
                <Text style={styles.enableButtonText}>Enable</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.scanButtonContainer}>
            <Animated.View
              style={[
                styles.scanPulse,
                {
                  opacity: scanAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.7],
                  }),
                  transform: [
                    {
                      scale: scanAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 2],
                      }),
                    },
                  ],
                },
              ]}
            />
            <Animated.View
              style={{
                transform: [{ scale: scanButtonScale }],
              }}
            >
              <TouchableOpacity
                style={styles.scanButton}
                onPress={isScanning ? stopScan : startScan}
                disabled={!bluetoothEnabled}
              >
                <Text style={styles.scanButtonText}>
                  {isScanning ? 'Stop' : 'Scan'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <View style={styles.deviceListContainer}>
            <Text style={styles.sectionTitle}>
              {isScanning ? 'Finding Devices...' : 'Found Devices'}
            </Text>
            {devices.length === 0 && !isScanning ? (
              <Text style={styles.emptyListText}>
                No devices found. Tap Scan to start.
              </Text>
            ) : (
              <FlatList
                data={devices}
                renderItem={renderDeviceItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.deviceList}
              />
            )}
          </View>
        </Animated.View>

        {/* Services Tab */}
        <Animated.View
          style={[styles.servicesTabView, { opacity: servicesOpacity }]}
        >
          {connectedDevice ? (
            <View style={styles.connectedDeviceInfo}>
              <View style={styles.deviceHeader}>
                <Text style={styles.connectedDeviceName}>
                  {connectedDevice.name || 'Unknown Device'}
                </Text>
                <TouchableOpacity
                  style={styles.disconnectButton}
                  onPress={disconnectFromDevice}
                >
                  <Text style={styles.disconnectButtonText}>Disconnect</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.servicesContainer}>
                <Text style={styles.sectionTitle}>Services</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {services.map((service) => (
                    <TouchableOpacity
                      key={service}
                      style={[
                        styles.serviceItem,
                        selectedService === service && styles.selectedItem,
                      ]}
                      onPress={() => selectService(service)}
                    >
                      <Text style={styles.serviceText}>
                        {service.substring(0, 8)}...
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {selectedService && (
                <View style={styles.characteristicsContainer}>
                  <Text style={styles.sectionTitle}>Characteristics</Text>
                  <FlatList
                    data={characteristics}
                    renderItem={renderCharacteristicItem}
                    keyExtractor={(item) => item}
                    contentContainerStyle={styles.characteristicsList}
                  />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noDeviceContainer}>
              <Text style={styles.noDeviceText}>
                No device connected. Go to scan tab to connect.
              </Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>

      {/* Write Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {characteristicValue
                ? 'Characteristic Value'
                : 'Write to Characteristic'}
            </Text>

            {characteristicValue ? (
              <Text style={styles.characteristicValue}>
                {characteristicValue}
              </Text>
            ) : (
              <View style={styles.writeActions}>
                <TouchableOpacity
                  style={styles.writeButton}
                  onPress={() => {
                    writeToCharacteristic('00');
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.writeButtonText}>Write 0x00</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.writeButton}
                  onPress={() => {
                    writeToCharacteristic('01');
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.writeButtonText}>Write 0x01</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setModalVisible(false);
                setCharacteristicValue(null);
              }}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Toast Message */}
      {showToast && (
        <Animated.View
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
            },
          ]}
        >
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

// Styles are now typed with StyleSheet.create
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    backgroundColor: '#2c3e50',
    padding: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ecf0f1',
    marginTop: 4,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#34495e',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#3498db',
  },
  disabledTab: {
    opacity: 0.5,
  },
  tabText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  tabContent: {
    flex: 1,
    flexDirection: 'row',
    width: '200%', // To accommodate both tabs side by side
  },
  scanTabView: {
    width: '50%', // Take half of the parent width
    padding: 16,
  },
  servicesTabView: {
    width: '50%', // Take half of the parent width
    padding: 16,
  },
  bluetoothStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
  },
  enableButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  enableButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  scanButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    height: 120,
  },
  scanPulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3498db',
  },
  scanButton: {
    backgroundColor: '#3498db',
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  deviceListContainer: {
    flex: 1,
  },
  sectionTitle: {
    color: '#ecf0f1',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyListText: {
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 24,
  },
  deviceList: {
    paddingBottom: 16,
  },
  deviceItem: {
    backgroundColor: '#2c3e50',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceInfoContainer: {
    flex: 1,
  },
  deviceName: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
  },
  deviceId: {
    color: '#bdc3c7',
    fontSize: 12,
  },
  deviceRssi: {
    color: '#95a5a6',
    fontSize: 12,
    marginTop: 4,
  },
  signalStrength: {
    width: 12,
    height: 50,
    borderRadius: 6,
  },
  connectedDeviceInfo: {
    flex: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  connectedDeviceName: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  disconnectButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  disconnectButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  servicesContainer: {
    marginBottom: 16,
  },
  serviceItem: {
    backgroundColor: '#34495e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  selectedItem: {
    backgroundColor: '#2980b9',
  },
  serviceText: {
    color: 'white',
    fontWeight: '600',
  },
  characteristicsContainer: {
    flex: 1,
  },
  characteristicsList: {
    paddingBottom: 16,
  },
  characteristicContainer: {
    backgroundColor: '#2c3e50',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  characteristicId: {
    color: 'white',
    fontWeight: '600',
    marginBottom: 8,
  },
  characteristicActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  noDeviceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDeviceText: {
    color: '#7f8c8d',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2c3e50',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  characteristicValue: {
    color: '#ecf0f1',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  writeActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 16,
  },
  writeButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  writeButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#7f8c8d',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  toast: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(52, 152, 219, 0.9)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  toastText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default App;
