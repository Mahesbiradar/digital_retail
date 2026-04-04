const durationPattern = /^(\d+)([smhd])$/i;
const unitToSeconds = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24
};

export const parseDurationToSeconds = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const match = String(value ?? '').trim().match(durationPattern);

  if (!match) {
    throw new Error(`Invalid duration format: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  return amount * unitToSeconds[unit];
};
