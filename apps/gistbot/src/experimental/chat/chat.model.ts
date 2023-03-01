import { Configuration, OpenAIApi, CreateChatCompletionRequest } from 'openai';
import { ModerationError } from '../../summaries/errors/moderation-error';
import { OpenAiModerationModel } from '../../summaries/models/openai-moderation.model';
export class ChatModel {
  private openai: OpenAIApi;
  private moderationModel: OpenAiModerationModel;

  constructor() {
    const configuration = new Configuration({
      apiKey: process.env.OPEN_AI_KEY,
    });
    this.openai = new OpenAIApi(configuration);
    this.moderationModel = new OpenAiModerationModel();
  }

  async customModel(
    messages: CreateChatCompletionRequest['messages'],
    userId: string,
  ) {
    return this.callApi(messages, userId);
  }

  private async callApi(
    messages: CreateChatCompletionRequest['messages'],
    userId: string,
    temperature = 1,
  ) {
    const response = await this.openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages,
      user: userId,
      temperature,
    });

    const { data } = response;
    const generatedText = data.choices[0].message?.content ?? '';

    const { flagged } = await this.moderationModel.moderate({
      input: generatedText,
    });

    if (flagged) {
      throw new ModerationError('moderated');
    }

    return generatedText;
  }
}
