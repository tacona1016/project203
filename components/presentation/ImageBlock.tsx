import Image from "next/image";

type ImageBlockProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  loading?: "eager" | "lazy";
};

export function ImageBlock({ src, alt, width, height, caption, loading = "lazy" }: ImageBlockProps) {
  return (
    <figure className="my-8 min-w-0">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        sizes="(min-width: 1280px) 1120px, (min-width: 768px) calc(100vw - 96px), calc(100vw - 40px)"
        className="h-auto w-full rounded-sm"
      />
      {caption && <figcaption className="mt-4 text-sm leading-6 text-muted">{caption}</figcaption>}
    </figure>
  );
}
