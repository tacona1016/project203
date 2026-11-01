# 세션 인계

최근 갱신: 2026-11-01. 큰 작업 단위 완료 때 갱신한다. 재개 시 이 파일과 실제 Git diff를 먼저 확인한다. 비밀번호·키·쿠키·개인정보는 기록하지 않는다.

## 현재 개발 목표

POLLS의 multiple을 반복 누적에서 복수선택으로 변경한다. 회원별 선택지당 최대 1표, 배열로 동시 제출, allow_vote_change에 따라 최종 선택 집합을 수정한다. 저장 성공·실패·불확실 응답 피드백과 회귀 검증을 개선한다.

**로컬 구현과 실행 가능한 검증은 완료했다. 현재는 운영 반영 중이다.**

2026-11-01 사용자가 “너가 운영에 직접 반영해줘”라고 승인했다. 앞서 보고한 중복 2그룹·추가 3표의 canonical 정규화, 신규 migration, GitHub 반영과 Vercel 배포를 진행한다. 원본 votes와 기존 회원·댓글·게시글은 보존한다. 환경변수와 비밀번호는 변경하지 않는다.

## 운영 반영 진행 상황

- 시작 기준: remote main e2ff267579089bade5a5246cb073d3b1240fdf34, Vercel production READY. 로컬 .git은 이전 기준으로 유지되므로 remote tree 위에 이번 30개 변경만 반영한다.
- 최신 읽기 전용 확인: votes 45행, Poll 4개, 중복 2그룹·추가 3행, single 충돌 0. 새 canonical 테이블은 아직 없다.
- 기존 함수 정의를 Git 제외 `.verification/poll-release-before-functions.sql`에 보관했다. 이는 전체 DB 백업이 아니다. 운영 백업 설정은 직접 확인하지 못했다.
- 별도 PostgreSQL/개발 branch가 없어 실제 DB 쓰기·두 세션 검증은 아직 미수행이다. 운영에서는 합성 회원·투표를 만들지 않는다. 적용 transaction 안에서 원본 보존·새 집계·권한과 읽기 RPC를 검증한다.
- 다음 순서: 후보 commit/Preview 빌드 → 승인된 migration과 보존 검사 → main fast-forward/Production READY 확인 → 최종 기록 갱신. 운영 적용 결과는 완료 후 아래에 추가한다.

## 완료한 작업

- 직전 작업은 GitHub main e2ff267579089bade5a5246cb073d3b1240fdf34에 반영·운영 READY였다. 로컬 .git은 이전 기준이라 기존 완료 파일 33개가 변경으로 남아 있다. 초기화하지 않는다.
- 실제 코드와 운영 DB schema/권한을 읽기 전용 확인했다. multiple의 반복 INSERT, radio UI, 첫 옵션 조회, 변경 허용 강제 false가 원인이다.
- 운영 집계: votes 44행/Poll 4개/multiple 1개, 동일 회원·선택지 중복 2그룹/추가 3행/영향 Poll 1개. single 충돌 0. 개인/선택지 식별자는 보고하지 않았다.
- 별도 익명 Poll 설정은 코드·DB에 없다. choice 일반 결과는 집계만, 본인 선택은 서버 세션으로 제한한다. SQL anon 역할은 익명투표와 다르다.
- 계약: choice {optionIds:[]}, single만 구형 optionId 호환, text는 기존 textResponse. 참여 응답은 option_ids/has_participated/selection_count와 기존 필드를 제공한다.
- 원본 votes 보존을 위해 새 poll_choice_selections에 객관식 현재 선택을 저장한다. 복합 PK/부모 잠금/원자적 교체를 사용한다. 기존 중복 백필은 명시적 승인 설정 전 migration 전체 rollback으로 차단한다.
- DB/API와 checkbox/radio·선택 변경·성공/불확실 피드백 UI 초안을 통합했다. Agents는 사용량 제한으로 종료됐으며 현재 Main이 남은 파일 검토를 담당한다.
- 원격 실제 schema에 없는 복합 FK용 poll_options UNIQUE 인덱스를 SQL에 보완했다. 운영에 적용하지 않았다.
- 합성 API 통합 테스트와 production build가 통과했다. 신규 client 단위 tests 포함 총 38개, typecheck 통과, lint 오류 0/기존 경고 1이다.
- Chrome 복수선택·선택 변경·연속 submit·저장 실패/응답 손실·주관식·관리자 GUI 검증이 통과했다. production fixture도 build/start·Secure 쿠키·브라우저 secret canary·API 회귀를 통과했다.
- 관리자 폼의 hydration 전 기본 제출을 막고, 투표 직후 Close되어도 확인된 완료 피드백과 내 선택을 유지한다. 마지막 Chrome/품질 검사까지 통과했다. 390px/1440px 화면도 확인했다.
- 적용 정책·중복 정규화 승인·익명성 범위·새 테이블 백업 필요성을 docs/POLL_CHOICE_BALLOTS.md와 백업 문서에 정리했다. 실제 배포/DB 쓰기는 없다.

