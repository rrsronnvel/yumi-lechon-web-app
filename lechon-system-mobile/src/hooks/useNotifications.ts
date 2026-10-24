import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications/build/NotificationPermissions';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';

const CHANNEL_ID = 'default';
const DEFROST_REMINDER_KEY = 'daily-defrost';
const DEPOSIT_REMINDER_KEY = 'daily-deposit';

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
  const [alertsActive, setAlertsActive] = useState(false);
  const previousOwnerCount = useRef<number | null>(null);
  const previousRushIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let isMounted = true;

    const configureNotifications = async () => {
      if (Platform.OS === 'android') {
        await setNotificationChannelAsync(CHANNEL_ID, {
          name: 'Operational alerts',
          importance: AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      const currentPermissions = await getPermissionsAsync();
      const permissions = currentPermissions.granted
        ? currentPermissions
        : await requestPermissionsAsync();

      if (!permissions.granted) {
        if (isMounted) setAlertsActive(false);
        return;
      }

      const scheduled = await getAllScheduledNotificationsAsync();
      const reminderKeys = new Set(
        scheduled
          .map((notification) => notification.content.data?.operationalReminder)
          .filter((value): value is string => typeof value === 'string')
      );

      if (!reminderKeys.has(DEFROST_REMINDER_KEY)) {
        await scheduleNotificationAsync({
          content: {
            title: '🐷 Freezer Defrost Time!',
            body: "Check Tonight's Defrost Roster in Floor Action and copy the pull-list for the kitchen.",
            data: { operationalReminder: DEFROST_REMINDER_KEY },
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DAILY,
            hour: 16,
            minute: 0,
            channelId: CHANNEL_ID,
          },
        });
      }

      if (!reminderKeys.has(DEPOSIT_REMINDER_KEY)) {
        await scheduleNotificationAsync({
          content: {
            title: '⚠️ Deposit Follow-Up',
            body: 'Check the 4-day Downpayment Radar in Floor Action.',
            data: { operationalReminder: DEPOSIT_REMINDER_KEY },
          },
          trigger: {
            type: SchedulableTriggerInputTypes.DAILY,
            hour: 9,
            minute: 0,
            channelId: CHANNEL_ID,
          },
        });
      }

      if (isMounted) setAlertsActive(true);
    };

    configureNotifications().catch(() => {
      if (isMounted) setAlertsActive(false);
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
      alertsActive &&
      isOwner &&
      pendingOwnerConfirmations > previousOwnerCount.current
    ) {
      void scheduleNotificationAsync({
        content: {
          title: '👑 New Order Needs Confirmation',
          body: 'A cashier order is waiting for Owner review in Floor Action.',
        },
        trigger: null,
      });
    }

    previousOwnerCount.current = pendingOwnerConfirmations;
  }, [alertsActive, isOwner, pendingOwnerConfirmations]);

  useEffect(() => {
    const currentRushIds = new Set(rushDefrostIds);
    if (previousRushIds.current === null) {
      previousRushIds.current = currentRushIds;
      return;
    }

    const hasNewRushItem = rushDefrostIds.some(
      (rushId) => !previousRushIds.current?.has(rushId)
    );
    if (alertsActive && hasNewRushItem) {
      void scheduleNotificationAsync({
        content: {
          title: '🚨 Rush Defrost Added',
          body: 'A new rush item needs immediate freezer action. Check Floor Action now.',
        },
        trigger: null,
      });
    }

    previousRushIds.current = currentRushIds;
  }, [alertsActive, rushDefrostIds]);

  const sendTestNotification = useCallback(async () => {
    if (!alertsActive) {
      throw new Error('Notification permission is not enabled on this device.');
    }

    await scheduleNotificationAsync({
      content: {
        title: '🔔 Yumi\'s Alerts Active',
        body: 'Operational notifications are working on this handset.',
      },
      trigger: null,
    });
  }, [alertsActive]);

  return { alertsActive, sendTestNotification };
};
