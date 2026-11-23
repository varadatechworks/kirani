/** Adapted from app-skeleton authorization module. */
export const ACTIONS=Object.freeze(['view','create','edit','delete','approve','export','manage']);

export function allowedSimple({roles,roleGrants,resource,action}={}){
  if(!ACTIONS.includes(action)||typeof resource!=='string'||!resource.trim()||
     !Array.isArray(roles)||!roleGrants||typeof roleGrants!=='object')return false;
  return roles.some(role=>{
    if(typeof role!=='string'||!Object.hasOwn(roleGrants,role))return false;
    const roleGrant=roleGrants[role];
    if(!roleGrant||typeof roleGrant!=='object'||!Object.hasOwn(roleGrant,resource))return false;
    const grants=roleGrant[resource];
    return Array.isArray(grants)&&grants.includes(action);
  });
}

export function requireSimple(input){
  if(!allowedSimple(input))throw Object.assign(new Error('Access denied'),{status:403,code:'FORBIDDEN'});
  return true;
}