## 수정한 파일

- DB: supabase/migrations/20261101000000_choice_ballots.sql, supabase/inspect_choice_ballots.sql, supabase/tests/choice_ballots.sql 신규.
- 서버/client: lib/polls.ts, lib/site-api.ts, lib/supabase/{types,queries,poll-errors}.ts 및 투표/참여 API.
- 회원/Admin UI, CSS, fixtures/단위·API·브라우저 tests, README·백업·인계 문서까지 총 30개 파일. [전체 목록과 역할](POLL_CHOICE_BALLOTS.md)의 변경 파일 표를 참고한다.
- 이전 코드 hash: Git 제외 .verification/poll-choice-baseline.json. 이전 인계 문서: .verification/session-handoff-before-choice.md. 기존 완료 변경을 덮어쓰지 않는다.

## 미완료 작업

- 요청 범위의 로컬 코드·자동 검증은 완료했고 남은 필수 로컬 수정은 없다.
- 실제 PostgreSQL transaction·두 연결 동시성·RLS 실행은 도구/네트워크 제약으로 미검증이다. TEST-only SQL과 수동 두 세션 절차를 준비했으며 운영 DB에서 대신 테스트하지 않는다.
- 운영 중복 3표가 canonical 집계에서 제외되는 효과는 사용자 검토·승인 후에만 적용한다. 운영 SQL은 실행하지 않는다.

## 발생한 오류

- psql/PostgreSQL/Docker/Supabase CLI/PGlite가 로컬에 없다. npm registry 조회도 EACCES로 차단돼 실제 PostgreSQL 테스트 실행이 현재 불가하다. TEST SQL과 합성 HTTP를 실제 PG 검증으로 보고하지 않는다.
- 기존 postcss.config.mjs lint 경고 1건과 Node 모듈 형식 경고가 있었다.
- 1차 Chrome 검사에서 저장 완료 메시지가 결과 refresh보다 먼저 나타나 결과를 너무 일찍 단정하는 테스트 실패가 있었다. 결과 UI 갱신 대기를 추가했다. 저장 ACK와 결과 새로고침은 의도적으로 분리된 동작이다.
- 추가 Chrome 검사에서 Admin 폼이 hydration 전에 기본 GET으로 제출되는 문제를 실제 요청 로그로 확인했다. 초기 연결 완료 guard/POST method를 추가했고 SSR·브라우저 검사까지 통과했다.
- 직전 운영 HTTP 검증도 네트워크 제한으로 미확인이다. 이번에 실제 비밀번호나 운영 테스트 데이터를 사용하지 않는다.

## 다음 실행할 작업

1. 현재 실행 중인 작업이나 Agent는 없다. 이미 완료한 구현/검증을 다시 만들지 말고 다음 사용자 요청에 맞춰 진행한다.
2. DB 적용 요청을 받으면 docs/POLL_CHOICE_BALLOTS.md와 읽기 전용 진단 SQL을 먼저 검토한다. 중복 3표 정규화 효과를 승인받기 전 승인 설정을 켜거나 운영 migration을 실행하지 않는다.
3. 별도 TEST PostgreSQL에서 새 migration·TEST SQL·동시 세션을 검증한 뒤 승인 범위에서 SQL → 새 앱 순서로 운영 반영한다. 원본 votes나 canonical 상태를 삭제하지 않는다.
4. 실제 PG 실행 불가·정규화 승인 필요·익명 설정 부재를 보고하고 운영 DB 쓰기·push·배포를 하지 않는다.
5. 큰 단위 완료 때 이 문서의 진행·오류·파일·테스트를 갱신한다.

## 테스트 결과

- 이번 변경: 단위 38개·typecheck·build·test:integration·test:browser·test:production 통과, lint 오류 0/기존 경고 1. 브라우저는 모바일/데스크톱·checkbox/radio·변경·연속 submit·응답 손실·실패·Close/Reopen·주관식·Admin GUI를 확인했다. 중간에 발견된 브라우저 실패는 수정 후 해당 검증을 통과했다.
- 실제 PostgreSQL/RLS 실행 검증은 아니며 운영 DB 쓰기·push·배포는 하지 않았다. 상세 결과는 [복수선택 검증 기록](POLL_CHOICE_BALLOTS.md)에 있다.
- 직전 배포 기준: 단위 31개, lint 오류 0/기존 경고 1, typecheck/build/통합/브라우저/production fixture 통과. 이번 변경 결과가 아니다.
- 이번 운영 확인은 schema/권한·중복 집계 SELECT만 수행했다. 데이터 변경은 없다.
