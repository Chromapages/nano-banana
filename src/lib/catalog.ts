import brandKits from '@/data/brand-kits.json';
import shotRecipes from '@/data/shot-recipes.json';
import { z } from 'zod';

export const BrandKitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  promptFragment: z.string().min(1),
});
export type BrandKit = z.infer<typeof BrandKitSchema>;

export const ShotRecipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  promptFragment: z.string().min(1),
  requiresPeopleAck: z.boolean().default(false),
});
export type ShotRecipe = z.infer<typeof ShotRecipeSchema>;

export const DefaultBrandKits: BrandKit[] = z.array(BrandKitSchema).parse(brandKits);
export const DefaultShotRecipes: ShotRecipe[] = z.array(ShotRecipeSchema).parse(shotRecipes);

const LS_KEYS = {
  brandKits: 'nano-banana.brandKits.v1',
  shotRecipes: 'nano-banana.shotRecipes.v1',
} as const;

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function loadBrandKitsClient(): BrandKit[] {
  if (typeof window === 'undefined') return DefaultBrandKits;
  const raw = window.localStorage.getItem(LS_KEYS.brandKits);
  if (!raw) return DefaultBrandKits;
  const parsed = safeJsonParse(raw);
  const res = z.array(BrandKitSchema).safeParse(parsed);
  return res.success ? res.data : DefaultBrandKits;
}

export function saveBrandKitsClient(kits: BrandKit[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LS_KEYS.brandKits, JSON.stringify(kits, null, 2));
}

export function loadShotRecipesClient(): ShotRecipe[] {
  if (typeof window === 'undefined') return DefaultShotRecipes;
  const raw = window.localStorage.getItem(LS_KEYS.shotRecipes);
  if (!raw) return DefaultShotRecipes;
  const parsed = safeJsonParse(raw);
  const res = z.array(ShotRecipeSchema).safeParse(parsed);
  return res.success ? res.data : DefaultShotRecipes;
}

export function saveShotRecipesClient(recipes: ShotRecipe[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LS_KEYS.shotRecipes, JSON.stringify(recipes, null, 2));
}

export function resetCatalogClient() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LS_KEYS.brandKits);
  window.localStorage.removeItem(LS_KEYS.shotRecipes);
}
