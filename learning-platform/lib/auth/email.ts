const MAX_EMAIL_LENGTH = 254;

const EMAIL_PATTERN =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return null;
  }

  const topLevelDomain = email.slice(email.lastIndexOf(".") + 1);
  if (
    !/^[a-z]{2,63}$/i.test(topLevelDomain) &&
    !/^xn--[a-z0-9](?:[a-z0-9-]{0,57}[a-z0-9])?$/i.test(topLevelDomain)
  ) {
    return null;
  }

  return email;
}
