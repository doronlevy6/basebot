export const tryDetectLinkUrl = (linkUrl: string) => {
  const parsed = new URL(linkUrl);
  if (parsed.hostname.includes('app.asana.com')) {
    return 'asana';
  }

  if (parsed.hostname.includes('monday.com')) {
    return 'monday';
  }

  return null;
};
