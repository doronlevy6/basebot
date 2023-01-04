import * as fs from 'fs';

export class ChatGistDataStore {
  constructor() {}
  async getTeamsTokens(teamIds: string[]): Promise<Map<string, string>> {
    const teamToToken: Map<string, string> = new Map();
    try {
      const response = JSON.parse(
        fs.readFileSync('./tools/chatgist/tokens.json', 'utf-8'),
      );
      response.map((row) => {
        const token = row['raw']['bot']['token'];
        const teamId = row['slack_id'];
        if (teamIds.includes(teamId)) {
          teamToToken.set(teamId, token);
        }
      });
    } catch (error) {
      console.error(`error getting tokens for teams ${error}`);
    }
    return teamToToken;
  }
}
