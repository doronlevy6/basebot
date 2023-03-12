import { AnalyticsManager } from '@base/gistbot-shared';
import { SlackBlockActionWrapper, ViewAction } from '../../slack/types';
import {
  saveEmailDigestClassificationHandler,
  showEmailDigestClassifcationsModal,
} from '../email-digest-settings/email-digest-classification';
import { HomeDataStore } from '../../home/home-data-store';

export const userEmailCalssifcation =
  (analyticsManager: AnalyticsManager, homeStore: HomeDataStore) =>
  async (props: SlackBlockActionWrapper) => {
    await props.ack();
    await showEmailDigestClassifcationsModal(
      analyticsManager,
      homeStore,
    )(props);
  };

export const userEmailChangeCategory =
  (analyticsManager: AnalyticsManager, homeStore: HomeDataStore) =>
  async (props: ViewAction) => {
    await props.ack();
    await saveEmailDigestClassificationHandler(
      analyticsManager,
      homeStore,
    )(props);
  };
