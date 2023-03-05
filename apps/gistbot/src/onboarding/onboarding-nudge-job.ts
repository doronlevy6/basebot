import { logger } from '@base/logger';
import * as cron from 'node-cron';
import { OnboardingManager } from './manager';
import { RedisOnboardingNudgeLock } from './onboarding-nudge-lock';

export class OnboardingNudgeJob {
  private readonly jobHourInterval = 1;
  private readonly timeHoursWindow = 1;
  private readonly timeDaysWindow = 2;
  private readonly limit = 100;
  private readonly weekDays = '1,2,3,4';
  private readonly nudgeAttempts = 2;

  constructor(
    private onboardingManager: OnboardingManager,
    private jobLock: RedisOnboardingNudgeLock,
  ) {}

  start() {
    cron.schedule(
      `0 0 */${this.jobHourInterval} * * ${this.weekDays}`,
      // Internally the cron should handle promises, this is an incorrect signature.
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async () => {
        await this.executeJob();
      },
    );
  }

  private async executeJob() {
    try {
      logger.debug('start onboarding nudge job');
      const aquired = await this.jobLock.lock();
      if (!aquired) {
        logger.debug(
          `could not aquire lock for onboarding nudge job, already aquired`,
        );
        return;
      }

      await this.jobLock.extend();
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        await this.jobLock.extend();
        const users =
          await this.onboardingManager.filterUsersNotCompletedOnboarding(
            this.timeHoursWindow,
            this.timeDaysWindow,
            this.nudgeAttempts,
            this.limit,
            offset,
          );
        if (!users || users.length === 0) {
          break;
        }

        logger.debug(`fetched ${users?.length} users to nudge`);
        offset += this.limit;
        const onboardingAttempts = users.map((user) =>
          this.onboardingManager.attemptToOnboardUser(user),
        );
        await Promise.all(onboardingAttempts);

        const sendNudgeToUsers = users.map((user) => {
          return this.onboardingManager.postNudgeMessage(user).catch((e) => {
            logger.error(
              `failed to send nudge message to user ${user.slackUser}, error: ${e}`,
            );
          });
        });
        await Promise.all(sendNudgeToUsers);
      }
    } catch (ex) {
      logger.error(`error occured while executing onboarding nudge job, ${ex}`);
    } finally {
      await this.jobLock.release();
    }
  }
}
