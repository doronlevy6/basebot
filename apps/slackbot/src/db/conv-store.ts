export interface IConvStore {
  get(key: ConvKey): Promise<string | undefined>;
  set(key: ConvKey, value: string): Promise<void>;
}

export class ConvKey {
  taskId: string;
  baseOrgId: string;
  slackUserId: string;
}

export const generateKey = (key: ConvKey) => {
  return `${key.taskId}:${key.baseOrgId}:${key.slackUserId}`;
};
