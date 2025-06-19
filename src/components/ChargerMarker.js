import React from 'react';
import { Marker } from 'react-native-maps';
import { Image } from 'react-native';

const ChargerMarker = ({ charger }) => {
  const { latitude, longitude, name } = charger;

  return (
    <Marker
      coordinate={{
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      }}
      title={name}
      description={charger.address}
    >
      <Image
        source={require('../../assets/icons/evc.png')} // Use flaticon image
        style={{ width: 40, height: 40 }}
        resizeMode="contain"
      />
    </Marker>
  );
};

export default ChargerMarker;
