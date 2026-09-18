import {env} from 'cloudflare:workers';
import {TTL,type Room} from '../lib/game';
export function db(){if(!env.DB)throw Error('unavailable');return env.DB;}
export async function cleanup(now=Date.now()){return db().prepare('DELETE FROM quiz_rooms WHERE expires <= ?').bind(now).run();}
export async function read(code:string,now=Date.now()){
 const row=await db().prepare('SELECT state, revision FROM quiz_rooms WHERE code = ? AND expires > ?').bind(code,now).first<{state:string;revision:number}>();
 if(!row)throw Error('roomMissing');return {room:JSON.parse(row.state) as Room,revision:row.revision};
}
export async function write(room:Room,revision:number){const now=Date.now();return (await db().prepare('UPDATE quiz_rooms SET state = ?, revision = revision + 1, expires = ? WHERE code = ? AND revision = ? AND expires > ?').bind(JSON.stringify(room),room.lastActive+TTL,room.code,revision,now).run()).meta.changes===1;}
