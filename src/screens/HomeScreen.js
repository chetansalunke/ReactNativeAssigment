import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Text,
  Alert,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import ViewShot from 'react-native-view-shot';
import { FAB } from 'react-native-paper';

// Import your EV chargers JSON file
import evChargersData from '../../data/charger.json'; // Adjust path as needed

const { height } = Dimensions.get('window');

const DEFAULT_REGION = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const HomeScreen = () => {
  const [location, setLocation] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [evChargers, setEvChargers] = useState([]);
  const [selectedCharger, setSelectedCharger] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const mapRef = useRef();

  useEffect(() => {
    // Load EV chargers data from JSON
    if (evChargersData && evChargersData.chargers) {
      setEvChargers(evChargersData.chargers);
    }
  }, []);

  useEffect(() => {
    let retryTimeout;
    let isMounted = true;
    const requestLocationPermission = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            if (isMounted) setErrorMsg('Location permission denied');
            return;
          }
        }
        getCurrentLocation();
      } catch (err) {
        setErrorMsg('Error requesting location permission');
      }
    };

    const getCurrentLocation = () => {
      Geolocation.getCurrentPosition(
        pos => {
          if (!isMounted) return;
          const { latitude, longitude } = pos.coords;
          setLocation({
            latitude,
            longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          });
          setErrorMsg('');
        },
        error => {
          if (!isMounted) return;
          let msg = error.message;
          if (error.code === 1)
            msg = 'Permission denied. Please enable location.';
          if (error.code === 2) msg = 'Location unavailable. Try again.';
          if (error.code === 3) msg = 'Location timeout. Retrying...';
          setErrorMsg(msg);
          if (error.code === 3 || error.code === 2) {
            retryTimeout = setTimeout(getCurrentLocation, 3000);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 },
      );
    };

    requestLocationPermission();
    return () => {
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);

  const handleCaptureAndUpload = async () => {
    try {
      setUploading(true);
      const uri = await mapRef.current.capture({
        format: 'webp',
        quality: 0.9,
      });
      Alert.alert('Screenshot captured', uri);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setUploading(false);
    }
  };

  // Get total number of connectors
  const getTotalConnectors = connectorTypes => {
    return connectorTypes.reduce((total, connector) => {
      const [, count] = connector.split('-');
      return total + parseInt(count, 10);
    }, 0);
  };

  const getConnectorDetails = connectorTypes => {
    return connectorTypes.map(connector => {
      const [type, count] = connector.split('-');
      let name = '';
      let power = '';
      let chargingType = '';

      switch (type.toLowerCase()) {
        case 'ccs':
          name = 'Level 2 DC';
          power = '50kW Fast Charging';
          chargingType = 'Fast Charging';
          break;
        case 'type2':
          name = 'Level 1 DC';
          power = '15kW Fast Charging';
          chargingType = 'Fast Charging';
          break;
        case 'chademo':
          name = 'Normal AC';
          power = '3kW Charging';
          chargingType = 'Charging';
          break;
        default:
          name = 'Standard';
          power = '7kW Charging';
          chargingType = 'Charging';
      }

      return {
        name,
        power,
        chargingType,
        count: parseInt(count, 10),
      };
    });
  };

  const handleMarkerPress = charger => {
    setSelectedCharger(charger);
    setShowBottomSheet(true);
  };

  const renderEVChargers = () => {
    const filteredChargers = evChargers.filter(
      charger =>
        charger.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        charger.address.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    return filteredChargers.map((charger, index) => (
      <Marker
        key={`charger-${charger.id}`}
        coordinate={{
          latitude: parseFloat(charger.latitude),
          longitude: parseFloat(charger.longitude),
        }}
        onPress={() => handleMarkerPress(charger)}
      >
        <View style={styles.markerContainer}>
          <Text style={styles.markerNumber}>
            {getTotalConnectors(charger.connector_types)}
          </Text>
        </View>
      </Marker>
    ));
  };

  const renderConnectorIcon = type => {
    // You can customize these icons based on connector type
    return (
      <View style={styles.connectorIcon}>
        <Text style={styles.connectorIconText}>🔌</Text>
      </View>
    );
  };

  const renderBottomSheet = () => {
    if (!showBottomSheet || !selectedCharger) return null;

    const connectorDetails = getConnectorDetails(
      selectedCharger.connector_types,
    );

    return (
      <View style={styles.bottomSheet}>
        <View style={styles.bottomSheetHandle} />

        <ScrollView style={styles.bottomSheetContent}>
          <View style={styles.chargerHeader}>
            <View style={styles.chargerTitleRow}>
              <Text style={styles.chargerTitle}>EXPRESSWAY CHARGING...</Text>
              <TouchableOpacity
                style={styles.navigationButton}
                onPress={() => {
                  /* Add navigation logic */
                }}
              >
                <Text style={styles.navigationIcon}>📍</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.chargerSubtitle}>
              {selectedCharger.address} • {selectedCharger.distance}{' '}
              {selectedCharger.distance_metrics}
            </Text>
          </View>

          <Text style={styles.connectorsHeader}>SUPPORTED CONNECTORS</Text>

          {connectorDetails.map((connector, index) => (
            <View key={index} style={styles.connectorRow}>
              {renderConnectorIcon(connector.name)}
              <View style={styles.connectorInfo}>
                <Text style={styles.connectorName}>{connector.name}</Text>
                <Text style={styles.connectorPower}>{connector.power}</Text>
              </View>
              <View style={styles.connectorCount}>
                <Text style={styles.connectorCountText}>
                  x{connector.count}
                </Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.expandButton}>
            <Text style={styles.expandIcon}>⌄</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for the compatible chargers"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      <ViewShot
        ref={mapRef}
        style={styles.map}
        options={{ format: 'webp', quality: 0.9 }}
      >
        <MapView
          style={styles.map}
          region={location || DEFAULT_REGION}
          showsUserLocation={true}
        >
          {/* User location marker */}
          {location && (
            <Marker
              coordinate={location}
              title="You are here"
              description="Your current location"
            >
              <View style={styles.userLocationMarker}>
                <View style={styles.userLocationDot} />
              </View>
            </Marker>
          )}

          {/* EV Chargers markers */}
          {renderEVChargers()}
        </MapView>
      </ViewShot>

      {!location && (
        <Text style={styles.waitingText}>
          {errorMsg ? errorMsg : 'Waiting for location...'}
        </Text>
      )}

      {/* Bottom Sheet */}
      {renderBottomSheet()}

      {/* Overlay to close bottom sheet */}
      {showBottomSheet && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => setShowBottomSheet(false)}
          activeOpacity={1}
        />
      )}

      <FAB
        style={[
          styles.fab,
          { bottom: showBottomSheet ? height * 0.6 + 20 : 32 },
        ]}
        icon="camera"
        loading={uploading}
        onPress={handleCaptureAndUpload}
        size="small"
        disabled={uploading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    flex: 1,
  },
  searchContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: '#2d2d2d',
    borderRadius: 25,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2d2d2d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    color: '#fff',
    fontSize: 18,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2d2d2d',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterIcon: {
    color: '#4CAF50',
    fontSize: 16,
  },
  waitingText: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    zIndex: 1,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    color: 'red',
    fontWeight: 'bold',
  },
  markerContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  markerNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userLocationMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 105, 180, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userLocationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF69B4',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 15,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.6,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  bottomSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  chargerHeader: {
    marginBottom: 20,
  },
  chargerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chargerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navigationButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navigationIcon: {
    fontSize: 16,
  },
  chargerSubtitle: {
    color: '#999',
    fontSize: 14,
  },
  connectorsHeader: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 1,
  },
  connectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  connectorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  connectorIconText: {
    fontSize: 18,
  },
  connectorInfo: {
    flex: 1,
  },
  connectorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  connectorPower: {
    color: '#999',
    fontSize: 14,
  },
  connectorCount: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#333',
    borderRadius: 12,
  },
  connectorCountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  expandButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  expandIcon: {
    color: '#666',
    fontSize: 20,
  },
  fab: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#4CAF50',
  },
});

export default HomeScreen;
