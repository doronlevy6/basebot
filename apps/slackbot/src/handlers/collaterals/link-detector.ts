export const tryDetectLinkUrl = (linkUrl: string) => {
  const parsed = new URL(linkUrl);
  if (parsed.hostname.includes('app.asana.com')) {
    return 'asana';
  }

  if (parsed.hostname.includes('monday.com')) {
    return 'monday';
  }

  if (parsed.hostname.includes('.atlassian.net')) {
    return 'jira';
  }

  return null;
};
