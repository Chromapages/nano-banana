'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadBrandKitsClient, loadShotRecipesClient, type BrandKit, type ShotRecipe } from '@/lib/catalog';

function fileToBase64(file: File): Promise<{ base64: string; mime: string }>
{
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const res = String(reader.result || '');
      const m = res.match(/^data:(.+);base64,(.*)$/);
      if (!m) return reject(new Error('Invalid data URL'));
      resolve({ mime: m[1]!, base64: m[2]! });
    };
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultBase64, setResultBase64] = useState<string | null>(null);

  const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
  const [shotRecipes, setShotRecipes] = useState<ShotRecipe[]>([]);

  const [brandKit, setBrandKit] = useState<string>('');
  const [recipe, setRecipe] = useState<string>('');
  const [strictness, setStrictness] = useState(70);
  const [userPrompt, setUserPrompt] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bk = loadBrandKitsClient();
    const sr = loadShotRecipesClient();
    setBrandKits(bk);
    setShotRecipes(sr);
    setBrandKit((cur) => cur || bk[0]?.id || '');
    setRecipe((cur) => cur || sr[0]?.id || '');
  }, []);

  const brandKitObj = useMemo(() => brandKits.find((b) => b.id === brandKit), [brandKits, brandKit]);
  const recipeObj = useMemo(() => shotRecipes.find((r) => r.id === recipe), [shotRecipes, recipe]);

  async function generate() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResultBase64(null);

    try {
      const { base64, mime } = await fileToBase64(file);
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: mime,
          userPrompt,
          brandKitPrompt: brandKitObj?.promptFragment,
          recipePrompt: recipeObj?.promptFragment,
          recipeId: recipeObj?.id,
          strictness,
        }),
      });

      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'Generate failed');
      setResultBase64(j.imageBase64);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl p-6 md:p-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-semibold">Nano Banana</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Internal ChromaPages tool: upgrade QSR photos (food hero, dining energy, pickup energy). Gemini 3 Pro.
            </p>
          </div>
          <div className="flex gap-2">
            <a className="rounded-xl border border-zinc-800 px-4 py-2 text-sm" href="/admin/brand-kits">
              Brand kits
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="text-lg font-semibold">1) Upload</h2>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="mt-3 block w-full text-sm"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  setResultBase64(null);
                  setError(null);
                  if (f) {
                    const url = URL.createObjectURL(f);
                    setPreviewUrl(url);
                  } else {
                    setPreviewUrl(null);
                  }
                }}
              />
              {previewUrl && (
                <img src={previewUrl} alt="preview" className="mt-4 w-full rounded-xl border border-zinc-800" />
              )}
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="text-lg font-semibold">2) Recipe</h2>
              <div className="mt-3 grid gap-2">
                <label className="text-xs text-zinc-400">Shot recipe</label>
                <select
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm"
                  value={recipe}
                  onChange={(e) => setRecipe(e.target.value)}
                >
                  {shotRecipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>

                <label className="mt-3 text-xs text-zinc-400">Brand kit</label>
                <select
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm"
                  value={brandKit}
                  onChange={(e) => setBrandKit(e.target.value)}
                >
                  {brandKits.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <label className="mt-3 text-xs text-zinc-400">Strictness: {strictness}</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={strictness}
                  onChange={(e) => setStrictness(Number(e.target.value))}
                  className="w-full"
                />

                <label className="mt-3 text-xs text-zinc-400">Extra instructions (optional)</label>
                <textarea
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm"
                  rows={4}
                  placeholder="e.g. make it look like a busy dinner rush, keep signage unchanged"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 disabled:opacity-50"
              disabled={!file || busy}
              onClick={generate}
            >
              {busy ? 'Generating…' : 'Generate'}
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="text-lg font-semibold">3) Result</h2>
              {resultBase64 ? (
                <>
                  <img
                    src={`data:image/png;base64,${resultBase64}`}
                    alt="result"
                    className="mt-4 w-full rounded-xl border border-zinc-800"
                  />
                  <a
                    className="mt-4 inline-block rounded-xl border border-zinc-700 px-4 py-3 text-sm"
                    href={`data:image/png;base64,${resultBase64}`}
                    download="nano-banana.png"
                  >
                    Download PNG
                  </a>
                </>
              ) : (
                <p className="mt-3 text-sm text-zinc-400">Upload an image and run Generate.</p>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h3 className="text-sm font-semibold">Guardrails</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-400">
                <li>No identifiable faces when adding people/energy.</li>
                <li>No new signage/prices/readable text invented.</li>
                <li>Strictness controls how much the model can change.</li>
              </ul>
            </div>
          </div>
        </div>

        <p className="mt-10 text-xs text-zinc-500">
          Note: set GEMINI_API_KEY in .env.local. Default model: gemini-3-pro.
        </p>
      </div>
    </main>
  );
}
