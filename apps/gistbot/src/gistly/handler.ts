import { logger } from '@base/logger';
import { AnalyticsManager } from '../analytics/manager';
import { Routes } from '../routes/router';
import { SlackShortcutWrapper, ViewAction } from '../slack/types';
import { GistlyModal } from './gistly-modal';
import { GistlyModel } from './gistly.model';
import { GistlyCommandType } from './types';

export const handleGistlyModalSubmit =
  (model: GistlyModel) => async (params: ViewAction) => {
    const { ack, view, client, body } = params;

    try {
      const { user } = body;
      const inputText = view.state.values['input_text'].value.value ?? '';
      const command = view.state.values['command_type'].value.selected_option
        ?.value as GistlyCommandType;

      await ack({
        response_action: 'update',
        view: GistlyModal({
          submitCallback: Routes.GISTLY_MODAL_SUBMIT,
          userInput: inputText,
          userId: user?.id,
        }),
      });

      let text: string | undefined = 'na';
      if (command === GistlyCommandType.Generate) {
        text = inputText + (await model.generateMore(inputText));
      } else if (command === GistlyCommandType.ShortenText) {
        text = await model.shortenText(inputText);
      } else if (command === GistlyCommandType.Emojify) {
        text = await model.emojify(inputText);
      } else if (command === GistlyCommandType.Custom) {
        text = await model.customModel(inputText);
      } else {
        text = await model.correctGrammer(inputText);
        if (text === inputText) {
          text = 'Yayy, no grammer issues here :raised_hands:';
        }
      }

      logger.info(`Updateing with ${text}`);

      await client.views.update({
        view_id: view.id,
        view: GistlyModal({
          submitCallback: Routes.GISTLY_MODAL_SUBMIT,
          userId: user.id,
          userInput: inputText,
          suggestedText: text?.trim(),
        }),
      });
    } catch (err) {
      logger.error(`gistly handler error: ${err}`);
    }
  };

export const openGistlyModal =
  () =>
  async ({ ack, logger, body, client }: SlackShortcutWrapper) => {
    try {
      await ack();

      const { message, user } = body;

      await client.views.open({
        trigger_id: body.trigger_id,
        view: GistlyModal({
          submitCallback: Routes.GISTLY_MODAL_SUBMIT,
          userInput: message?.text,
          userId: user?.id,
        }),
      });
    } catch (error) {
      logger.error(`error in gistly: ${error.stack}`);
    }
  };
