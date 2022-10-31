import { logger } from '@base/logger';
import { WebClient } from '@slack/web-api';
import { PgInstallationStore } from '../../installations/installationStore';
import { SlackMessage } from '../types';
import { SessionDataStore } from './session-data-store';
import { ChannelSummarySession, ThreadSummarySession } from './types';

interface SimpleUser {
  name: string;
  title: string;
  id: string;
}

type Message = SlackMessage | { messageId: string; error_fetching: true };

export interface SessionFetchRequest {
  sessionId: string;
  teamId: string;
}

interface Thread {
  messages: Message[];
  users: SimpleUser[];
  reactions: number[];
}

export interface SessionFetchResponse {
  threads: Thread[];
  summary: string;
  channel_name: string;
  feedbacks: Record<string, number>;
}

export class InternalSessionFetcher {
  constructor(
    private sessionDataStore: SessionDataStore,
    private installations: PgInstallationStore,
  ) {}

  async handleRequest(req: SessionFetchRequest): Promise<SessionFetchResponse> {
    const installation = await this.installations.fetchInstallationByTeamId(
      req.teamId,
    );
    if (!installation.bot?.token) {
      throw new Error('token not found on installation');
    }

    const session = await this.sessionDataStore.fetchSession({
      sessionId: req.sessionId,
      teamId: req.teamId,
    });

    if (session.summaryType === 'thread') {
      return this.fetchThreadSummarySession(
        session,
        installation.bot.token,
        req.teamId,
        req.sessionId,
      );
    }

    return this.fetchChannelSummarySession(
      session,
      installation.bot.token,
      req.teamId,
      req.sessionId,
    );
  }

  private async fetchThreadSummarySession(
    session: ThreadSummarySession,
    token: string,
    teamId: string,
    sessionId: string,
  ): Promise<SessionFetchResponse> {
    const client = new WebClient(token);

    const [feedbacks, [users, messages]] = await Promise.all([
      this.sessionDataStore.fetchSessionFeedbacks({
        teamId: teamId,
        sessionId: sessionId,
      }),
      this.fetchThreadData(
        {
          messageIds: session.request.messageIds,
          userIds: session.request.userIds,
        },
        session.channelId,
        teamId,
        client,
      ),
    ]);

    return {
      threads: [
        {
          messages: messages,
          users: users,
          reactions: session.request.reactions,
        },
      ],
      channel_name: session.request.channel_name,
      summary: session.response,
      feedbacks: feedbacks,
    };
  }

  private async fetchChannelSummarySession(
    session: ChannelSummarySession,
    token: string,
    teamId: string,
    sessionId: string,
  ): Promise<SessionFetchResponse> {
    const client = new WebClient(token);

    const [feedbacks, threads] = await Promise.all([
      this.sessionDataStore.fetchSessionFeedbacks({
        teamId: teamId,
        sessionId: sessionId,
      }),
      session.request.threads.map((thread) => {
        return this.fetchThreadData(
          {
            messageIds: thread.messageIds,
            userIds: thread.userIds,
          },
          session.channelId,
          teamId,
          client,
        );
      }),
    ]);

    return {
      threads: threads.map((t, idx) => {
        return {
          messages: t[1],
          users: t[0],
          reactions: session.request.threads[idx].reactions,
        };
      }),
      channel_name: session.request.channel_name,
      summary: session.response,
      feedbacks: feedbacks,
    };
  }

  private async fetchThreadData(
    thread: {
      messageIds: string[];
      userIds: string[];
    },
    channelId: string,
    teamId: string,
    client: WebClient,
  ): Promise<[SimpleUser[], Message[]]> {
    const usersPromise = Promise.all(
      thread.userIds.map((uid) => {
        return this.fetchUserOrBotInfo(uid, teamId, client);
      }),
    );

    const messagesPromise = Promise.all(
      thread.messageIds.map((mid) => {
        return this.fetchMessage(
          channelId,
          thread.messageIds[0],
          mid,
          teamId,
          client,
        );
      }),
    );

    return Promise.all([usersPromise, messagesPromise]);
  }

  private async fetchMessage(
    channelId: string,
    rootMessageId: string,
    messageId: string,
    teamId: string,
    client: WebClient,
  ): Promise<Message> {
    return client.conversations
      .replies({
        ts: messageId,
        channel: channelId,
        latest: messageId,
        limit: 1,
        inclusive: true,
      })
      .then((res) => {
        if (res.error) {
          throw new Error(`bot user error: ${res.error}`);
        }
        if (!res.ok || !res.messages) {
          throw new Error('messages not ok');
        }
        return res.messages[0];
      })
      .catch((err) => {
        logger.error(
          `failed to get message for message ${messageId} on team ${teamId}: ${err}`,
        );
        return { messageId: messageId, error_fetching: true };
      });
  }

  private async fetchUserOrBotInfo(
    userId: string,
    teamId: string,
    client: WebClient,
  ): Promise<SimpleUser> {
    if (userId.startsWith('B')) {
      return client.bots
        .info({ bot: userId, team_id: teamId })
        .then((res) => {
          if (res.error) {
            throw new Error(`bot user error: ${res.error}`);
          }
          if (!res.ok || !res.bot) {
            throw new Error('bot user not ok');
          }

          const name = res.bot.name || 'Unknown Bot';
          const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

          return {
            name: capitalizedName,
            title: 'Bot',
            id: userId,
          };
        })
        .catch((reason) => {
          logger.error(
            `failed to get bot info for bot ${userId} on team ${teamId}: ${reason}`,
          );

          return {
            name: 'Unknown Bot',
            title: 'Bot',
            id: userId,
          };
        });
    }

    return client.users.profile
      .get({ user: userId })
      .then((res) => {
        if (res.error) {
          throw new Error(`user error: ${res.error}`);
        }
        if (!res.ok || !res.profile) {
          throw new Error('user not ok');
        }

        const name =
          res.profile.display_name ||
          res.profile.real_name ||
          res.profile.first_name ||
          'Unknown User';
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);

        return {
          name: capitalizedName,
          title: res.profile.title || '',
          id: userId,
        };
      })
      .catch((reason) => {
        logger.error(
          `failed to get user info for user ${userId} on team ${teamId}: ${reason}`,
        );

        return {
          name: 'Unknown User',
          title: '',
          id: userId,
        };
      });
  }
}
