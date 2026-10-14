import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * usePersistentForm — auto-save form state to localStorage.
 *
 * Strategy: hybrid persistence.
 *   1. localStorage  → convenience (auto-restore on revisit / refresh)
 *   2. BE server     → source of truth (order/appointment submitted via API)
 *   3. export/import → user can copy data before redeploying / changing domain
 *
 * Usage:
 *   const [form, setForm, { clear, exportData, importData }] = usePersistentForm(key, defaults);
 *
 * @param {string} storageKey — unique key for this form
 * @param {object} defaults   — initial form shape
 * @returns [form, setForm, helpers]
 */
export function usePersistentForm(storageKey, defaults) {
  // Lazily hydrate from localStorage on first render
  const [form, setForm] = useState(() => {
    if (typeof window === 'undefined') return defaults;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        return { ...defaults, ...saved };
      }
    } catch {
      /* corrupt entry — fall through to defaults */
    }
    return defaults;
  });

  // Track last save timestamp for UX feedback
  const [lastSaved, setLastSaved] = useState(null);

  // Skip the next auto-persist effect after a clear() call
  const skipNextPersistRef = useRef(false);

  // Auto-persist every time `form` changes
  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(form));
      setLastSaved(new Date());
    } catch {
      /* private mode or quota exceeded — silently skip */
    }
  }, [storageKey, form]);

  // Shallow-merge a field update
  const updateField = useCallback(
    (field, value) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Full replace (used by FormInput onChange wrappers like setForm({ ...form, name: v }))
  const setFormField = useCallback((updater) => {
    setForm((prev) =>
      typeof updater === 'function' ? { ...prev, ...updater(prev) } : { ...prev, ...updater }
    );
  }, []);

  // Clear one form from localStorage — skip re-persist of defaults
  const clear = useCallback(() => {
    skipNextPersistRef.current = true;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setForm(defaults);
    setLastSaved(null);
  }, [storageKey, defaults]);

  // Export current form state as a JSON string the user can copy
  const exportData = useCallback(() => {
    return JSON.stringify(form, null, 2);
  }, [form]);

  // Import form state from a JSON string (e.g. pasted from another device)
  const importData = useCallback(
    (jsonString) => {
      try {
        const parsed = JSON.parse(jsonString);
        setForm((prev) => ({ ...prev, ...parsed }));
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  return [form, setFormField, { clear, updateField, exportData, importData, lastSaved }];
}
