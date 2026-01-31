export type BrandKit = {
  id: string;
  name: string;
  description: string;
  promptFragment: string;
};

export const BRAND_KITS: BrandKit[] = [
  {
    id: 'qsr-clean-bright',
    name: 'QSR Clean & Bright',
    description: 'Crisp, bright, friendly commercial look with clean highlights.',
    promptFragment: 'bright clean commercial lighting, crisp highlights, true-to-life color, subtle contrast',
  },
  {
    id: 'qsr-warm-cozy',
    name: 'QSR Warm & Cozy',
    description: 'Warm inviting tones, dinner rush vibe, soft falloff.',
    promptFragment: 'warm inviting lighting, soft shadows, cozy ambience, gentle contrast',
  },
];

export type ShotRecipe = {
  id: string;
  name: string;
  description: string;
  promptFragment: string;
};

export const SHOT_RECIPES: ShotRecipe[] = [
  {
    id: 'food-hero',
    name: 'Food Hero',
    description: 'Menu-perfect food for delivery apps, ads, and menus.',
    promptFragment: 'centered hero composition, shallow depth of field, appetizing close-up, photorealistic commercial food photography',
  },
  {
    id: 'dining-energy',
    name: 'Dining Room Energy',
    description: 'Make an empty dining room feel lively without identifiable faces.',
    promptFragment: 'lively dining ambience, non-identifiable patrons, realistic occupancy, no recognizable faces, natural motion, candid atmosphere',
  },
  {
    id: 'pickup-energy',
    name: 'Pickup Counter Energy',
    description: 'Queue + pickup shelf activity for QSR.',
    promptFragment: 'busy pickup counter, realistic queue activity, branded bags on shelf, no readable private info, no identifiable faces',
  },
];
