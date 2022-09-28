import { logger } from '@base/logger';
import { Task } from '@base/oapigen';
import { WebClient } from '@slack/web-api';
import {
  BlockButtonWrapper,
  BlockPlainTextInputActionWrapper,
  ViewAction,
} from '../../../slackbot/common/types';
import { AnalyticsManager } from '../analytics/analytics-manager';
import { ConvStore } from '../db/conv-store';
import { TaskView } from '../tasks/view';
import { AcknowledgementStatus, ITaskViewProps } from '../tasks/view/types';

export const updateTaskAndSendEvent = async (
  {
    client,
    body,
  }: BlockButtonWrapper | BlockPlainTextInputActionWrapper | ViewAction,
  data: {
    organizationId: string;
    assigneeId: string;
    task: Task;
    messageTs: string;
    channelId: string;
  },
  analytics: { action: string; data?: Record<string, string> },
  viewOverrides?: Partial<ITaskViewProps>,
) => {
  const { organizationId, assigneeId, task, channelId, messageTs } = data;
  const slackUserId = body.user.id;

  const lookupByEmails = [
    client.users.lookupByEmail({
      email: task.creator.email,
    }),
  ];

  task.owner &&
    lookupByEmails.push(
      client.users.lookupByEmail({
        email: task.owner.email,
      }),
    );

  const [creatorRes, ownerRes] = await Promise.all(lookupByEmails);

  if (creatorRes.error || !creatorRes.user?.id || !creatorRes.ok) {
    throw new Error(
      `Failed to update message when trying to get task creator by email : ${creatorRes.error}`,
    );
  }

  if (task.owner && (ownerRes.error || !ownerRes.user?.id || !ownerRes.ok)) {
    throw new Error(
      `Failed to update message when trying to get task owner by email : ${ownerRes.error}`,
    );
  }

  const taskView = TaskView({
    assignee: {
      id: slackUserId,
    },
    creator: {
      id: creatorRes.user.id,
    },
    owner: ownerRes?.user?.id ? { id: ownerRes.user.id } : undefined,
    baseOrgId: organizationId,
    baseUserId: assigneeId,
    task,
    acknowledgementStatus: AcknowledgementStatus.Acknowledged,
    ...viewOverrides,
  });

  const updatedMsg = await client.chat.update({
    ts: messageTs,
    channel: channelId,
    blocks: taskView.blocks,
  });

  if (updatedMsg && updatedMsg.ok && updatedMsg.ts) {
    await ConvStore.set(
      {
        taskId: task.id,
        baseOrgId: organizationId,
        slackUserId: channelId,
      },
      updatedMsg.ts,
    );
  }

  sendEvent(
    client,
    { slackUserId, action: analytics.action, taskId: task.id },
    analytics.data,
  );
};

const sendEvent = async (
  client: WebClient,
  data: { slackUserId: string; action: string; taskId: string },
  extraData?: Record<string, string>,
) => {
  const { action, slackUserId, taskId } = data;
  const user = await client.users.profile.get({ user: slackUserId });
  if (!user.profile?.email) {
    logger.warn(
      `unable to send user interaction for analytics without user profile`,
    );
    return;
  }
  AnalyticsManager.getInstance().userInteraction(user?.profile.email, {
    action,
    taskId: taskId,
    ...extraData,
  });
};
