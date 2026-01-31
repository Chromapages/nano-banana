'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadBrandKitsClient, loadShotRecipesClient, type BrandKit, type ShotRecipe } from '@/lib/catalog';
import { sha256HexFromBase64 } from '@/lib/clientHash';

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
  const [results, setResults] = useState<Array<{ imageBase64: string; provenance: any }> | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
  const [shotRecipes, setShotRecipes] = useState<ShotRecipe[]>([]);

  const [brandKit, setBrandKit] = useState<string>('');
  const [recipe, setRecipe] = useState<string>('');
  const [strictness, setStrictness] = useState(70);
  const [autoClean, setAutoClean] = useState(true);
  const [variants, setVariants] = useState(4);
  const [userPrompt, setUserPrompt] = useState('');
  const [peopleAck, setPeopleAck] = useState(false);

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
  const requiresPeopleAck = !!recipeObj?.requiresPeopleAck;

  useEffect(() => {
    setPeopleAck(false);
  }, [recipe]);

  async function generate() {
    if (!file) return;
    if (requiresPeopleAck && !peopleAck) {
      setError('Please acknowledge the people compliance checkbox for this recipe.');
      return;
    }

    setBusy(true);
    setError(null);
    setResults(null);
    setSelectedIdx(0);

    try {
      const { base64, mime } = await fileToBase64(file);
      const originalSha256 = await sha256HexFromBase64(base64);

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
          autoClean,
          variants,
          originalSha256,
          peopleAck: requiresPeopleAck ? peopleAck : undefined,
        }),
      });

      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'Generate failed');
      setResults(j.results || [{ imageBase64: j.imageBase64, provenance: null }]);
      setSelectedIdx(0);
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
                  setResults(null);
                  setSelectedIdx(0);
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

                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/30 px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold">Auto-clean</div>
                    <div className="text-xs text-zinc-400">Deterministic pre-processing (normalize + denoise + sharpen).</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoClean}
                    onChange={(e) => setAutoClean(e.target.checked)}
                    className="h-4 w-4"
                  />
                </div>

                <label className="mt-3 text-xs text-zinc-400">Variants</label>
                <select
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm"
                  value={variants}
                  onChange={(e) => setVariants(Number(e.target.value))}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                {requiresPeopleAck && (
                  <div className="mt-3 rounded-xl border border-amber-900/40 bg-amber-950/20 p-3">
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={peopleAck}
                        onChange={(e) => setPeopleAck(e.target.checked)}
                        className="mt-1 h-4 w-4"
                      />
                      <span>
                        I acknowledge: any added people must be <span className="font-semibold">non-identifiable</span>,
                        and the model must <span className="font-semibold">not change any signage/text</span>.
                      </span>
                    </label>
                  </div>
                )}

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
              disabled={!file || busy || (requiresPeopleAck && !peopleAck)}
              onClick={generate}
            >
              {busy ? 'Generating…' : 'Generate'}
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="text-lg font-semibold">3) Result</h2>
              {results?.length ? (
                <>
                  {results.length > 1 && (
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {results.map((r, idx) => (
                        <button
                          key={idx}
                          className={`overflow-hidden rounded-xl border ${idx === selectedIdx ? 'border-white' : 'border-zinc-800'} bg-zinc-950/40`}
                          onClick={() => setSelectedIdx(idx)}
                          title={`Variant ${idx + 1}`}
                        >
                          <img
                            src={`data:image/png;base64,${r.imageBase64}`}
                            alt={`variant-${idx + 1}`}
                            className="aspect-square w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  <img
                    src={`data:image/png;base64,${results[selectedIdx]?.imageBase64}`}
                    alt="result"
                    className="mt-4 w-full rounded-xl border border-zinc-800"
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      className="inline-block rounded-xl border border-zinc-700 px-4 py-3 text-sm"
                      href={`data:image/png;base64,${results[selectedIdx]?.imageBase64}`}
                      download={`nano-banana-variant-${selectedIdx + 1}.png`}
                    >
                      Download PNG
                    </a>

                    <button
                      className="rounded-xl border border-zinc-700 px-4 py-3 text-sm"
                      onClick={() => {
                        const prov = results[selectedIdx]?.provenance;
                        const blob = new Blob([JSON.stringify(prov, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `nano-banana-provenance-variant-${selectedIdx + 1}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Export audit JSON
                    </button>
                  </div>

                  {results[selectedIdx]?.provenance && (
                    <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/30 p-3">
                      <div className="text-xs font-semibold text-zinc-300">Audit trail</div>
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-zinc-400">
                        {JSON.stringify(results[selectedIdx]?.provenance, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-zinc-400">Upload an image and run Generate.</p>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h3 className="text-sm font-semibold">Guardrails</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-400">
                <li>No identifiable faces when adding people/energy (silhouettes/blur only).</li>
                <li>No text/signage changes (no additions, removals, or edits).</li>
                <li>Auto-clean does deterministic pre-processing before sending to the model.</li>
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
