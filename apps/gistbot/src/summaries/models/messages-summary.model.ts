import axios, { AxiosRequestConfig } from 'axios';
import { logger } from '@base/logger';
import { ModerationError } from '../errors/moderation-error';
import { delay } from 'bullmq';

export type MessagesSummaryRequest = ModelMessage[];

export interface ModelMessageReaction {
  name: string;
  count: number;
}

export interface ModelMessage {
  ts: string;
  thread_ts: string;
  channel: string;
  channel_id: string;
  user_id: string;
  user_name: string;
  user_title: string;
  reactions: ModelMessageReaction[];
  text: string;
}

export interface ConversationSummary {
  rootMessageTs: string;
  title: string;
  summary: string;
  timeSavedSeconds: number;
}

export interface InferenceResult {
  MOD_TITLE: boolean;
  TEXT_TITLE: string;
  THREAD_TS: string;
  TEXT_SUMMARY: string;
  EVALUATION: boolean;
  MOD_SUMMARY: boolean;
  TIME_SAVED: number; // Seconds
}

interface ExecutionOutput {
  session_id: string;
  requesting_user_id: string;
  wire: {
    completed_inference: string;
    results: InferenceResult[];
  };
}

interface InvocationOutput {
  executionArn: string;
  startDate: number;
}

interface WireInvocationRequest {
  Input: {
    session_id: string;
    wire: string;
    content_type: 'json' | 'pq';
    requesting_user_id: string;
  };
}

interface S3InvocationRequest {
  Input: {
    key: string;
    bucket: string;
    session_id: string;
    requesting_user_id: string;
  };
}

type InvocationRequest = WireInvocationRequest | S3InvocationRequest;

interface ExecutionDescription {
  executionArn: string;
  cause?: string;
  error?: string;
  input: string;
  inputDetails: {
    __type: string;
    included: boolean;
  };
  name: string;
  output?: string;
  outputDetails: {
    __type: string;
    included: boolean;
  };
  startDate: number;
  stateMachineArn: string;
  status: string | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED';
  stopDate: number;
  traceHeader: string;
}

export class MessagesSummaryModel {
  constructor(
    private apiGwBaseUrl: string,
    private standardWorkflowArn: string,
    private expressWorkflowArn: string,
  ) {}

  async summarize(
    sessionId: string,
    data: MessagesSummaryRequest,
    requestingUserId: string,
  ): Promise<ConversationSummary[]> {
    const started = new Date();

    try {
      const reqInput: InvocationRequest = {
        Input: {
          wire: JSON.stringify(data),
          content_type: 'json',
          session_id: sessionId,
          requesting_user_id: requestingUserId,
        },
      };

      const execution = await this.execution(sessionId, reqInput, data.length);

      const executionOutput = JSON.parse(
        execution.output || '',
      ) as ExecutionOutput;

      logger.info({
        msg: 'Messages Summary Model returned with response',
      });

      const conversations = this.convertModelResponseToSummaries(
        executionOutput.wire.results,
      );
      const nonFlaggedConversations = conversations.filter(
        (_, idx) => !executionOutput.wire.results[idx].MOD_SUMMARY,
      );
      if (conversations.length > 0 && nonFlaggedConversations.length === 0) {
        // If 100% of them were filtered by moderation, we throw the moderated error
        throw new ModerationError('moderated');
      }

      // TODO: Use evaluation result for quality check and filter

      return nonFlaggedConversations;
    } catch (error) {
      logger.error(
        `error in channel summarization model: ${error} ${error.stack} ${
          error.response && JSON.stringify(error.response.data)
        }`,
      );
      throw error;
    } finally {
      const endedAt = new Date();
      logger.debug({ message: 'Length of request', time: +endedAt - +started });
    }
  }

