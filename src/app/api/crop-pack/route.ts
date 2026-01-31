import { NextResponse } from 'next/server';
import { z } from 'zod';
import sharp from 'sharp';
import archiver from 'archiver';
import { PassThrough, Readable } from 'node:stream';

const BodySchema = z.object({
  imageBase64: z.string().min(10),
  mimeType: z.string().min(3),
  prefix: z.string().optional(),
});

type CropSpec = {
  group: string;
  filename: string;
  width: number;
  height: number;
};

const CROPS: CropSpec[] = [
  // Google Business Profile
  { group: 'gbp', filename: 'gbp-4x3-1200x900.png', width: 1200, height: 900 },
  { group: 'gbp', filename: 'gbp-1x1-1200x1200.png', width: 1200, height: 1200 },

  // Instagram
  { group: 'instagram', filename: 'instagram-1x1-1080x1080.png', width: 1080, height: 1080 },
  { group: 'instagram', filename: 'instagram-4x5-1080x1350.png', width: 1080, height: 1350 },

  // Stories/Reels
  { group: 'stories-reels', filename: 'stories-reels-9x16-1080x1920.png', width: 1080, height: 1920 },

  // Meta ads
  { group: 'meta-ads', filename: 'meta-ads-1x1-1080x1080.png', width: 1080, height: 1080 },
  { group: 'meta-ads', filename: 'meta-ads-4x5-1080x1350.png', width: 1080, height: 1350 },

  // Delivery apps
  { group: 'delivery-apps', filename: 'delivery-1x1-1200x1200.png', width: 1200, height: 1200 },
];

export async function POST(req: Request) {
  try {
    const body = BodySchema.parse(await req.json());
    const input = Buffer.from(body.imageBase64, 'base64');

    // Pre-parse image once, then clone per crop.
    const base = sharp(input).rotate();

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
    });

    const nodeStream = new PassThrough();
    archive.pipe(nodeStream);
    const readable = Readable.toWeb(nodeStream) as any;

    const prefix = (body.prefix || 'nano-banana').replace(/[^a-zA-Z0-9-_]+/g, '-');

    // Generate crops sequentially to keep memory bounded.
    for (const c of CROPS) {
      const out = await base
        .clone()
        .resize(c.width, c.height, { fit: 'cover', position: 'centre' })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();

      archive.append(out, { name: `${prefix}/${c.group}/${c.filename}` });
    }

    void archive.finalize();

    return new NextResponse(readable as any, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${prefix}-crop-pack.zip"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed' }, { status: 500 });
  }
}
