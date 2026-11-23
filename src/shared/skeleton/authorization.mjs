/** Adapted from app-skeleton authorization module. */
export const ACTIONS=Object.freeze(['view','create','edit','delete','approve','export','manage']);

export function allowedSimple({roles,roleGrants,resource,action}={}){
  if(!ACTIONS.includes(action)||typeof resource!=='string'||!resource.trim()||
     !Array.isArray(roles)||!roleGrants||typeof roleGrants!=='object')return false;
  if(!Object.hasOwn(roleGrants,resourceGrantsKey(roleGrants,resource)))return false;
  const grantsForResource=roleGrants[resource];
  if(!grantsForResource||typeof grantsForResource!=='object')return false;
  return roles.some(role=>{
    if(typeof role!=='string'||!Object.hasOwn(grantsForResource,role))return false;
    const grants=grantsForResource[role];
    return Array.isArray(grants)&&grants.includes(action);
  });
}

function resourceGrantsKey(_grants,resource){return resource;}

export function requireSimple(input){
  if(!allowedSimple(input))throw Object.assign(new Error('Access denied'),{status:403,code:'FORBIDDEN'});
  return true;
}
