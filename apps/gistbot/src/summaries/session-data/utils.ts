import { Session } from './types';

export const anonymizeSession = (session: Session): Session => {
  // The newer message summarizer session is the type that needs to be anonymized
  // The older types were anonymized by default because they only had IDs on the types themselves
  if (!('messages' in session)) {
    return session;
  }

  session.messages = session.messages.map((msg) => {
    msg.text = '';
    msg.user_name = '';
    msg.user_title = '';
    return msg;
  });

  return session;
};
