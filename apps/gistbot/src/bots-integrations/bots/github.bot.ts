import { SlackMessage } from '../../summaries/types';
import {
  Attachment,
  Message,
} from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import { IBotIntegration } from '../ibot-integration';
import { parseSlackMrkdwn } from '../../slack/parser';
import { TextSection } from '../../slack/sections/text-section';
import { UrlLinkSection } from '../../slack/sections/url-link-section';

export type GithubStructuredData = {
  userName: string;
  action: string;
  extraData: string;
};

const GITHUB_BOT_NAME = 'GitHub';

export class GithubBot extends IBotIntegration {
  getName(): string {
    return GITHUB_BOT_NAME;
  }

  handleBotMessages(botMessages: (Message | SlackMessage)[]) {
    const githubThreads = botMessages.flatMap((m) => {
      return this.extractGithubMessagesText(m);
    });
    const userPrUpdates = new Map<string, GithubStructuredData>();
    githubThreads.map((githubUpdate) =>
      userPrUpdates.set(
        `${githubUpdate.userName}:${githubUpdate.extraData}`,
        githubUpdate,
      ),
    );

    const userUpdatesMap = new Map<string, GithubStructuredData[]>();
    userPrUpdates.forEach((v) => {
      const userUpdates = userUpdatesMap.get(v.userName);
      if (userUpdates) {
        userUpdatesMap.set(v.userName, [...userUpdates, v]);
      } else {
        userUpdatesMap.set(v.userName, [v]);
      }
    });

    let text = '';
    userUpdatesMap.forEach((v, k) => {
      text = `${text}\n\n latest updates by *${k}*:\n>`;
      v.forEach((cb) => {
        text = `${text} ${cb.extraData} ${cb.action}\n>`;
      });
    });

    return {
      summary: text,
      numberOfMessages: botMessages.length,
      botName: GITHUB_BOT_NAME,
    };
  }

  private extractGithubMessagesText(
    message: SlackMessage,
  ): GithubStructuredData[] {
    const botProfileName =
      message.bot_profile?.name || message?.root?.bot_profile?.name;

    if (
      message.bot_id &&
      botProfileName?.toLowerCase() === 'github' &&
      message.attachments?.length
    ) {
      const data = this.extractDataFromAttachments(message.attachments)?.filter(
        (s) => !!s,
      );
      return data as GithubStructuredData[];
    }
    return [];
  }

  private extractDataFromAttachments(attachments: Attachment[]) {
    return attachments.flatMap((attachment) => {
      let user = '';
      let action = '';
      let pr = '';

      if (attachment.pretext && attachment.title) {
        const preTextSections = parseSlackMrkdwn(attachment.pretext);
        const parsedTitle = parseSlackMrkdwn(attachment.title);
        action = (preTextSections.sections[0] as TextSection).text;
        if (preTextSections.sections[0] instanceof TextSection) {
          if (action.toLowerCase().includes('pull request')) {
            action = (preTextSections.sections[0] as TextSection).text;
          }
        }
        if (preTextSections.sections[1] instanceof UrlLinkSection) {
          if ((preTextSections.sections[1] as UrlLinkSection).label) {
            user = (preTextSections.sections[1] as UrlLinkSection).label || '';
          }
        }
        pr = parsedTitle.originalText;
        const trim = action.toLowerCase().indexOf(' by');
        action = action.toLowerCase().slice(0, trim);
        if (action.toLowerCase().endsWith('merged')) {
          action += ' :rocket:';
        }
        if (action.toLowerCase().endsWith('closed')) {
          action += ' :x:';
        }
        if (action.toLowerCase().endsWith('opened')) {
          action += ' :eyes:';
        }
        if (action.toLowerCase().endsWith('ready for review')) {
          action += ' :eyes:';
        }
        return {
          userName: user,
          action: action,
          extraData: pr,
        };
      }
    });
  }
}
