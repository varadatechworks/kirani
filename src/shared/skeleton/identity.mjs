/** Adapted from app-skeleton identity module. */
export const USER_STATUSES=Object.freeze(['pending','active','suspended','deactivated']);
const transitions={pending:['active','deactivated'],active:['suspended','deactivated'],suspended:['active','deactivated'],deactivated:[]};
export function normalizeIdentifier(value){
  if(typeof value!=='string'||!value.trim())throw new TypeError('Identifier required');
  const s=value.trim();
  if(s.includes('@')){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))throw new Error('Invalid email');
    return s.toLowerCase();
  }
  const d=s.replace(/[\s()+-]/g,'');
  if(!/^\d{7,15}$/.test(d))throw new Error('Invalid phone');
  return s.startsWith('+')?'+'+d:d;
}
export function assertActiveUser(user){if(!user?.id||user.status!=='active')throw new Error('Active user required');return user}
export function transitionUser(user,to,{actorId,reason}={}){if(!USER_STATUSES.includes(user?.status)||!transitions[user.status].includes(to))throw new Error('Invalid account transition');if(!actorId||!reason?.trim())throw new Error('Actor and reason required');return {...user,status:to,updatedBy:actorId,statusReason:reason.trim()}}
export function publicProfile(user){if(!user?.id)throw new Error('User required');const {id,displayName,email,phone,status,locale}=user;return {id,displayName,email,phone,status,locale}}
