import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import StoryBar from '../../src/components/stories/StoryBar';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Immersive Hero Section */}
        <View style={styles.heroContainer}>
          <LinearGradient
            colors={['#7D39EB', '#050505']}
            style={styles.heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          
          <View style={styles.heroTopRow}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>H</Text>
            </View>
            <TouchableOpacity style={styles.iconButton}>
              <Feather name="bell" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroBody}>
            <View style={styles.heroBadge}>
              <Feather name="zap" size={12} color="#C6FF33" />
              <Text style={styles.heroBadgeText}>Community First</Text>
            </View>

            <Text style={styles.heroTitle}>Hustle{"\n"}Up</Text>
            <Text style={styles.heroSubtitle}>
              The premium marketplace for independent creators and go-getters.
            </Text>

            <View style={styles.heroActions}>
              <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85}>
                <Text style={styles.primaryButtonText}>Browse Shops</Text>
                <Feather name="arrow-right" size={16} color="#050505" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.7}>
                <Feather name="play" size={14} color="#FFF" />
                <Text style={styles.secondaryButtonText}>How it works</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Stories Section */}
        <View style={styles.storiesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Community Stories</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <StoryBar />
        </View>

        {/* Explore Cards */}
        <View style={styles.exploreGrid}>
          <TouchableOpacity style={styles.exploreCard} activeOpacity={0.9}>
            <LinearGradient
              colors={['rgba(125, 57, 235, 0.2)', 'rgba(0,0,0,0.4)']}
              style={styles.cardGradient}
            />
            <View style={styles.cardContent}>
              <Feather name="trending-up" size={24} color="#C6FF33" />
              <Text style={styles.cardTitle}>Trending Now</Text>
              <Text style={styles.cardSubtitle}>Discover hot items</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.exploreCard, styles.violetCard]} activeOpacity={0.9}>
             <LinearGradient
              colors={['#7D39EB', '#3D1B7D']}
              style={styles.cardGradient}
            />
            <View style={styles.cardContent}>
              <Feather name="users" size={24} color="#FFF" />
              <Text style={styles.cardTitle}>Creators</Text>
              <Text style={styles.cardSubtitle}>Join the network</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Status Card */}
        <View style={styles.statusSection}>
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusDot} />
              <Text style={styles.statusLabel}>SYSTEM ONLINE</Text>
            </View>
            <Text style={styles.statusBody}>
              Connected to HustleUp Backend v2.4. Story viewing analytics and brand refresh enabled.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050505',
  },
  content: {
    paddingBottom: 40,
  },
  heroContainer: {
    paddingTop: 60,
    paddingHorizontal: 24,
    height: 480,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#C6FF33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#050505',
    fontWeight: '900',
    fontSize: 20,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    marginTop: 'auto',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  heroBadgeText: {
    color: '#C6FF33',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 64,
    lineHeight: 64,
    fontWeight: '900',
    letterSpacing: -2,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
    maxWidth: 280,
    fontWeight: '500',
  },
  heroActions: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#C6FF33',
  },
  primaryButtonText: {
    color: '#050505',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  secondaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  storiesSection: {
    marginTop: 20,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  seeAllText: {
    color: '#C6FF33',
    fontSize: 14,
    fontWeight: '700',
  },
  exploreGrid: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginTop: 20,
  },
  exploreCard: {
    flex: 1,
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  violetCard: {
    backgroundColor: '#7D39EB',
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  cardContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
    gap: 4,
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  statusSection: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  statusCard: {
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C6FF33',
  },
  statusLabel: {
    color: '#C6FF33',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  statusBody: {
    color: '#777',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
});
