export interface BotSummarization {
  summary: string;
  botName: string;
  numberOfMessages: number;
}

export interface BotSummarizationOutput extends BotSummarization {
  detectedAsSingleBotChannel: boolean;
}
