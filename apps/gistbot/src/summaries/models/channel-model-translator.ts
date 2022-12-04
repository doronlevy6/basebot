import {
  ChannelSummary,
  ChannelSummaryModelRequest,
} from './channel-summary.model';
import {
  ConversationSummary,
  MessagesSummaryRequest,
} from './messages-summary.model';

export class ChannelModelTranslator {
  translateRequestToV2(
    data: MessagesSummaryRequest,
  ): ChannelSummaryModelRequest {
    const channelName = data[0].channel;

    const roots = data.filter((msg) => msg.ts === msg.thread_ts);
    const children = data.filter((msg) => msg.ts !== msg.thread_ts);

    // An extremely inefficient loop to create the old threads structure
    const threads = roots.map((root) => {
      const thread = {
        messages: [root.text],
        names: [root.user_name],
        titles: [root.user_title],
        reactions: [
          root.reactions.reduce((acc, cur) => {
            return acc + cur.count;
          }, 0),
        ],
      };

      children
        .filter((child) => child.thread_ts === root.thread_ts)
        .map((child) => {
          thread.messages.push(child.text);
          thread.names.push(child.user_name);
          thread.titles.push(child.user_title);
          thread.reactions.push(
            child.reactions.reduce((acc, cur) => {
              return acc + cur.count;
            }, 0),
          );
        });

      return thread;
    });

    return {
      channel_name: channelName,
      threads: threads,
    };
  }

  translateResponseToV3(data: ChannelSummary): ConversationSummary[] {
    return data.summary_by_threads.map((s, idx): ConversationSummary => {
      return {
        rootMessageTs: '',
        subMessagesTs: [],
        language: 'english',
        title: data.titles[idx],
        summary: s,
      };
    });
  }
}
