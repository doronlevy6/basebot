import * as niceware from 'niceware';

const passphraseBytes = 12;
const passphraseSize = passphraseBytes / 2;
const passphraseDelimiter = '-';

export const generatePassphrase = (): string => {
  // This will generate a passphrase with {{passphraseBytes}} bytes, which should be a {{passphraseSize}} word passphrase
  // niceware package does not have types so we're explicitly casting to string[]
  return (niceware.generatePassphrase(passphraseBytes) as string[]).join(
    passphraseDelimiter,
  );
};

export const isPassphraseMessage = (text: string): boolean | 'too_short' => {
  const normalized = text.trim();

  if (!normalized.startsWith('My Passphrase Is: ')) {
    return false;
  }

  const passphrase = extractPassphrase(normalized);
  if (passphrase.split(passphraseDelimiter).length !== passphraseSize) {
    return 'too_short';
  }

  return true;
};

export const extractPassphrase = (text: string): string => {
  const normalized = text.trim();
  const passphrase = normalized.replace('My Passphrase Is: ', '');
  return passphrase;
};
