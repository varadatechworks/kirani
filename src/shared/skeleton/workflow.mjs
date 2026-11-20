/** Adapted from app-skeleton workflow primitives. */
export function transition(current,next,transitions,{actorId,allowed=false,reason=''}={}){if(!actorId||!allowed)throw new Error('Transition not authorized');if(!transitions?.[current]?.includes(next))throw new Error('Invalid status transition');return {from:current,to:next,actorId,reason:String(reason).trim(),at:new Date().toISOString()}}
