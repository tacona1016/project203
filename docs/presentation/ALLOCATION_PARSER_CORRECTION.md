# 설문 결과 명칭 및 번호형 응답 처리 보완

## 변경

- Compact 제목을 ‘설문 조사 결과’로 정리했다. 상세 자료/PPTX의 표지도 같은 제목을 사용한다.
- 성향 네 항목은 사용자 확인 순서대로 거리(접근성), 토지 넓이, 주변 환경, 건축시기로 표시한다.
- 기존 파서는 답변에 붙인 문항번호를 점수로 세어 정상적인 번호형 응답을 제외할 수 있었다. 명확한 1~4번 네 줄 목록의 번호와 점수를 분리한다.
- 항목번호 네 개가 중복/누락 없이 있어야 하며, 줄 순서가 달라도 실제 문항번호로 연결한다. 각 점수는 정수1~4, 합계10을 그대로 검증한다. 모호한 추가숫자나 잘못된 값을 임의 수정하지 않는다.
- SQL은 SELECT/CTE로 집계할 뿐 기존 응답·DB스키마·투표API·회원인증을 변경하지 않는다. JS 파서와 SQL 파서는 서로 독립적으로 같은 형식을 검증한다.
- 실제 응답 원문·회원명·UUID를 공개 파일이나 테스트에 기록하지 않았다. 단위 테스트는 별도 합성 예시만 사용한다.

## 산출물

현재 집계 JSON, Compact/상세 MDX, 분석 문서와 PPTX를 같은 데이터로 재생성한다. 이전 스냅샷은 ignored data/archive/poll-results-before-numbered-parser.json으로 보존하고, 실제 재집계 수치는 ignored review/ALLOCATION_CORRECTION.md에 기록한다.
스냅샷은 새 서버 집계 시각을 명시하며 score_parser_version=2, 항목의 label_status=user_confirmed, format_counts를 포함한다.
기본 로컬 검토 URL은 http://127.0.0.1:3210/presentation-review/results 이고, 기존 상세10장은 /presentation-review/results-detail이다.

## 검증

- Node 단위 테스트130/130 PASS. 번호형 목록·역순 목록·중복번호·누락·추가합계숫자·소수·범위·잘못된합계 회귀 포함.
- 실제 PostgreSQL에서 집계 SQL의 동일 파서 CTE에 합성 VALUES/JSON 레코드11종을 넣은 읽기 전용 SELECT 검사 PASS. 테스트 행·시퀀스·임시객체 생성 없음.
- 실제 운영 응답은 읽기 전용 재집계 후 JS로 분포·평균·중앙값·최솟값·최댓값·모집단 표준편차를 독립 검증했다. 개별 원문은 분석 파일에 포함하지 않는다.
- Typecheck PASS, lint오류0/기존경고1, conflict/presentation check와 Production Build PASS.
- Compact 실제Chrome310항목, 390/768/1440/1920 PASS. 제목·네 항목명·새 수치·0표 항목·가로 넘침·한 장 레이아웃 확인.
- 상세 및 기존 발표자료 Chrome 검증은 ignored browser-report.json에 기록한다. 네이티브 전체화면/Office/Safari/실제운영회원 E2E는 기존 미검증 범위를 유지한다.

## 운영 영향

Production 배포·GitHub Push·운영 DB/Storage/환경변수 변경 없음. 기존 app/quarter/2026-q4/page.mdx와 원래 자료의 성향 항목은 변경하지 않는다. 사용자 확인 항목명은 결과 설문 해석에만 적용한다.
