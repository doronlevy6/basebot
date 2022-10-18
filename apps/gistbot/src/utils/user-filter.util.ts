export const allowUserByEmails = (userEmail: string): boolean => {
  if (!userEmail) {
    // If there is no email then we don't care about filtering at this level
    return true;
  }

  const email = userEmail.toLowerCase();

  if (
    email.endsWith('@gmail.com') ||
    email.endsWith('@yahoo.com') ||
    email.endsWith('@hotmail.com') ||
    email.endsWith('@aol.com') ||
    email.endsWith('@slack.com')
  ) {
    return false;
  }

  if (email.includes('test')) {
    return false;
  }

  return true;
};
