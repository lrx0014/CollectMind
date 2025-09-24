import Dexie from "dexie";

const db = new Dexie('collect_mind_db');
db.version(1).stores({
    topics: '++id, name, color_tag, color_tag_rgb, summary, create_time, update_time, is_deleted'
});

export default db;