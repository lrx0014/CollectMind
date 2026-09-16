import Dexie, {type Table} from 'dexie';

// Sentinel topic_id used to store/retrieve chat history for the cross-topic
// "Library" chat surface (see components/library_chat_overlay.tsx). Dexie's
// auto-incrementing topic ids start at 1, so a negative id can never collide
// with a real topic.
export const LIBRARY_TOPIC_ID = -1;

export interface Topic {
    id: number;
    name: string;
    color_tag: string;
    color_tag_rgb: string;
    summary: string;
    create_time: number;
    update_time: number;
    is_deleted: 0 | 1;
    // 0/1: whether the synthesized topic-level summary is stale relative to its pages
    // and should be regenerated (see libs/rag/indexer.ts).
    summary_stale: 0 | 1;
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
    // Cheap change-detection hash of the last indexed text; lets re-visits of an
    // unchanged page skip re-chunking/re-embedding.
    content_hash: string;
    // Timestamp of the last successful chunk+embedding index run (0 = never indexed).
    indexed_at: number;
}

export interface ChatCitation {
    title: string;
    url: string;
}

export interface ChatMessageRecord {
    id: number;
    topic_id: number;
    sender: 'user' | 'ai';
    text: string;
    created_at: number;
    // JSON-encoded ChatCitation[]; only set on 'ai' messages answered from RAG
    // sources. Optional (rather than migrated with a default) since it's a
    // non-indexed field — old rows simply read back as undefined.
    citations?: string;
}

// A chunk of a saved page's extracted text plus its embedding vector, used for
// RAG retrieval instead of stuffing whole pages/summaries into the prompt.
export interface PageChunk {
    id: number;
    page_id: number;
    topic_id: number;
    chunk_index: number;
    text: string;
    embedding: Float32Array;
    embedding_model: string;
    token_estimate: number;
    created_at: number;
}

export type JobType = 'embed_page' | 'synthesize_topic';
export type JobStatus = 'pending' | 'running' | 'done' | 'error';

export interface Job {
    id: number;
    type: JobType;
    ref_id: number;
    status: JobStatus;
    attempts: number;
    error: string;
    created_at: number;
    updated_at: number;
}

export interface MetaEntry {
    key: string;
    value: string;
}

// for db.ts internal only
type DbTopic = Omit<Topic, 'id'> & { id?: number };
type DbSavedPage = Omit<SavedPage, 'id'> & { id?: number };
type DbChatMessage = Omit<ChatMessageRecord, 'id'> & { id?: number };
type DbPageChunk = Omit<PageChunk, 'id'> & { id?: number };
type DbJob = Omit<Job, 'id'> & { id?: number };

class CollectMindDB extends Dexie {
    topics!: Table<DbTopic, number>;
    saved_pages!: Table<DbSavedPage, number>;
    chat_messages!: Table<DbChatMessage, number>;
    chunks!: Table<DbPageChunk, number>;
    jobs!: Table<DbJob, number>;
    meta!: Table<MetaEntry, string>;

