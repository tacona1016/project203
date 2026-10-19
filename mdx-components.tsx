import type { MDXComponents } from "mdx/types";
import { Hero } from "@/components/presentation/Hero";
import { Slide } from "@/components/presentation/Slide";
import { SectionTitle } from "@/components/presentation/SectionTitle";
import { ImageBlock } from "@/components/presentation/ImageBlock";
import { TwoColumn } from "@/components/presentation/TwoColumn";
import { Presentation } from "@/components/presentation/Presentation";

const presentationComponents = {
  Hero,
  Slide,
  SectionTitle,
  ImageBlock,
  TwoColumn,
  Presentation,
} satisfies MDXComponents;

export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...presentationComponents, ...components };
}
