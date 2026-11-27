# DeviceBook 참고 분석과 203 적용

## 확인 범위

2026-11-27 실제 사이트 https://semi.euiyun.com/device/ 및 공개 저장소 https://github.com/geniuskey/semi-books 를 확인했다. 기준 SHA: 09db5d4195cffbf46e232a1bfd198f84325848eb.
직접 읽은 파일: device/index.html, css/style.css, js/common.js, chapters/mos.html, CONTRIBUTING.md, LICENSE.md, shared/css/book-ui.css, shared/js/book-ui.js, shared/js/book-shell.js, LICENSE-MIT, LICENSE-CC-BY-4.0.
추출은 소스 기준이며, 운영 203 화면을 변경한 것은 아니다.

## 실제 값과 적용 값

|항목|DeviceBook 소스에서 확인|203 검토 테마 적용|
|---|---|---|
|배경/카드|#f6f7fb / #ffffff|동일 색상, presentation 변수로 격리|
|표면/보조|#eef1f7 / #e3e8f2|기본 표면만 사용|
|경계|#d6dce8|동일|
|텍스트/보조/희미한|#141a26 / #566178 / #8a93a8|본문/보조 동일, 희미한 텍스트 의존 최소화|
|강조/보조 강조|#5b3fd6 / #0d8a7f|차트/사실과 해석의 시각 구분|
|성공/경고/오류|#1f9d55 / #d98a00 / #d64545|검토 경고는 더 진한 #a36a00 경계와 #805300 글자|
|Radius|14px / 8px|패널14, callout8|
|Shadow|0 1px 2px 및 0 6px 20px rgba(16,24,40,.06)|추가 그림자 없이 경계 중심|
|본문 폰트|Pretendard Variable, 시스템 한글, Noto Sans KR|Pretendard Variable → Noto Sans KR → system-ui|
|수치|JetBrains Mono, ui-monospace|동일 우선순위, 시스템 mono fallback|
|본문|17px / 1.75|17px / 1.65, 모바일16px|
|h2/h3|28px / 20px|h2 clamp25–36, h3 20|
|표지|h1 clamp32–46, lead19/1.7|h1 clamp30–48, lead18/1.65|
|본문 폭|--maxw880, 셸1240, TOC230, gap40|도표와 2열을 위한 최대1120|
|간격|장 padding40/80, section margin64, h2아래18|슬라이드48/32, 패널gap24, 제목아래24|
|통계 패널|label12 / value18 또는 홈26 mono, padding12/16 또는18/20|기존 MetricGrid alias, 수치24–34, padding18/20|
|도표|흰 figure, border, radius14, padding20|접근 가능한 HTML 가로 막대, 인원·분모·단위 표시|
|상단 탐색|sticky58, blur12, 36px버튼, 2px진행선|기존 Navigator 재사용, 보라→청록 진행선|
|목차/이동|230px측면TOC, drawer min340/88vw, 2열pager|접이식 목차·현재위치·이전/다음·전체화면|
|모바일|760/600/440에서 라벨/검색 축소|767 기준 글자·패널 축소, 390 포함 실제 검사|
|인터랙션|챕터 이동, slider/simulation, 저장된 테마|탐색만 재사용, 교육 시뮬레이터 복제 없음|
|다크|#0b0f17배경/#121826카드/#e6ebf5본문/#a996ff강조, system+manual|1차 시안 라이트 전용, 사이트 다크모드 추가 안함|

## 폰트와 라이선스

DeviceBook은 jsDelivr Pretendard1.3.9 dynamic subset CSS와 Google Fonts JetBrains Mono400/600을 외부 로드한다. 203 첫 시안은 외부 폰트 요청을 추가하지 않고 설치 폰트/시스템 fallback으로 작동한다. 외부 연결 실패에도 줄바꿈/레이아웃 검증이 가능하다. 기본 스택은 Pretendard를 우선하지만 번들에 실제 폰트 파일이 포함됐다고 주장하지 않는다. 폰트 포함 배포를 확정하려면 OFL 고지와 선택한 woff2를 함께 보관해야 한다.
Pretendard LICENSE: https://github.com/orioncactus/pretendard/blob/main/LICENSE (SIL OFL1.1).
JetBrains Mono: https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt (SIL OFL1.1).

DeviceBook 코드 MIT와 교육 본문·그림 CC BY4.0 구분을 확인했다. 원저작자 geniuskey 및 DeviceBook contributors. 이번 구현은 색상·정보 위계를 참고한 새 React/CSS이며 교육 내용·SVG·시뮬레이터·로고를 복사하지 않았다. 기존 203 SVG를 그대로 재사용한다.
실제 코드 복사 시 https://github.com/geniuskey/semi-books/blob/main/LICENSE-MIT 고지를 보존해야 한다. 교육 자료 사용 시 별도 CC BY4.0 표시가 필요하다.

## 구조와 검토

기존 Warm Technical은 종이색·큰 슬라이드 여백과 SVG 중심이다. 새 검토 테마는 차가운 밝은 배경, 흰 도표 패널, 보라/청록 구분, 짧은 설명·수치·해석·근거 계층을 사용한다.
기존 SectionTitle/TwoColumn/Slide/MetricGrid/ImageBlock을 재사용하고, Theme/Hero/Chart/Callout/Summary/Source만 추가했다. MDX 등록은 추가만 하며 기존 운영 Presentation 기본값을 바꾸지 않는다.
발표 모드는 opt-in book 속성으로 기존 Navigator를 확장한다. 한 섹션씩 표시하며 긴 내용은 내부 스크롤한다. 기존 운영 자료의 Navigator 기본 동작은 그대로다.

프로젝트 로컬 Skill은 .agents/skills/203-presentation/SKILL.md이다. Codex 공식 안내의 cwd→상위 저장소 .agents/skills 검색 구조에 맞는다: https://learn.chatgpt.com/docs/build-skills . 실제 작업 저장소에서 실행해야 자동 발견 대상이 되며, 이전 root 위치에서 작업할 때는 AGENTS의 명시 경로로 읽는다.
