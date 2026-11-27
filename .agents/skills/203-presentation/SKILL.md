---
name: 203-presentation
description: Create and revise 203 PROJECT MDX presentations, quarterly review decks and poll-analysis charts with the DeviceBook-inspired presentation theme.
---

# 203 DeviceBook Presentation

Apply to 203 PROJECT presentations, not HOME, BOARD, POLLS or ADMIN redesigns. Reference: https://semi.euiyun.com/device/ . Read [design-tokens.md](references/design-tokens.md) for actual/adapted values and [chart-guidelines.md](references/chart-guidelines.md) before aggregate analysis. Use [the template](assets/quarter-template.mdx) for new decks.

## Implementation

Reuse Next.js/MDX, Slide, SectionTitle, TwoColumn, MetricGrid (PresentationStats alias), ImageBlock, existing figures and PresentationNavigator. New theme lives in components/presentation/theme/ and is opt-in via PresentationTheme. Its CSS must stay under .presentation-theme; never replace site-wide variables or existing published MDX defaults. The containing route must requireAccessSession before rendering. Register reusable components in mdx-components.tsx.

Use one core message per slide. Choose cover/hero, section introduction, chart + insight, two-column comparison, KPI or conclusion/next-steps layout as appropriate. Keep text concise, prefer tables/charts for quantitative comparisons. Separate confirmed data, interpretation, caveats and proposed actions with labeled callouts. Do not call a poll result a final agreement.

Typography: Pretendard Variable, Noto Sans KR, system sans-serif; numbers use JetBrains Mono or system monospace. Font failure must not break layout. Light mode is required; initial implementation is light-only. Do not inherit device dark mode without complete scoped tokens and browser checks. Use purple and teal with consistent meaning, restrained borders/radius, no decorative animation. See reference values before changing theme tokens.

## Data and confidentiality

Read actual DB metadata and current result policy before aggregating. Use canonical poll_choice_selections.is_selected=true for choice ballots, not old vote events. Count distinct respondents, not selected rows. Single-choice percentages divide by respondents; multiple-choice selection rates may sum above 100% and must not use pie charts. Show denominator, quantity, unit, ties, source and fixed server snapshot time. Keep chart data independent of rendering. Never fabricate missing values or semantic labels. User-approved aliases must be visibly marked as temporary.

Validate source counts and ranges, independently recompute summary statistics, and explain invalid responses without auto-repair. Do not export names, UUIDs, raw member text, credentials or individual ballots. Keep actual snapshots, analysis decks and screenshots in ignored .verification, never public/ or tracked client imports. Public example/test data must be synthetic. Authentication and results visibility remain unchanged.

## Reading and presenting

Reading mode keeps vertical scrolling, anchors, TOC, active progress and previous/next. Opt-in book presentation mode shows one section in fullscreen with arrows/PageUp/PageDown; long content scrolls within the section instead of shrinking or clipping. TOC supports click and ESC; focus and native buttons/links remain usable.

Check 390, 768, 1440 and 1920×1080: no horizontal overflow, legible chart labels, visible quantity/units, source timestamps, fallback fonts, image ratios, keyboard navigation, TOC and fullscreen exit. Capture actual screenshots; distinguish browser results from unit fixtures and production E2E.

## Workflow and approval

Read repository AGENTS and this skill → collect/validate data → outline messages → write MDX → apply shared theme → render in authenticated local review → inspect screenshots and navigation → provide review artifacts.

Preserve existing published files and data unless the task explicitly authorizes replacement. Review copies and presentation components are allowed on a safe branch; production content replacement, deployment or DB changes require authorization in the current task. Never infer approval from older unrelated releases. Update docs/SESSION_HANDOFF.md after major units.

DeviceBook's executable code is MIT; educational prose/figures are CC BY 4.0. Prefer original 203 implementation informed by design principles. Do not copy its teaching content, simulators, brand or logo. If copying source, preserve applicable copyright/license notices. Fonts have separate OFL licenses; document their delivery and any unverified loading.
