import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  Text,
  Alert,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import ViewShot from 'react-native-view-shot';
import { FAB } from 'react-native-paper';

const DEFAULT_REGION = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const HomeScreen = () => {
  const [location, setLocation] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const mapRef = useRef();

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
        // On iOS, permissions are handled by Info.plist, but we can still check
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
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
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
      // TODO: Implement Google Drive upload logic here
      Alert.alert('Screenshot captured', uri);
      // Example: await uploadToGoogleDrive(uri);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ViewShot
        ref={mapRef}
        style={styles.map}
        options={{ format: 'webp', quality: 0.9 }}
      >
        <MapView
          style={styles.map}
          region={location || DEFAULT_REGION}
          showsUserLocation={true} // Show blue dot for user
        >
          <Marker
            coordinate={location || DEFAULT_REGION}
            pinColor="pink"
            title={location ? 'You are here' : 'Default Location'}
            description="Your current location"
          />
        </MapView>
      </ViewShot>
      {!location && (
        <Text style={styles.waitingText}>
          {errorMsg ? errorMsg : 'Waiting for location...'}
        </Text>
      )}
      <FAB
        style={styles.fab}
        icon="camera"
        loading={uploading}
        onPress={handleCaptureAndUpload}
        label="Capture & Upload"
        disabled={uploading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  waitingText: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    zIndex: 1,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    color: 'red',
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    backgroundColor: '#e91e63',
  },
});

export default HomeScreen;
