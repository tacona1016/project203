# Tokens and layout

Authoritative extraction and pinned reference SHA: docs/presentation/DEVICEBOOK_REFERENCE.md.

|Meaning|DeviceBook light / 203 presentation|
|---|---|
|Background|#f6f7fb|
|Card|#ffffff|
|Surface|#eef1f7|
|Border|#d6dce8|
|Text / muted|#141a26 / #566178|
|Accent / secondary|#5b3fd6 / #0d8a7f|
|Radius / small|14px / 8px|

Namespace every theme variable with presentation-. Reference article max width 880px; 203 uses 1120px to support diagrams and paired panels, with 20px desktop/16px mobile margins. Section spacing 48px desktop/32px mobile, gap24px. Titles clamp25–36px, cover30–48px. Reference article body17px/1.75; 203 17px/1.65 and mobile16px. No broad shadow dependency.

Font stack prefers Pretendard Variable and Noto Sans KR, then system sans; mono prefers JetBrains Mono then system. Initial review does not download external fonts, so installed/fallback rendering must be tested. Do not claim Pretendard loaded without browser evidence.

Reference dark mode exists. 203 initial review deliberately light-only; implementing dark later requires scoped full palette, contrast checks and equal screenshot coverage, not a global theme toggle.
