let _sessionPromise: Promise<any> | null = null;

function getLM(): any {
    const LM = (globalThis as any).LanguageModel || (window as any).LanguageModel;
    if (!LM) throw new Error("LanguageModel API not available.");
    return LM;
}

async function ensureSession(): Promise<any> {
    if (_sessionPromise) return _sessionPromise;

    const LM = getLM();
    // availability: 'available' | 'downloadable' | 'unavailable' | ...
    const availability = await LM.availability?.();

    if (availability === "unavailable") {
        throw new Error("Prompt API is unavailable on this device.");
    }

    _sessionPromise = LM.create({
        monitor(m: EventTarget) {
            m.addEventListener("downloadprogress", (e: any) => {
                console.debug(`[Prompt] model download: ${(e?.loaded ?? 0) * 100}%`);
            });
        },
    });

    return _sessionPromise;
}

export async function prompt(text: string): Promise<string> {
    const session = await ensureSession();
    const out: string = await session.prompt(String(text ?? ""));
    return String(out ?? "");
}

export async function promptStream(text: string): Promise<AsyncIterable<string>> {
    const session = await ensureSession();
    const rs: ReadableStream<string> = await session.promptStreaming(String(text ?? ""));

    const reader = rs.getReader();
    async function* iterator() {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) return;
                yield String(value ?? "");
            }
        } finally {
            try { reader.releaseLock(); } catch { /* empty */ }
        }
    }
    return iterator();
}

/** 可选：销毁已创建的会话 */
export async function destroyPromptSession() {
    try { (await _sessionPromise)?.destroy?.(); } catch { /* empty */ }
    _sessionPromise = null;
}
