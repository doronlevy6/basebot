import { Configuration, OpenAIApi } from 'openai';
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

  async customModel(text: string, userId: string) {
    return this.callApi(text, userId);
  }

  private async callApi(prompt: string, userId: string, temperature = 1) {
    const response = await this.openai.createCompletion({
      model: 'text-davinci-003',
      prompt,
      temperature,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stop: '\n\n\n',
      user: userId,
    });

    const { data } = response;
    const generatedText = data.choices[0].text ?? '';

    const { flagged } = await this.moderationModel.moderate({
      input: generatedText,
    });

    if (flagged) {
      throw new ModerationError('moderated');
    }

    return generatedText;
  }
}
