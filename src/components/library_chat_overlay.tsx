// Cross-topic "ask my whole collection" chat surface. Deliberately kept
// separate from App.tsx's per-topic chat state (which is wired to
// selectedTopic/savedPages) rather than threaded through it with a synthetic
// "virtual topic" — this way it can't accidentally interact with real topic
// data, and it reuses ChatContainer as-is (its "maximized" mode is already a
// full-viewport fixed overlay, so no extra wrapper chrome is needed here).
import React, {useState} from "react";
import {useLiveQuery} from "dexie-react-hooks";
import db, {LIBRARY_TOPIC_ID, type ChatCitation} from "../libs/db.ts";
import ChatContainer, {type ChatMessage} from "./chat_container.tsx";
import {getChatSession, getSessionUsage, normalizeDeltaStream} from "../libs/prompt.ts";
import {DEFAULT_TOKEN_BUDGET, getLibraryRagContext, type RagSource} from "../libs/rag/retrieve.ts";
import {showToast} from "./toast.tsx";

interface LibraryChatOverlayProps {
    open: boolean;
    onClose: () => void;
}

const SESSION_KEY = "library:global";
const SYSTEM_PROMPT = [
    'You are CollectMind, a reference-driven assistant with access to the user\'s entire bookmark collection across all topics.',
    'Use only the provided reference materials (labeled "Source N") to answer the user.',
    'Mention which page(s) the answer came from by title.',
].join(' ');

const RESPONSE_TOKEN_RESERVE = 350;
const MIN_CONTEXT_BUDGET = 300;
const MAX_CONTEXT_BUDGET = 2000;

function toCitations(sources: RagSource[]): ChatCitation[] {
    const seen = new Set<string>();
    const citations: ChatCitation[] = [];
    for (const source of sources) {
        const key = source.url || source.title;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        citations.push({ title: source.title, url: source.url });
        if (citations.length >= 5) break;
    }
    return citations;
}

const LibraryChatOverlay: React.FC<LibraryChatOverlayProps> = ({ open, onClose }) => {
    const [pending, setPending] = useState<ChatMessage | null>(null);

    const persisted = useLiveQuery<ChatMessage[], ChatMessage[]>(async () => {
        if (!open) return [];
        const rows = await db.getChatMessagesByTopic(LIBRARY_TOPIC_ID);
        return rows.map(row => {
            let citations: ChatCitation[] | undefined;
            if (row.citations) {
                try { citations = JSON.parse(row.citations); } catch { /* ignore malformed rows */ }
            }
            return { id: row.id, sender: row.sender, text: row.text, citations };
        });
    }, [open], []);

    const messages: ChatMessage[] = [...(persisted ?? []), ...(pending ? [pending] : [])];

    const handleClearChat = async () => {
        await db.clearChatMessagesByTopic(LIBRARY_TOPIC_ID);
    };

    const handleSendMessage = async (text: string) => {
        try {
            await db.addChatMessage({ topic_id: LIBRARY_TOPIC_ID, sender: 'user', text });
        } catch (error) {
            console.error('Failed to store library chat message:', error);
            showToast('Failed to send message. Please try again.');
            return;
        }

        const loadingId = -Math.floor(Date.now() + Math.random() * 1000);
        setPending({ id: loadingId, sender: 'ai', text: '', isLoading: true });

        try {
            const session = await getChatSession(SESSION_KEY, { systemPrompt: SYSTEM_PROMPT });
            const usage = getSessionUsage(session);
            const tokenBudget = usage
                ? Math.max(MIN_CONTEXT_BUDGET, Math.min(MAX_CONTEXT_BUDGET, usage.total - usage.used - RESPONSE_TOKEN_RESERVE))
                : DEFAULT_TOKEN_BUDGET;

            const ragContext = await getLibraryRagContext(text, { tokenBudget });
            const turnMessage = [
                'The conversation spans the user\'s entire bookmark collection (all topics).',
                'Reference materials:',
                ragContext.referenceBlock,
                'User question:',
                text,
            ].join('\n\n');

            let aiText = '';
            try {
                const stream = normalizeDeltaStream(await session.promptStreaming(turnMessage));
                for await (const delta of stream) {
                    aiText += delta;
                    setPending({ id: loadingId, sender: 'ai', text: aiText, isLoading: false });
                }
            } catch (streamError) {
                console.warn('Library chat streaming failed, falling back to single-shot prompt:', streamError);
                aiText = await session.prompt(turnMessage);
            }

            await db.addChatMessage({
                topic_id: LIBRARY_TOPIC_ID,
                sender: 'ai',
                text: aiText || 'AI returned an empty response.',
                citations: toCitations(ragContext.sources),
            });
        } catch (error) {
            console.error('Failed to fetch library AI response:', error);
            const fallbackText = error instanceof Error && error.message
                ? error.message
                : 'Failed to fetch AI response. Please try again.';
            showToast('Failed to fetch AI response. Please try again.');
            try {
                await db.addChatMessage({ topic_id: LIBRARY_TOPIC_ID, sender: 'ai', text: fallbackText });
            } catch (storeError) {
                console.error('Failed to store fallback library AI message:', storeError);
            }
        } finally {
            setPending(null);
        }
    };

    if (!open) return null;

    return (
        <ChatContainer
            topicName="All Bookmarks"
            messages={messages}
            onSendMessage={(text) => handleSendMessage(text)}
            isMaximized={true}
            setIsMaximized={(isMax) => { if (!isMax) onClose(); }}
            onClearChat={handleClearChat}
            showModeToggle={false}
            placeholder="Ask about anything in your collection..."
        />
    );
};

export default LibraryChatOverlay;
