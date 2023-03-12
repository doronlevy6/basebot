import axios from 'axios';
import { IAuthenticationMetadata } from '../email-digest-settings/types';
import {
  DigestAction,
  MAIL_BOT_SERVICE_API,
  ResolveActionConfig,
  ResolveMailAction,
} from '../types';

const MailbotPaths: Map<ResolveMailAction, string> = new Map([
  [DigestAction.Archive, '/mail/gmail-client/archive'],
  [DigestAction.ArchiveAll, '/mail/bulk-actions/archive'],
  [DigestAction.MarkAsRead, '/mail/gmail-client/markAsRead'],
  [DigestAction.MarkAllAsRead, '/mail/bulk-actions/mark-as-read'],
]);

interface ResolveMailParams extends IAuthenticationMetadata {
  messageId: string;
}

export const resolveMail = async (
  resolveAction: ResolveMailAction,
  params: ResolveMailParams,
) => {
  const { slackUserId, slackTeamId, messageId } = params;
  const url = new URL(MAIL_BOT_SERVICE_API);
  const path = MailbotPaths.get(resolveAction);
  if (!path) {
    throw new Error(`no path found for action ${resolveAction}`);
  }

  url.pathname = path;
  const isBulk = ResolveActionConfig[resolveAction]?.isBulkAction;

  const response = await axios.post(
    url.toString(),
    {
      slackUserId,
      slackTeamId,
      ...(isBulk ? { groupId: messageId } : { id: messageId }),
    },
    {
      timeout: 60000,
    },
  );

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(
      `email archiveHandler wasn't able to mark as read for user ${slackUserId} with response ${response.status}`,
    );
  }
};
