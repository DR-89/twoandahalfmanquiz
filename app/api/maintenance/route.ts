import {cleanup} from '../../../db/rooms';
export const dynamic='force-dynamic';
// A deployment scheduler may call this idempotent endpoint. It can only delete
// already-expired sessions; it never returns session contents or credentials.
export async function GET(){try{await cleanup();return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});}catch(e){console.error('Session cleanup failed',e);return Response.json({ok:false},{status:503,headers:{'Cache-Control':'no-store'}});}}
