import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGemini, getGeminiModel } from '@/lib/gemini';
import { Modality } from '@google/genai';
import { autoCleanImage } from '@/lib/imagePreprocess';
import { DefaultShotRecipes } from '@/lib/catalog';
import crypto from 'node:crypto';

const BodySchema = z.object({
  imageBase64: z.string().min(10),
  mimeType: z.string().min(3),
  userPrompt: z.string().default(''),
  brandKitPrompt: z.string().optional(),
  recipePrompt: z.string().optional(),
  recipeId: z.string().optional(),
  strictness: z.number().min(0).max(100).default(70),
  autoClean: z.boolean().default(true),
  variants: z.number().int().min(1).max(8).default(1),
  originalSha256: z.string().optional(),
  peopleAck: z.boolean().optional(),
});

function strictnessSubjectRules(strictness: number) {
  const shared = [
    'ABSOLUTE GUARDRAILS: do NOT add, remove, or modify any readable text, signage, prices, logos, or labels. If text exists in the source, keep it exactly unchanged.',
    'If people are present/added: they MUST be non-identifiable (no recognizable faces, no clear facial features, no unique tattoos). Prefer silhouettes or heavily blurred background patrons.',
  ].join(' ');

  if (strictness >= 85) {
    return (
      'CRITICAL: preserve the exact real scene and subject identity from the source image. Do not change the food items, signage, architecture, or layout. Only enhance lighting, cleanliness, and ambience. ' +
      shared
    );
  }
  if (strictness >= 60) {
    return (
      'Preserve the core subject and layout. You may remove small clutter and improve presentation without changing what is depicted. ' +
      shared
    );
  }
  return (
    'You may creatively enhance the scene while keeping it realistic and on-brand. No false claims. ' +
    shared
  );
}

async function elevatePrompt({
  userPrompt,
  brandKitPrompt,
  recipePrompt,
  strictness,
}: {
  userPrompt: string;
  brandKitPrompt?: string;
  recipePrompt?: string;
  strictness: number;
}) {
  const systemInstruction = `You are an expert QSR photo director. Write a single paragraph describing only the STYLE, LIGHTING, CLEANLINESS, and AMBIENCE to apply to an uploaded restaurant photo.\n\nRules:\n- Do NOT guess specific food items unless the user prompt explicitly names them.\n- Do NOT invent new signage, prices, or readable text.\n- Any people added must be non-identifiable (no recognizable faces).\n- Prefer realistic commercial photography.\n\nStrictness guidance: ${strictness >= 85 ? 'STRICT' : strictness >= 60 ? 'BALANCED' : 'CREATIVE'}.`;

  const context = [
    `[USER PROMPT]: ${userPrompt || ''}`,
    `[BRAND KIT]: ${brandKitPrompt || ''}`,
    `[SHOT RECIPE]: ${recipePrompt || ''}`,
  ].join('\n');

  const gemini = getGemini();
  const response = await gemini.models.generateContent({
    model: getGeminiModel(),
    contents: context,
    config: { systemInstruction },
  });

  return (response.text || '').trim();
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = BodySchema.parse(json);

    const recipeMeta = body.recipeId ? DefaultShotRecipes.find((r) => r.id === body.recipeId) : undefined;
    if (recipeMeta?.requiresPeopleAck && !body.peopleAck) {
      return NextResponse.json(
        { ok: false, error: 'This recipe may add people/energy. Please acknowledge the people compliance checkbox.' },
        { status: 400 },
      );
    }

    const inputBuf: Buffer = Buffer.from(body.imageBase64, 'base64') as unknown as Buffer;
    const originalSha256 =
      body.originalSha256 || crypto.createHash('sha256').update(inputBuf).digest('hex');

    let processedBuf: Buffer = inputBuf;
    let processedMime = body.mimeType;
    if (body.autoClean) {
      const cleaned = await autoCleanImage(inputBuf);
      processedBuf = cleaned.buffer as unknown as Buffer;
      processedMime = cleaned.mimeType;
    }
    const processedSha256 = crypto.createHash('sha256').update(processedBuf).digest('hex');
    const processedBase64 = processedBuf.toString('base64');

    const model = getGeminiModel();

    const baseStylePrompt = await elevatePrompt({
      userPrompt: body.userPrompt,
      brandKitPrompt: body.brandKitPrompt,
      recipePrompt: body.recipePrompt,
      strictness: body.strictness,
    });

    const variantDeltas = [
      'Daypart: bright late-morning natural light; crowd: minimal.',
      'Daypart: lunch rush; crowd: moderately busy (non-identifiable).',
      'Daypart: warm dinner lighting; crowd: moderately busy (non-identifiable).',
      'Daypart: evening ambience; crowd: subtle background motion (non-identifiable).',
    ];

    const results: Array<{ imageBase64: string; provenance: any }> = [];

    const gemini = getGemini();

    for (let i = 0; i < body.variants; i++) {
      const delta = i === 0 ? '' : variantDeltas[(i - 1) % variantDeltas.length];
      const stylePrompt = delta ? `${baseStylePrompt}\n\nVARIANT DELTA: ${delta}` : baseStylePrompt;

      const fullPrompt = `Task: Transform the provided restaurant/QSR photo into a high-performing marketing image.\n\nSUBJECT & SAFETY RULES:\n${strictnessSubjectRules(body.strictness)}\n\nSTYLE & AMBIENCE:\n${stylePrompt}\n\nOUTPUT: photorealistic, high-resolution, commercial photography look.`;

      const response = await gemini.models.generateContent({
        model,
        contents: {
          parts: [
            { inlineData: { data: processedBase64, mimeType: processedMime } },
            { text: fullPrompt },
          ],
        },
        config: { responseModalities: [Modality.IMAGE] },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      const img = parts.find((p) => (p as any).inlineData)?.inlineData?.data;
      if (!img) {
        return NextResponse.json({ ok: false, error: 'No image returned (blocked or failed).' }, { status: 400 });
      }

      results.push({
        imageBase64: img,
        provenance: {
          createdAt: new Date().toISOString(),
          model,
          variantIndex: i,
          variantDelta: delta || null,
          originalSha256,
          processedSha256,
          autoClean: body.autoClean,
          strictness: body.strictness,
          userPrompt: body.userPrompt,
          brandKitPrompt: body.brandKitPrompt || null,
          recipeId: body.recipeId || null,
          recipePrompt: body.recipePrompt || null,
          baseStylePrompt,
          stylePrompt,
          fullPrompt,
        },
      });
    }

    return NextResponse.json({ ok: true, imageBase64: results[0]?.imageBase64, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed' }, { status: 500 });
  }
}
