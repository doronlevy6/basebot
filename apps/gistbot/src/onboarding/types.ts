export type OnBoardingTriggerContext =
  | 'suggested_channel_summary'
  | 'direct_mention'
  | 'suggested_thread_summary';

export type OnBoardingContext =
  | OnBoardingTriggerContext
  | 'global_middleware'
  | 'app_home_opened';

export const isTriggerContext = (
  arg: string,
): arg is OnBoardingTriggerContext => {
  return (
    arg === 'suggested_channel_summary' ||
    arg === 'direct_mention' ||
    arg === 'suggested_thread_summary'
  );
};
