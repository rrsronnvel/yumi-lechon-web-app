import { isRunningInExpoGo } from 'expo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

const CHANNEL_ID = 'default';
const DEFROST_REMINDER_KEY = 'daily-defrost';
const DEPOSIT_REMINDER_KEY = 'daily-deposit';
const IS_ANDROID_EXPO_GO = Platform.OS === 'android' && isRunningInExpoGo();

let notificationsModulePromise: Promise<NotificationsModule | null> | null =
  null;

const loadNotificationsModule = async (): Promise<NotificationsModule | null> => {
  // Expo Go for Android currently omits ExpoTopicSubscriptionModule. Importing
  // expo-notifications there crashes before a runtime fallback can be shown.
  if (IS_ANDROID_EXPO_GO) return null;

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications')
      .then((notifications) => {
        notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });
        return notifications;
      })
      .catch(() => null);
  }

  return notificationsModulePromise;
};

const showTestNotificationFallback = () => {
  Alert.alert(
    '🔔 Test Defrost Alert (Simulator Preview)',
    "Freezer Defrost Time! Pull 6 Whole Lechons & 2 Bellies for tomorrow's roster."
  );
};

interface UseNotificationsOptions {
  isAuthenticated: boolean;
  isOwner: boolean;
  pendingOwnerConfirmations: number;
  rushDefrostIds: string[];
}

export const useNotifications = ({
  isAuthenticated,
  isOwner,
  pendingOwnerConfirmations,
  rushDefrostIds,
}: UseNotificationsOptions) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [usesInAppFallback, setUsesInAppFallback] =
    useState(IS_ANDROID_EXPO_GO);
  const previousOwnerCount = useRef<number | null>(null);
  const previousRushIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setHasPermission(false);
      return;
    }

    let isMounted = true;

    const initNotifications = async () => {
      const notifications = await loadNotificationsModule();
      if (!notifications) {
        if (isMounted) {
          setHasPermission(false);
          setUsesInAppFallback(true);
        }
        return;
      }

      if (isMounted) setUsesInAppFallback(false);

      if (Platform.OS === 'android') {
        await notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'default',
          importance: notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#C81E1E',
        });
      }

      const { status: existingStatus } =
        await notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const requestedPermissions =
          await notifications.requestPermissionsAsync();
        finalStatus = requestedPermissions.status;
      }

      const permissionGranted = finalStatus === 'granted';
      if (isMounted) setHasPermission(permissionGranted);
      if (!permissionGranted) return;

      try {
        const scheduled =
          await notifications.getAllScheduledNotificationsAsync();
        const reminderKeys = new Set(
          scheduled
            .map(
              (notification) =>
                notification.content.data?.operationalReminder
            )
            .filter((value): value is string => typeof value === 'string')
        );

        if (!reminderKeys.has(DEFROST_REMINDER_KEY)) {
          await notifications.scheduleNotificationAsync({
            content: {
              title: '🐷 Freezer Defrost Time!',
              body: "Check Tonight's Defrost Roster in Floor Action and copy the pull-list for the kitchen.",
              data: { operationalReminder: DEFROST_REMINDER_KEY },
            },
            trigger: {
              type: notifications.SchedulableTriggerInputTypes.DAILY,
              hour: 16,
              minute: 0,
              channelId: CHANNEL_ID,
            },
          });
        }

        if (!reminderKeys.has(DEPOSIT_REMINDER_KEY)) {
          await notifications.scheduleNotificationAsync({
            content: {
              title: '⚠️ Deposit Follow-Up',
              body: 'Check the 4-day Downpayment Radar in Floor Action.',
              data: { operationalReminder: DEPOSIT_REMINDER_KEY },
            },
            trigger: {
              type: notifications.SchedulableTriggerInputTypes.DAILY,
              hour: 9,
              minute: 0,
              channelId: CHANNEL_ID,
            },
          });
        }
      } catch {
        // Permission remains valid even if a simulator cannot persist reminders.
      }
    };

    initNotifications().catch(() => {
      if (isMounted) {
        setHasPermission(false);
        setUsesInAppFallback(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (previousOwnerCount.current === null) {
      previousOwnerCount.current = pendingOwnerConfirmations;
      return;
    }

    if (
      hasPermission &&
      isOwner &&
      pendingOwnerConfirmations > previousOwnerCount.current
    ) {
      void loadNotificationsModule().then((notifications) =>
        notifications
          ?.scheduleNotificationAsync({
            content: {
              title: '👑 New Order Needs Confirmation',
              body: 'A cashier order is waiting for Owner review in Floor Action.',
            },
            trigger: null,
          })
          .catch(() => undefined)
      );
    }

    previousOwnerCount.current = pendingOwnerConfirmations;
  }, [hasPermission, isOwner, pendingOwnerConfirmations]);

  useEffect(() => {
    const currentRushIds = new Set(rushDefrostIds);
    if (previousRushIds.current === null) {
      previousRushIds.current = currentRushIds;
      return;
    }

    const hasNewRushItem = rushDefrostIds.some(
      (rushId) => !previousRushIds.current?.has(rushId)
    );
    if (hasPermission && hasNewRushItem) {
      void loadNotificationsModule().then((notifications) =>
        notifications
          ?.scheduleNotificationAsync({
            content: {
              title: '🚨 Rush Defrost Added',
              body: 'A new rush item needs immediate freezer action. Check Floor Action now.',
            },
            trigger: null,
          })
          .catch(() => undefined)
      );
    }

    previousRushIds.current = currentRushIds;
  }, [hasPermission, rushDefrostIds]);

  const sendTestNotification = useCallback(async () => {
    try {
      const notifications = await loadNotificationsModule();
      if (!notifications) {
        setUsesInAppFallback(true);
        showTestNotificationFallback();
        return;
      }

      let permissionGranted = hasPermission;
      if (!permissionGranted) {
        const requestedPermissions =
          await notifications.requestPermissionsAsync();
        permissionGranted = requestedPermissions.status === 'granted';
        setHasPermission(permissionGranted);
      }

      if (!permissionGranted) {
        showTestNotificationFallback();
        return;
      }

      await notifications.scheduleNotificationAsync({
        content: {
          title: "🔔 Yumi's Alerts Active",
          body: 'Operational notifications are working on this handset.',
        },
        trigger: null,
      });
    } catch {
      setUsesInAppFallback(true);
      showTestNotificationFallback();
    }
  }, [hasPermission]);

  return { alertsActive: hasPermission, usesInAppFallback, sendTestNotification };
};
