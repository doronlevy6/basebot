// Before anything else runs, first we must load the environment that we are running
import { loadEnvs } from '../libs/env/src';
loadEnvs(
  {
    serviceName: 'session_extractor',
    env: 'production',
    cwd: process.cwd(),
  },
  ['configs'],
);

const apiKey = process.env.BASE_API_KEY;
if (!apiKey) {
  throw new Error('no api key given');
}
const fetcherUrl = 'http://localhost:3000/internal/feedback/fetch';

import axios from 'axios';
import { SlackMessage } from '../apps/gistbot/src/summaries/types';
import { createReadStream, createWriteStream } from 'fs';
import { createInterface } from 'readline';

interface SimpleUser {
  name: string;
  title: string;
  id: string;
}

type Message = SlackMessage | { messageId: string; error_fetching: true };

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

async function fetchSession(
  teamId: string,
  sessionId: string,
): Promise<SessionFetchResponse> {
  const res = await axios.post<SessionFetchResponse>(
    fetcherUrl,
    {
      teamId: teamId,
      sessionId: sessionId,
    },
    {
      headers: {
        Authorization: `Bearer: ${apiKey}`,
      },
      timeout: 1000 * (60 * 10),
    },
  );

  if (res.status >= 300) {
    throw new Error('Invalid status code response');
  }

  if (!res.data) {
    throw new Error('Invalid response');
  }

  return res.data;
}

async function main(inputFile: string, outputFile: string): Promise<void> {
  const rStream = createReadStream(inputFile);
  const reader = createInterface({ input: rStream });
  const wStream = createWriteStream(outputFile, { flags: 'a' });

  const promises: Promise<SessionFetchResponse>[] = [];

  await new Promise<void>((resolve, _reject) => {
    reader.on('line', (row) => {
      const records = row.split(',');
      const teamId = records[0];
      const sessionId = records[1];
      promises.push(
        fetchSession(teamId, sessionId).then((sfr) => {
          wStream.write(JSON.stringify(sfr) + '\n');
          return sfr;
        }),
      );
    });

    reader.on('close', () => {
      resolve();
    });
  });

  await Promise.all(promises);
}

main(
  './sessions-to-extract.csv',
  `./session-data-${new Date().getTime()}.jsonl`,
)
  .then((_data) => {
    console.log('completed');
  })
  .catch((err) => {
    console.error('failed', err);
  });
