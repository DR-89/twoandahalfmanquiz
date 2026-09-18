import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('quiz_rooms',{code:text('code').primaryKey(),state:text('state').notNull(),revision:integer('revision').notNull().default(0),expires:integer('expires').notNull()},table=>[index('quiz_rooms_expires_idx').on(table.expires)]);
