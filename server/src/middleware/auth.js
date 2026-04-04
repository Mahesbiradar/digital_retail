import { verifyAccessToken } from '../lib/jwt.js';

export const auth = (req, res, next) => {
  const authorization = req.headers.authorization ?? '';

  if (!authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
      code: 401
    });
  }

  const token = authorization.slice('Bearer '.length).trim();

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired access token.',
      code: 401
    });
  }
};
