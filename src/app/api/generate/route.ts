import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGemini, getGeminiModel } from '@/lib/gemini';
import { Modality } from '@google/genai';

const BodySchema = z.object({
  imageBase64: z.string().min(10),
  mimeType: z.string().min(3),
  userPrompt: z.string().default(''),
  brandKitPrompt: z.string().optional(),
  recipePrompt: z.string().optional(),
  strictness: z.number().min(0).max(100).default(70),
});

function strictnessSubjectRules(strictness: number) {
  if (strictness >= 85) {
    return 'CRITICAL: preserve the exact real scene and subject identity from the source image. Do not change the food items, signage, architecture, or layout. Only enhance lighting, cleanliness, and ambience. If adding people, they must be non-identifiable silhouettes and must not alter the environment.';
  }
  if (strictness >= 60) {
    return 'Preserve the core subject and layout. You may remove clutter and improve presentation. If adding ambience/people, keep it subtle and realistic, with no identifiable faces.';
  }
  return 'You may creatively enhance the scene while keeping it realistic and on-brand. No identifiable faces. No false claims.';
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

    const stylePrompt = await elevatePrompt({
      userPrompt: body.userPrompt,
      brandKitPrompt: body.brandKitPrompt,
      recipePrompt: body.recipePrompt,
      strictness: body.strictness,
    });

    const fullPrompt = `Task: Transform the provided restaurant/QSR photo into a high-performing marketing image.\n\nSUBJECT & SAFETY RULES:\n${strictnessSubjectRules(body.strictness)}\n\nSTYLE & AMBIENCE:\n${stylePrompt}\n\nOUTPUT: photorealistic, high-resolution, commercial photography look.`;

    const gemini = getGemini();
    const response = await gemini.models.generateContent({
      model: getGeminiModel(),
      contents: {
        parts: [
          { inlineData: { data: body.imageBase64, mimeType: body.mimeType } },
          { text: fullPrompt },
        ],
      },
      config: { responseModalities: [Modality.IMAGE] },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const img = parts.find((p) => (p as any).inlineData)?.inlineData?.data;
    if (!img) return NextResponse.json({ ok: false, error: 'No image returned (blocked or failed).' }, { status: 400 });

    return NextResponse.json({ ok: true, imageBase64: img });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed' }, { status: 500 });
  }
}
