import type { MDXComponents } from "mdx/types";
import { Hero } from "@/components/presentation/Hero";
import { Slide } from "@/components/presentation/Slide";
import { SectionTitle } from "@/components/presentation/SectionTitle";
import { ImageBlock } from "@/components/presentation/ImageBlock";
import { TwoColumn } from "@/components/presentation/TwoColumn";
import { Presentation } from "@/components/presentation/Presentation";
import { MetricGrid } from "@/components/presentation/MetricGrid";
import { Timeline } from "@/components/presentation/Timeline";
import { Checklist } from "@/components/presentation/Checklist";
import { CommentSection } from "@/components/interactive/CommentSection";
import { PhaseRoadmap } from "@/components/presentation/PhaseRoadmap";
import { FactorGrid } from "@/components/presentation/FactorGrid";
import { ScoreGuide } from "@/components/presentation/ScoreGuide";

const presentationComponents = {
  Hero,
  Slide,
  SectionTitle,
  ImageBlock,
  TwoColumn,
  Presentation,
  MetricGrid,
  Timeline,
  Checklist,
  CommentSection,
  PhaseRoadmap,
  FactorGrid,
  ScoreGuide,
} satisfies MDXComponents;

export function useMDXComponents(components: MDXComponents = {}): MDXComponents {
  return { ...presentationComponents, ...components };
}
