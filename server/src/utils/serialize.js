import crypto from 'node:crypto';

export const toPublicUser = (authRecord) => ({
  id: authRecord.userId,
  businessId: authRecord.businessId,
  name: authRecord.userName,
  phone: authRecord.userPhone,
  role: authRecord.userRole
});

export const toPublicBusiness = (authRecord) => ({
  id: authRecord.businessId,
  name: authRecord.businessName,
  gstEnabled: authRecord.gstEnabled,
  discountEnabled: authRecord.discountEnabled,
  logoUrl: authRecord.logoUrl,
  currencyCode: authRecord.currencyCode
});

export const safeCompare = (left, right) => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};
