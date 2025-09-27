import Dexie, {type Table} from 'dexie';

export interface Topic {
    id: number;
    name: string;
    color_tag: string;
    color_tag_rgb: string;
    summary: string;
    create_time: number;
    update_time: number;
    is_deleted: 0 | 1;
}

export interface SavedPage {
    id: number;
    topic_id: number;
    title: string;
    icon: string;
    summary: string;
    create_time: number;
    update_time: number;
    is_deleted: 0 | 1;
}

// for db.ts internal only
type DbTopic = Omit<Topic, 'id'> & { id?: number };
type DbSavedPage = Omit<SavedPage, 'id'> & { id?: number };

class CollectMindDB extends Dexie {
    topics!: Table<DbTopic, number>;
    saved_pages!: Table<DbSavedPage, number>;

    constructor() {
        super('collect_mind_db');
        this.version(1).stores({
            topics:
                '++id, name, color_tag, color_tag_rgb, summary, create_time, update_time, is_deleted, [is_deleted+create_time]',

            saved_pages:
                '++id, topic_id, title, icon, summary, create_time, update_time, is_deleted, [is_deleted+create_time], [topic_id+is_deleted+create_time]',
        });
    }

    async getAllTopics(): Promise<Topic[]> {
        const arr = await this.topics
            .where('[is_deleted+create_time]')
            .between([0, Dexie.minKey], [0, Dexie.maxKey])
            .reverse()
            .toArray();
        return arr as Topic[];

    }

    async getSavedPagesByTopicId(topicId: number): Promise<SavedPage[]> {
        const arr = await this.saved_pages
            .where('[topic_id+is_deleted+create_time]')
            .between([topicId, 0, Dexie.minKey], [topicId, 0, Dexie.maxKey])
            .reverse()
            .toArray();
        return arr as SavedPage[];

    }

    async getAllSavedPages(): Promise<SavedPage[]> {
        const arr = await this.saved_pages
            .where('[is_deleted+create_time]')
            .between([0, Dexie.minKey], [0, Dexie.maxKey])
            .reverse()
            .toArray();
        return arr as SavedPage[];

    }

    async addTopic(args: {
        name: string;
        color_tag: string;
        color_tag_rgb: string;
        summary?: string;
    }): Promise<number> {
        const now = Date.now();
        return this.topics.add({
            name: args.name,
            color_tag: args.color_tag,
            color_tag_rgb: args.color_tag_rgb,
            summary: args.summary ?? 'The summary is being generated, please wait a second...',
            create_time: now,
            update_time: now,
            is_deleted: 0,
        });
    }

    async addSavedPage(args: {
        topic_id: number;
        title: string;
        icon: string;
        summary?: string;
    }): Promise<number> {
        const now = Date.now();
        return this.saved_pages.add({
            topic_id: args.topic_id,
            title: args.title,
            icon: args.icon,
            summary: args.summary ?? 'The summary is being generated, please wait a second...',
            create_time: now,
            update_time: now,
            is_deleted: 0,
        });
    }
}

const db = new CollectMindDB();
export default db;