const palettes = ["butter", "coral", "mint", "sky"] as const;
export type CoverPalette = (typeof palettes)[number];

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(result);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function coverFor({ title, category }: { title: string; category?: string }): { palette: CoverPalette } {
  // Color follows the subject so every course in the same category shares one palette,
  // regardless of casing.
  const paletteKey = normalize(category || title) || "course";
  return { palette: palettes[hash(paletteKey) % palettes.length] };
}

export const barTones: Record<CoverPalette, string> = {
  butter: "bg-[#e6c65c]",
  coral: "bg-[#e08a75]",
  mint: "bg-[#7fbfa5]",
  sky: "bg-[#85b3d8]",
};

export const chipTones: Record<CoverPalette, string> = {
  butter: "bg-[#fbeec2] text-[#8a6410]",
  coral: "bg-[#fbd9d2] text-[#a8452f]",
  mint: "bg-[#d6efe4] text-[#2f6e56]",
  sky: "bg-[#d9e9f7] text-[#2d5f8a]",
};

export function CourseCover({ title, category, className = "" }: { title: string; category?: string; className?: string }) {
  const { palette } = coverFor({ category, title });

  return <div aria-hidden="true" className={`course-cover course-cover-${palette} ${className}`} />;
}
