// Synthesizes a topic-level overview from its pages' individual summaries,
// instead of the chat prompt re-reading every page summary from scratch each
// time. Reuses the Summarizer API's existing map-reduce chunking (see
// summarizer.ts) by simply feeding it the concatenation of page summaries —
// no separate reduce implementation needed here.

import db from '../db.ts';
import { summarize } from '../summarizer.ts';

export async function synthesizeTopicSummary(topicId: number): Promise<string | null> {
    const topic = await db.topics.get(topicId);
    if (!topic || topic.is_deleted === 1) return null;

    const pages = await db.getSavedPagesByTopicId(topicId);
    const withSummaries = pages.filter(p => p.summary && p.summary.trim());

    if (withSummaries.length === 0) {
        return null;
    }

    // A single page's summary already *is* the topic summary; nothing to
    // reduce.
    if (withSummaries.length === 1) {
        const summary = withSummaries[0].summary.trim();
        await db.topics.update(topicId, { summary, summary_stale: 0 as 0 | 1 });
        return summary;
    }

    const combined = withSummaries
        .map(page => `# ${page.title?.trim() || 'Untitled page'}\n${page.summary.trim()}`)
        .join('\n\n');

    const summary = await summarize({
        text: combined,
        type: 'key-points',
        format: 'plain-text',
        length: 'long',
        sharedContext: `A synthesized overview of the topic "${topic.name}", combining summaries of ${withSummaries.length} saved pages.`,
    });

    const finalSummary = summary?.trim() || combined.slice(0, 2000);
    await db.topics.update(topicId, { summary: finalSummary, summary_stale: 0 as 0 | 1 });
    return finalSummary;
}
