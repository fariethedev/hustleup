import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function GenericProfileScreen() {
  const { title = 'Page', icon, color } = useLocalSearchParams();
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.content}>
        <Feather name={icon || "layers"} size={64} color={color || "#CDFF00"} />
        <Text style={styles.text}>This is where your {title.toLowerCase()} data will appear.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505', paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 20 },
  title: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 40 },
  text: { color: '#AAA', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
