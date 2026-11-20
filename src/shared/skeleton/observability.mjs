/** Adapted from app-skeleton safe error conventions. */
import {randomUUID} from 'node:crypto';
export function correlationId(s){return typeof s==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(s)?s:randomUUID()}
export function safeApiError(status,cid,code='INTERNAL_ERROR'){const messages={400:'Invalid request',401:'Please sign in',403:'You do not have permission',404:'Resource not found',409:'Request conflicts with current state',429:'Too many requests',500:'Something went wrong',503:'Service temporarily unavailable'};return {status:messages[status]?status:500,body:{error:code,message:messages[status]??messages[500],correlationId:cid??randomUUID()}}}
