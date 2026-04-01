import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { store } from '../src/store';

export default function RootLayout() {
  return (
    <Provider store={store}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#050505' },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="light" />
    </Provider>
  );
}
