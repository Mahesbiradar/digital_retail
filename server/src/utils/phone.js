export const normalizePhone = (phone) => {
  const cleaned = String(phone ?? '').trim().replace(/[\s\-()]/g, '');

  if (!cleaned) {
    return '';
  }

  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\D/g, '')}`;
  }

  return cleaned.replace(/\D/g, '');
};
