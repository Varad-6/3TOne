import jwt from 'jsonwebtoken';

const jwtUtils = {
  generateAccessToken: (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '1h',
    });
  },

  generateRefreshToken: (payload) => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
    });
  },

  verifyAccessToken: (token) => {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  },

  verifyRefreshToken: (token) => {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  },

  decodeToken: (token) => {
    return jwt.decode(token);
  },
};

export default jwtUtils;
