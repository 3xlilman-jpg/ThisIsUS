import type { ImageVariant } from './types';

export const IMAGE_VARIANTS: Omit<ImageVariant, 'url'>[] = [
  {
    style: 'Cinematic',
    description: 'Dramatic lighting and rich colors for a premium, movie-poster feel.'
  },
  {
    style: 'Hyperreal',
    description: 'Ultra-realistic details and textures that make the product look tangible.'
  },
  {
    style: 'Studio Pro',
    description: 'Clean, elegant, and professional with perfect studio lighting.'
  },
];