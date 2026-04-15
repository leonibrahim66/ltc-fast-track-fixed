// Web shim for react-native-maps
// Provides stub implementations for web platform

import React from 'react';
import { View, Text, type ViewProps } from 'react-native';

// Stub MapView component for web
const MapView = React.forwardRef<View, ViewProps & { style?: any }>((props, ref) => (
  <View
    ref={ref}
    style={[
      { width: '100%', height: '100%', backgroundColor: '#E5E7EB' },
      props.style,
    ]}
  >
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#6B7280' }}>Map view available on mobile app</Text>
    </View>
  </View>
));

MapView.displayName = 'MapView';

// Stub components
export const Marker = React.forwardRef<View, ViewProps>((props, ref) => (
  <View ref={ref} style={{ display: 'none' }} />
));
Marker.displayName = 'Marker';

export const Polygon = React.forwardRef<View, ViewProps>((props, ref) => (
  <View ref={ref} style={{ display: 'none' }} />
));
Polygon.displayName = 'Polygon';

export const Circle = React.forwardRef<View, ViewProps>((props, ref) => (
  <View ref={ref} style={{ display: 'none' }} />
));
Circle.displayName = 'Circle';

export const Polyline = React.forwardRef<View, ViewProps>((props, ref) => (
  <View ref={ref} style={{ display: 'none' }} />
));
Polyline.displayName = 'Polyline';

export const Callout = React.forwardRef<View, ViewProps>((props, ref) => (
  <View ref={ref} style={{ display: 'none' }} />
));
Callout.displayName = 'Callout';

export const PROVIDER_DEFAULT = 'default';
export const PROVIDER_GOOGLE = 'google';

export default MapView;
