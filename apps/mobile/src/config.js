export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\\/$/, '');
export const DEV_TOKEN_LOGIN = __DEV__ && process.env.EXPO_PUBLIC_ENABLE_DEV_TOKEN_LOGIN === 'true';
export const APP_NAME = 'Kirani';
