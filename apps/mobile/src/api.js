import { API_BASE_URL } from './config.js';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, { token, method = 'GET', body, signal, headers: extraHeaders = {} } = {}) {
  if (!API_BASE_URL) throw new ApiError('The Kirani API address is not configured.', 0, 'API_NOT_CONFIGURED');
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  for (const [name, value] of Object.entries(extraHeaders || {})) {
    if (typeof value === 'string' && value.trim()) headers[name] = value;
  }
  let response;
  try {
    response = await fetch(API_BASE_URL + '/api/v1' + path, {
      method, headers, signal,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError('Could not reach Kirani. Check your connection and try again.', 0, 'NETWORK_ERROR');
  }
  const requestId = response.headers.get('x-correlation-id');
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const code = payload?.error?.code || payload?.code || 'REQUEST_FAILED';
    const message = payload?.error?.message || payload?.message ||
      (response.status === 401 ? 'Your session has expired. Please reconnect.' :
       response.status === 403 ? 'You do not have permission to do that.' :
       response.status >= 500 ? 'Kirani is temporarily unavailable. Please try again.' :
       'The request could not be completed.');
    throw new ApiError(message + (requestId ? ' (Reference: ' + requestId + ')' : ''), response.status, code);
  }
  return payload;
}
