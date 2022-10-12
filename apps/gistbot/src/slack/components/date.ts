export const SlackDate = (timestamp: string) => {
  const fallback = new Date().toDateString();
  return `<!date^${convertSlackTsToTimestamp(
    timestamp,
  )}^{date_short_pretty} {time}|${fallback}>`;
};

const convertSlackTsToTimestamp = (ts: string) => ts.split('.')[0];