  convertModelResponseToSummaries(
    input: InferenceResult[],
  ): ConversationSummary[] {
    const summaries = input.map((i): ConversationSummary => {
      return {
        rootMessageTs: i.THREAD_TS,
        title: i.MOD_TITLE ? '' : i.TEXT_TITLE, // If the title was moderated we leave it empty for now
        summary: i.TEXT_SUMMARY,
        timeSavedSeconds: i.TIME_SAVED,
      };
    });

    return summaries.sort((a, b) => {
      return this.sortConversationSummaries(a, b);
    });
  }

  private sortConversationSummaries(
    s1: ConversationSummary,
    s2: ConversationSummary,
  ) {
    return this.sortTimestamps(s1.rootMessageTs, s2.rootMessageTs);
  }

  private sortTimestamps(ts1: string, ts2: string) {
    if (ts1 < ts2) {
      return -1;
    }
    if (ts2 < ts1) {
      return 1;
    }
    return 0;
  }

  private async apiGwRequest<TRequest, TResponse>(
    endpoint: string,
    req: TRequest,
    config?: AxiosRequestConfig,
  ): Promise<TResponse> {
    const response = await axios.post<TResponse>(
      `${this.apiGwBaseUrl}/${endpoint}`,
      req,
      config,
    );
    if (response.status >= 300) {
      throw new Error(`Invalid status code response on EP: ${endpoint}`);
    }

    if (!response.data) {
      throw new Error(`Invalid response on EP: ${endpoint}`);
    }

    return response.data;
  }

  private async execution(
    sessionId: string,
    reqInput: InvocationRequest,
    reqLength: number,
  ): Promise<ExecutionDescription> {
    let execution: ExecutionDescription | undefined;
    // 25 messages can be done for sure in an express
    if (reqLength < 25) {
      logger.debug(
        `running express execution in sync on req length ${reqLength}`,
      );
      execution = await this.expressSyncExecution(sessionId, reqInput);
    } else {
      logger.debug(
        `running standard wrapped execution on req length ${reqLength}`,
      );
      execution = await this.wrappedSyncExecution(sessionId, reqInput);
    }

    if (!execution) {
      throw new Error(`Execution took longer than 120 seconds`);
    }

    if (execution.error) {
      throw new Error(`Execution encountered an error: ${execution.error}`);
    }

    if (!execution.output) {
      throw new Error('Execution Has No Output');
    }

    return execution;
  }

  private async expressSyncExecution(
    sessionId: string,
    reqInput: InvocationRequest,
  ): Promise<ExecutionDescription> {
    const execution = await this.apiGwRequest<
      unknown, // TODO: Request type?
      ExecutionDescription
    >(
      'sync-execution',
      {
        input: JSON.stringify(reqInput),
        name: sessionId,
        stateMachineArn: this.expressWorkflowArn,
      },
      {
        timeout: 1000 * 29, // Timeout at 29 seconds is AWS API GW
      },
    );

    return execution;
  }

  private async wrappedSyncExecution(
    sessionId: string,
    reqInput: InvocationRequest,
  ): Promise<ExecutionDescription | undefined> {
    const invocation = await this.apiGwRequest<
      unknown, // TODO: Request type?
      InvocationOutput
    >(
      'start-execution',
      {
        input: JSON.stringify(reqInput),
        name: sessionId,
        stateMachineArn: this.standardWorkflowArn,
      },
      {
        timeout: 1000 * 29, // Timeout at 29 seconds is AWS API GW
      },
    );

    logger.debug(
      `Triggered execution to start, waiting and polling for execution output`,
    );
    await delay(1000); // Small pause, if we're in a standard workflow there's no chance of being less than 1 second anyways

    let execution: ExecutionDescription | undefined;
    for (let attempt = 0; attempt < 120; attempt++) {
      const description = await this.apiGwRequest<
        unknown, // TODO: Request type?
        ExecutionDescription
      >(
        'describe-execution',
        {
          executionArn: invocation.executionArn,
        },
        {
          timeout: 1000 * 29,
        },
      );
      if (description.status !== 'RUNNING') {
        execution = description;
        break;
      }
      await delay(1000);
    }

    return execution;
  }
}