    constructor() {
        super('collect_mind_db');
        this.version(1).stores({
            topics:
                '++id, name, color_tag, color_tag_rgb, summary, create_time, update_time, is_deleted, [is_deleted+create_time]',

            saved_pages:
                '++id, topic_id, url, title, icon, summary, create_time, update_time, is_deleted, [is_deleted+create_time], [topic_id+is_deleted+create_time]',
        });

        this.version(2).stores({
            topics:
                '++id, name, color_tag, color_tag_rgb, summary, create_time, update_time, is_deleted, [is_deleted+create_time]',

            saved_pages:
                '++id, topic_id, url, title, icon, summary, create_time, update_time, is_deleted, [is_deleted+create_time], [topic_id+is_deleted+create_time]',

            chat_messages:
                '++id, topic_id, sender, created_at, [topic_id+created_at]',
        });

        this.version(3).stores({
            topics:
                '++id, name, color_tag, color_tag_rgb, summary, create_time, update_time, is_deleted, summary_stale, [is_deleted+create_time]',

            saved_pages:
                '++id, topic_id, url, title, icon, summary, create_time, update_time, is_deleted, indexed_at, [is_deleted+create_time], [topic_id+is_deleted+create_time]',

            chat_messages:
                '++id, topic_id, sender, created_at, [topic_id+created_at]',

            chunks:
                '++id, page_id, topic_id, chunk_index, embedding_model, created_at, [page_id+chunk_index], [topic_id+page_id]',

            jobs:
                '++id, type, ref_id, status, created_at, [type+status]',

            meta:
                '&key',
        }).upgrade(async tx => {
            await tx.table('topics').toCollection().modify(topic => {
                if (topic.summary_stale === undefined) topic.summary_stale = 0;
            });
            await tx.table('saved_pages').toCollection().modify(page => {
                if (page.content_hash === undefined) page.content_hash = '';
                if (page.indexed_at === undefined) page.indexed_at = 0;
            });
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

    async getAllChatMessages(): Promise<ChatMessageRecord[]> {
        const arr = await this.chat_messages
            .orderBy('[topic_id+created_at]')
            .toArray();
        return arr as ChatMessageRecord[];
    }

    async getChatMessagesByTopic(topicId: number): Promise<ChatMessageRecord[]> {
        const arr = await this.chat_messages
            .where('[topic_id+created_at]')
            .between([topicId, Dexie.minKey], [topicId, Dexie.maxKey])
            .toArray();
        return arr as ChatMessageRecord[];
    }

    async addChatMessage(args: {
        topic_id: number;
        sender: 'user' | 'ai';
        text: string;
        created_at?: number;
        citations?: ChatCitation[];
    }): Promise<number> {
        const created_at = args.created_at ?? Date.now();
        return this.chat_messages.add({
            topic_id: args.topic_id,
            sender: args.sender,
            text: args.text,
            created_at,
            citations: args.citations && args.citations.length > 0 ? JSON.stringify(args.citations) : undefined,
        });
    }

    async clearChatMessagesByTopic(topicId: number): Promise<void> {
        await this.chat_messages
            .where('topic_id')
            .equals(topicId)
            .delete();
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
            summary_stale: 0,
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
            content_hash: '',
            indexed_at: 0,
        });
    }

    async deleteTopicAndItsPages(topicId: number): Promise<void> {
        const now = Date.now();

        await this.transaction('rw', this.topics, this.saved_pages, this.chunks, async () => {
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

            // Deleted topics/pages aren't restorable from the UI, so drop their
            // embeddings now rather than filtering them out of every RAG query.
            await this.chunks.where('topic_id').equals(topicId).delete();
        });
    }

    async deletePage(pageId: number): Promise<void> {
        const now = Date.now();

        await this.transaction('rw', this.saved_pages, this.chunks, async () => {
            const updated = await this.saved_pages.update(pageId, {
                is_deleted: 1 as 0 | 1,
                update_time: now,
            });
            if (updated === 0) {
                throw new Error(`Saved page ${pageId} not found or already deleted`);
            }
            await this.chunks.where('page_id').equals(pageId).delete();
        });
    }

    async updatePageSummary(pageId: number, summary: string): Promise<void> {
        await this.saved_pages.update(pageId, {
            summary,
            update_time: Date.now(),
        });
    }

    // --- RAG: chunks (page text + embeddings) ---

    async addChunks(chunks: Omit<PageChunk, 'id'>[]): Promise<void> {
        if (chunks.length === 0) return;
        await this.chunks.bulkAdd(chunks);
    }

    async deleteChunksByPage(pageId: number): Promise<void> {
        await this.chunks.where('page_id').equals(pageId).delete();
    }

    async getChunksByPage(pageId: number): Promise<PageChunk[]> {
        const arr = await this.chunks.where('page_id').equals(pageId).toArray();
        return arr as PageChunk[];
    }

    async getChunksByTopic(topicId: number): Promise<PageChunk[]> {
        const arr = await this.chunks.where('topic_id').equals(topicId).toArray();
        return arr as PageChunk[];
    }

    async getAllChunks(): Promise<PageChunk[]> {
        const arr = await this.chunks.toArray();
        return arr as PageChunk[];
    }

    async markPageIndexed(pageId: number, contentHash: string): Promise<void> {
        await this.saved_pages.update(pageId, {
            content_hash: contentHash,
            indexed_at: Date.now(),
        });
    }

    async markTopicSummaryStale(topicId: number): Promise<void> {
        await this.topics.update(topicId, { summary_stale: 1 as 0 | 1 });
    }

    async markTopicSummaryFresh(topicId: number): Promise<void> {
        await this.topics.update(topicId, { summary_stale: 0 as 0 | 1 });
    }

    // --- Background job queue (survives service-worker restarts) ---

    async enqueueJob(type: JobType, refId: number): Promise<number> {
        const now = Date.now();
        return this.jobs.add({
            type,
            ref_id: refId,
            status: 'pending',
            attempts: 0,
            error: '',
            created_at: now,
            updated_at: now,
        });
    }

    async getPendingJobs(type?: JobType): Promise<Job[]> {
        const collection = type
            ? this.jobs.where('[type+status]').equals([type, 'pending'])
            : this.jobs.where('status').equals('pending');
        const arr = await collection.toArray();
        return arr as Job[];
    }

    async updateJobStatus(jobId: number, status: JobStatus, error?: string): Promise<void> {
        await this.jobs.update(jobId, {
            status,
            error: error ?? '',
            updated_at: Date.now(),
        });
    }

    async incrementJobAttempts(jobId: number): Promise<void> {
        const job = await this.jobs.get(jobId);
        await this.jobs.update(jobId, {
            attempts: (job?.attempts ?? 0) + 1,
            updated_at: Date.now(),
        });
    }

    // --- Key/value metadata (e.g. active embedding model id) ---

    async getMeta(key: string): Promise<string | undefined> {
        const entry = await this.meta.get(key);
        return entry?.value;
    }

    async setMeta(key: string, value: string): Promise<void> {
        await this.meta.put({ key, value });
    }
}

const db = new CollectMindDB();
export default db;
