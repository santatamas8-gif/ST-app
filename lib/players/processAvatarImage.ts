import sharp from "sharp";

/** Square avatar edge length stored in Supabase (covers retina desktop circles). */
export const AVATAR_OUTPUT_SIZE = 512;

export type ProcessedAvatar = {
  buffer: Buffer;
  contentType: "image/jpeg";
  ext: "jpg";
};

/**
 * Normalize avatar uploads: EXIF rotate, face-biased cover crop, 512² JPEG.
 * Upscaling tiny sources cannot invent detail, but baking a high-quality square
 * avoids soft browser zoom on the displayed circle.
 */
export async function processAvatarImage(input: Buffer | Uint8Array): Promise<ProcessedAvatar> {
  const buffer = await sharp(input, { failOn: "none" })
    .rotate()
    .resize(AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE, {
      fit: "cover",
      // Bias toward the top of portraits (head), matching PROFILE_AVATAR_* CSS.
      position: "north",
      withoutEnlargement: false,
    })
    .sharpen({ sigma: 0.6 })
    .jpeg({
      quality: 92,
      mozjpeg: true,
      chromaSubsampling: "4:4:4",
    })
    .toBuffer();

  return { buffer, contentType: "image/jpeg", ext: "jpg" };
}
