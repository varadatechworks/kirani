export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const isDevelopmentBuild = typeof __DEV__ !== 'undefined' && __DEV__;
export const DEV_TOKEN_LOGIN = isDevelopmentBuild && process.env.EXPO_PUBLIC_ENABLE_DEV_TOKEN_LOGIN === 'true';
export const APP_NAME = 'Kirani';
