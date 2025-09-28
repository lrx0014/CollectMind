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
    url: string;
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
                '++id, topic_id, url, title, icon, summary, create_time, update_time, is_deleted, [is_deleted+create_time], [topic_id+is_deleted+create_time]',
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
        url: string;
        title: string;
        icon: string;
        summary?: string;
    }): Promise<number> {
        const now = Date.now();
        return this.saved_pages.add({
            topic_id: args.topic_id,
            url: args.url,
            title: args.title,
            icon: args.icon,
            summary: args.summary ?? 'The summary is being generated, please wait a second...',
            create_time: now,
            update_time: now,
            is_deleted: 0,
        });
    }

    async deleteTopicAndItsPages(topicId: number): Promise<void> {
        const now = Date.now();

        await this.transaction('rw', this.topics, this.saved_pages, async () => {
            const updated = await this.topics.update(topicId, {
                is_deleted: 1 as 0 | 1,
                update_time: now,
            });
            if (updated === 0) {
                throw new Error(`Topic ${topicId} not found or already deleted`);
            }

            await this.saved_pages
                .where('topic_id')
                .equals(topicId)
                .and(p => p.is_deleted === 0)
                .modify({ is_deleted: 1 as 0 | 1, update_time: now });
        });
    }

    async deletePage(pageId: number): Promise<void> {
        const now = Date.now();
        const updated = await this.saved_pages.update(pageId, {
            is_deleted: 1 as 0 | 1,
            update_time: now,
        });
        if (updated === 0) {
            throw new Error(`Saved page ${pageId} not found or already deleted`);
        }
    }

    async updatePageSummary(pageId: number, summary: string): Promise<void> {
        await this.saved_pages.update(pageId, {
            summary,
            update_time: Date.now(),
        });
    }


}

const db = new CollectMindDB();
export default db;