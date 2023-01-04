import * as fs from 'fs';

const USERS_FILE = './tools/chatgist/successfulUsers.json';

type UserData = { userId: string; teamId: string; date?: string };
export class ChatGistOutPutStore {
  private successFulUsers: Map<string, UserData> = new Map<string, UserData>();
  private newlySuccessFulUsers: Map<string, UserData> = new Map<
    string,
    UserData
  >();
  public writeSuccessfulUsers() {
    try {
      const newUsersArr = Array.from(this.newlySuccessFulUsers.values());
      const oldUsersArr = Array.from(this.successFulUsers.values());
      const allSuccessFulUsers = [...oldUsersArr, ...newUsersArr];
      const json = JSON.stringify(allSuccessFulUsers);
      fs.writeFileSync(USERS_FILE, json, 'utf8');
      console.log('wrote all users who got messages to file');
    } catch (e) {
      console.error(
        `error occurred while writing users to file writeSuccessfulUsers ${e}`,
      );
    }
  }

  public async addNewSuccessfulUsers(data: UserData): Promise<void> {
    this.newlySuccessFulUsers.set(data.userId, {
      ...data,
      date: new Date().toString(),
    });
  }

  public loadSuccessfulUsers() {
    if (!fs.existsSync(USERS_FILE)) {
      return;
    }
    const response = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    const usersData = response as UserData[];
    usersData.forEach((userData) => {
      this.successFulUsers.set(userData.userId, userData);
    });
  }

  public isSuccessful(user: string) {
    return !!this.successFulUsers.get(user);
  }
}
