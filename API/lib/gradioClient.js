/**
 * gradioClient.js — Thin, lazy + injectable wrapper around @gradio/client.
 *
 * Thiết kế:
 *  - Lazy `import('@gradio/client')` → cài đặt module này ngay cả khi package chưa có
 *    (chỉ lazy-thất bại khi thực sự gọi Space mà chưa cài).
 *  - `clientFactory` inject được → unit-test bằng mock mà KHÔNG cần cài package / HF_TOKEN.
 *  - Public Spaces có thể gọi không token; gated/queued spaces cần HF_TOKEN (env HF_TOKEN).
 *  - fetchBuffer: download binary (.glb/.png) về Buffer để lưu local (tránh glb hết hạn).
 */
const DEFAULT_TIMEOUT = 90_000;

let _defaultFactory = null;
async function getDefaultClientFactory() {
  if (!_defaultFactory) {
    _defaultFactory = async (spaceId, opts = {}) => {
      const mod = await import('@gradio/client');
      const app = await mod.client(spaceId, { token: opts.hfToken || undefined });
      return app;
    };
  }
  return _defaultFactory;
}

/**
 * Gọi một hàm trên Gradio Space.
 * @returns {Promise<{ok:boolean, data:any, error:string|null}>}
 */
export async function callSpace(spaceId, fn, args, options = {}) {
  const { hfToken, clientFactory, timeoutMs } = options;
  try {
    const factory = clientFactory || (await getDefaultClientFactory());
    const app = await factory(spaceId, { hfToken });
    let result;
    if (timeoutMs) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        result = await app.predict(fn, args, { signal: ctrl.signal });
      } finally {
        clearTimeout(t);
      }
    } else {
      result = await app.predict(fn, args);
    }
    const data = result && result.data !== undefined ? result.data : result;
    return { ok: true, data, error: null };
  } catch (e) {
    const aborted = e && (e.name === 'AbortError' || (e.message && /signal|timeout|aborted/i.test(e.message)));
    return { ok: false, data: null, error: aborted ? `Timeout sau ${timeoutMs || DEFAULT_TIMEOUT}ms` : (e && e.message ? e.message : String(e)) };
  }
}

/** Download binary (glb/png) về Buffer để lưu local. */
export async function fetchBuffer(url, { timeoutMs } = {}) {
  try {
    const controller = new AbortController();
    const t = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
    const res = await fetch(url, { signal: controller.signal });
    if (t) clearTimeout(t);
    if (!res.ok) throw new Error(`Fetch ${url} -> ${res.status} ${res.statusText}`);
    return { ok: true, data: Buffer.from(await res.arrayBuffer()), error: null };
  } catch (e) {
    return { ok: false, data: null, error: e && e.message ? e.message : String(e) };
  }
}

// ---- Mock client factory (dùng trong unit-test / GRADIO_MOCK) ----
export function createMockClientFactory(canned = {}) {
  return async (spaceId, opts = {}) => ({
    predict: async (fn, args) => {
      await new Promise((r) => setTimeout(r, 10));
      if (!canned[fn]) return { data: [] };
      return { data: canned[fn](args) };
    },
  });
}

/** Chuyển file local thành Gradio FileData để upload thẳng lên Space */
export async function handleFile(filePathOrBlob) {
  try {
    const mod = await import('@gradio/client');
    if (typeof mod.handle_file === 'function') {
      return mod.handle_file(filePathOrBlob);
    }
  } catch (err) {
    console.warn('[gradioClient] Không import được handle_file:', err.message);
  }
  return filePathOrBlob;
}

