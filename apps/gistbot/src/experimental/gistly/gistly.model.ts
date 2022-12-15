import { Configuration, OpenAIApi } from 'openai';

export class GistlyModel {
  private openai: OpenAIApi;

  constructor() {
    const configuration = new Configuration({
      apiKey: process.env.OPEN_AI_KEY,
    });
    this.openai = new OpenAIApi(configuration);
  }

  async correctGrammer(text: string) {
    const title = 'A block of text in english:';
    const prompt = 'A new version with corrected grammer:';
    return this.callApi(`${title}\n${text}\n\n${prompt}`, 0);
  }

  async shortenText(text: string) {
    const title = 'A block of text in english:';
    const prompt = 'short version of the above:';
    return this.callApi(`${title}\n${text}\n\n${prompt}`, 0.2);
  }

  async generateMore(text: string) {
    const title = 'A block of text in english:';
    return this.callApi(`${title}\n${text}`);
  }

  async emojify(text: string) {
    const title = 'A block of text in english:';
    const prompt = 'Same block of text with emojis between sentences:';
    return this.callApi(`${title}\n${text}\n\n${prompt}`);
  }

  async customModel(text: string) {
    return this.callApi(text);
  }

  private async callApi(prompt: string, temperature = 1) {
    const response = await this.openai.createCompletion({
      model: 'text-davinci-003',
      prompt,
      temperature,
      max_tokens: 1000,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stop: '\n\n\n',
    });

    const { data } = response;

    return data.choices[0].text;
  }
}
