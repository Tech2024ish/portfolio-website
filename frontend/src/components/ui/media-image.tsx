import Image from "next/image";

import type { ImageVariant } from "@/content/profile";

type Props = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Narrower versions of a media-library image. */
  variants?: ImageVariant[];
  sizes: string;
  className?: string;
  priority?: boolean;
};

/** Files shipped in /public, which Next.js optimises itself. */
function isBundled(src: string): boolean {
  return src.startsWith("/") && !src.startsWith("//") && !src.startsWith("/api/");
}

/**
 * An image from either source:
 * - bundled with the site (/public): next/image, which makes the responsive sizes;
 * - from the media library: the API already stored WebP versions at fixed widths and serves every
 *   file under an immutable URL, so a plain `srcset` is used and the image is not processed twice.
 * Width and height are always set, so the layout never shifts while loading.
 */
export function MediaImage({ src, alt, width, height, variants = [], sizes, className, priority }: Props) {
  const loading = priority ? "eager" : "lazy";
  if (isBundled(src) && variants.length === 0) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        className={className}
        loading={loading}
        fetchPriority={priority ? "high" : undefined}
      />
    );
  }
  const srcSet = [...variants.map((variant) => `${variant.url} ${variant.width}w`), `${src} ${width}w`].join(
    ", ",
  );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- library images are already optimised (see above)
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      decoding="async"
      fetchPriority={priority ? "high" : undefined}
    />
  );
}
