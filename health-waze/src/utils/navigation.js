// utils/navigation.js
import React, { useState } from 'react';

// Android detection
export const isAndroid = /Android/i.test(navigator.userAgent);

// Intent URL constructors
export const getGoogleMapsIntent = (destination, userLocation) => {
  if (userLocation) {
    return `intent://maps.google.com/maps?saddr=${userLocation.lat},${userLocation.lng}&daddr=${destination.lat},${destination.lng}#Intent;package=com.google.android.apps.maps;scheme=https;end`;
  }
  return `intent://maps.google.com/maps?daddr=${destination.lat},${destination.lng}#Intent;package=com.google.android.apps.maps;scheme=https;end`;
};

export const getWazeIntent = (destination) =>
  `intent://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes#Intent;package=com.waze;scheme=https;end`;

export const getUberIntent = (destination) =>
  `intent://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${destination.lat}&dropoff[longitude]=${destination.lng}#Intent;package=com.ubercab;scheme=https;end`;

// Fallback for non-Android
export const getWebGoogleMaps = (destination, userLocation) => {
  if (userLocation) {
    return `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${destination.lat},${destination.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${destination.lat},${destination.lng}`;
};