'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BrandKitSchema,
  DefaultBrandKits,
  loadBrandKitsClient,
  resetCatalogClient,
  saveBrandKitsClient,
  type BrandKit,
} from '@/lib/catalog';
import { z } from 'zod';

function downloadText(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const BrandKitsSchema = z.array(BrandKitSchema);

export default function BrandKitsAdminPage() {
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<BrandKit>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadBrandKitsClient();
    setKits(loaded);
  }, []);

  const editing = useMemo(() => kits.find((k) => k.id === editingId) || null, [kits, editingId]);

  function startNew() {
    setEditingId('__new__');
    setDraft({ id: '', name: '', description: '', promptFragment: '' });
    setError(null);
  }

  function startEdit(id: string) {
    const k = kits.find((x) => x.id === id);
    if (!k) return;
    setEditingId(id);
    setDraft({ ...k });
    setError(null);
  }

  function cancel() {
    setEditingId(null);
    setDraft({});
    setError(null);
  }

  function save() {
    setError(null);
    const parsed = BrandKitSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join('; '));
      return;
    }

    const next = [...kits];
    const idx = next.findIndex((k) => k.id === parsed.data.id);

    // If changing id while editing an existing kit, ensure uniqueness.
    if (editing && editing.id !== parsed.data.id && next.some((k) => k.id === parsed.data.id)) {
      setError('ID must be unique.');
      return;
    }

    if (idx >= 0) next[idx] = parsed.data;
    else next.push(parsed.data);

    next.sort((a, b) => a.name.localeCompare(b.name));
    setKits(next);
    saveBrandKitsClient(next);
    cancel();
  }

  function remove(id: string) {
    const next = kits.filter((k) => k.id !== id);
    setKits(next);
    saveBrandKitsClient(next);
    if (editingId === id) cancel();
  }

  function exportJson() {
    downloadText('brand-kits.json', JSON.stringify(kits, null, 2));
  }

  function importJson(text: string) {
    setError(null);
    const parsedJson = (() => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    })();

    const parsed = BrandKitsSchema.safeParse(parsedJson);
    if (!parsed.success) {
      setError('Invalid JSON: ' + parsed.error.issues.map((i) => i.message).join('; '));
      return;
    }

    const next = parsed.data.slice().sort((a, b) => a.name.localeCompare(b.name));
    setKits(next);
    saveBrandKitsClient(next);
  }

  function resetToDefaults() {
    resetCatalogClient();
    setKits(DefaultBrandKits);
    cancel();
  }

  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl p-6 md:p-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Brand Kits Admin</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Stored in <code className="text-zinc-200">localStorage</code> (per-browser). Defaults come from repo JSON.
            </p>
          </div>
          <a className="rounded-xl border border-zinc-800 px-4 py-2 text-sm" href="/">
            Back
          </a>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Kits</h2>
              <button className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-zinc-900" onClick={startNew}>
                + New
              </button>
            </div>

            <ul className="mt-4 space-y-3">
              {kits.map((k) => (
                <li key={k.id} className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{k.name}</div>
                      <div className="mt-1 text-xs text-zinc-400">{k.description}</div>
                      <div className="mt-2 text-xs text-zinc-500">
                        <span className="text-zinc-400">id:</span> {k.id}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        className="rounded-lg border border-zinc-700 px-3 py-2 text-xs"
                        onClick={() => startEdit(k.id)}
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-200"
                        onClick={() => remove(k.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">
                    <div className="text-zinc-500">promptFragment:</div>
                    <div className="mt-1 whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
                      {k.promptFragment}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="text-lg font-semibold">Edit</h2>

            {editingId ? (
              <div className="mt-4 grid gap-2">
                <label className="text-xs text-zinc-400">ID</label>
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm"
                  value={draft.id || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
                />

                <label className="mt-3 text-xs text-zinc-400">Name</label>
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm"
                  value={draft.name || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />

                <label className="mt-3 text-xs text-zinc-400">Description</label>
                <input
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm"
                  value={draft.description || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />

                <label className="mt-3 text-xs text-zinc-400">Prompt fragment</label>
                <textarea
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm"
                  rows={6}
                  value={draft.promptFragment || ''}
                  onChange={(e) => setDraft((d) => ({ ...d, promptFragment: e.target.value }))}
                />

                {error && (
                  <div className="mt-2 rounded-xl border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-900"
                    onClick={save}
                  >
                    Save
                  </button>
                  <button className="rounded-xl border border-zinc-800 px-4 py-2 text-sm" onClick={cancel}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-400">Select a kit to edit, or create a new one.</p>
            )}

            <div className="mt-8 border-t border-zinc-800 pt-4">
              <h3 className="text-sm font-semibold">Import / Export</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-xl border border-zinc-800 px-3 py-2 text-sm" onClick={exportJson}>
                  Export JSON
                </button>
                <label className="rounded-xl border border-zinc-800 px-3 py-2 text-sm">
                  Import JSON
                  <input
                    className="hidden"
                    type="file"
                    accept="application/json"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const text = await f.text();
                      importJson(text);
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  className="rounded-xl border border-zinc-800 px-3 py-2 text-sm"
                  onClick={resetToDefaults}
                >
                  Reset to repo defaults
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
