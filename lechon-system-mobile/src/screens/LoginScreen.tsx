import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getApiBaseUrl } from '../services/apiClient';

export default function LoginScreen() {
  const { login, apiEnv, switchApiEnv } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setErrorMessage(null);
    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setErrorMessage('Please enter both your staff username and shift password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmedUser, password);
    } catch (error: unknown) {
      const axiosErr = error as {
        response?: { status?: number; data?: { message?: string } | string };
        message?: string;
      };
      if (axiosErr.response?.status === 401) {
        setErrorMessage('Invalid credentials. Please verify your username and password.');
      } else if (typeof axiosErr.response?.data === 'string') {
        setErrorMessage(axiosErr.response.data);
      } else if (axiosErr.response?.data?.message) {
        setErrorMessage(axiosErr.response.data.message);
      } else {
        setErrorMessage(
          `Unable to reach API (${getApiBaseUrl()}). Check your network or toggle Cloud/Local mode.`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (presetUser: string, presetPass: string) => {
    setErrorMessage(null);
    setUsername(presetUser);
    setPassword(presetPass);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🐷</Text>
            </View>
            <Text style={styles.brandTitle}>YUMI&apos;S LECHON</Text>
            <Text style={styles.brandSubtitle}>
              MOBILE COMMAND &amp; CASHIER COMPANION
            </Text>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            {/* API Environment Switcher Pill */}
            <View style={styles.envSection}>
              <Text style={styles.envLabel}>TARGET BACKEND ENVIRONMENT</Text>
              <View style={styles.envSwitchRow}>
                <Pressable
                  style={[
                    styles.envPill,
                    apiEnv === 'cloud' && styles.envPillActive,
                  ]}
                  onPress={() => switchApiEnv('cloud')}
                >
                  <Text
                    style={[
                      styles.envPillText,
                      apiEnv === 'cloud' && styles.envPillTextActive,
                    ]}
                  >
                    ☁️ Live Cloud API
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.envPill,
                    apiEnv === 'local' && styles.envPillActive,
                  ]}
                  onPress={() => switchApiEnv('local')}
                >
                  <Text
                    style={[
                      styles.envPillText,
                      apiEnv === 'local' && styles.envPillTextActive,
                    ]}
                  >
                    💻 Local API (localhost:5199)
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.envUrlHint} numberOfLines={1}>
                Endpoint: {getApiBaseUrl()}
              </Text>
            </View>

            {/* Card Header */}
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Shift Sign-In</Text>
              <View style={styles.jwtBadge}>
                <Text style={styles.jwtBadgeText}>🛡️ 12h Shift JWT</Text>
              </View>
            </View>
            <Text style={styles.cardDescription}>
              Sign in with your Owner or Cashier credentials to access the live order directory and customer dossiers.
            </Text>

            {/* Error Banner */}
            {errorMessage && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>⚠️ {errorMessage}</Text>
              </View>
            )}

            {/* Username Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Staff Username</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. owner or cashier"
                placeholderTextColor="#78716C"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                value={username}
                onChangeText={setUsername}
                returnKeyType="next"
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Shift Password</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••••••"
                  placeholderTextColor="#78716C"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                />
                <Pressable
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((prev) => !prev)}
                >
                  <Text style={styles.eyeButtonText}>
                    {showPassword ? '🙈 Hide' : '👁️ Show'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Primary Submit Button */}
            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
                pressed && !isSubmitting && styles.submitButtonPressed,
              ]}
              onPress={handleSignIn}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.submitButtonText}>Verifying Shift...</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>Start 12-Hour Shift</Text>
              )}
            </Pressable>

            {/* 1-Tap Quick-Fill Test Presets */}
            <View style={styles.presetSection}>
              <Text style={styles.presetTitle}>1-TAP QUICK-FILL TEST PRESETS</Text>
              <View style={styles.presetButtonsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.presetBtn,
                    styles.presetBtnOwner,
                    pressed && styles.presetBtnPressed,
                  ]}
                  onPress={() => handleQuickFill('owner', 'OwnerPassword123!')}
                >
                  <Text style={styles.presetBtnOwnerText}>👑 Fill Owner</Text>
                  <Text style={styles.presetSubText}>owner • OwnerPassword123!</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.presetBtn,
                    styles.presetBtnCashier,
                    pressed && styles.presetBtnPressed,
                  ]}
                  onPress={() => handleQuickFill('cashier', 'CashierPassword123!')}
                >
                  <Text style={styles.presetBtnCashierText}>🧑‍💼 Fill Cashier</Text>
                  <Text style={styles.presetSubText}>cashier • CashierPassword123!</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <Text style={styles.footerText}>
            Cavite Lechon Roasting Operations • Shift Security Protected
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#181312',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#291D1A',
    borderWidth: 3,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoEmoji: {
    fontSize: 34,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D6D3D1',
    letterSpacing: 1,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#221A18',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3D302C',
    padding: 20,
  },
  envSection: {
    backgroundColor: '#15100F',
    borderRadius: 12,
    padding: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#2E2320',
  },
  envLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A8A29E',
    letterSpacing: 0.8,
    marginBottom: 8,
    textAlign: 'center',
  },
  envSwitchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  envPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#241C1A',
    borderWidth: 1,
    borderColor: '#3D302C',
    alignItems: 'center',
  },
  envPillActive: {
    backgroundColor: '#451A03',
    borderColor: '#F59E0B',
  },
  envPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A8A29E',
  },
  envPillTextActive: {
    color: '#FBBF24',
    fontWeight: '700',
  },
  envUrlHint: {
    fontSize: 10,
    color: '#78716C',
    textAlign: 'center',
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAFAF9',
  },
  jwtBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  jwtBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FBBF24',
  },
  cardDescription: {
    fontSize: 12,
    color: '#A8A29E',
    lineHeight: 18,
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: 'rgba(136, 19, 55, 0.45)',
    borderWidth: 1,
    borderColor: '#BE123C',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#FDA4AF',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E7E5E4',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#120E0D',
    borderWidth: 1,
    borderColor: '#44403C',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#FFFFFF',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#120E0D',
    borderWidth: 1,
    borderColor: '#44403C',
    borderRadius: 10,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#FFFFFF',
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eyeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FBBF24',
  },
  submitButton: {
    backgroundColor: '#C81E1E',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitButtonPressed: {
    backgroundColor: '#A81818',
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  presetSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#3D302C',
  },
  presetTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A8A29E',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetBtnOwner: {
    backgroundColor: 'rgba(126, 34, 206, 0.18)',
    borderColor: 'rgba(168, 85, 247, 0.45)',
  },
  presetBtnCashier: {
    backgroundColor: 'rgba(29, 78, 216, 0.18)',
    borderColor: 'rgba(59, 130, 246, 0.45)',
  },
  presetBtnPressed: {
    opacity: 0.75,
  },
  presetBtnOwnerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E9D5FF',
  },
  presetBtnCashierText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#BFDBFE',
  },
  presetSubText: {
    fontSize: 10,
    color: '#A8A29E',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#78716C',
    marginTop: 20,
  },
});
