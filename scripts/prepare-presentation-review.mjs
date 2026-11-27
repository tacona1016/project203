import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { analyzeSnapshot } from "../lib/presentation/poll-analysis.ts";

const output = path.resolve(".verification/presentation-review");
const dataFile = path.join(output, "data/poll-results-snapshot.json");
const data = analyzeSnapshot(JSON.parse(await readFile(dataFile, "utf8")));
await writeFile(dataFile, JSON.stringify(data, null, 2) + "\n");
for (const dir of ["mdx", "analysis", "review", "screenshots/existing", "screenshots/integrated", "reference", "archive"]) {
  await mkdir(path.join(output, dir), { recursive: true });
}
const original = await readFile("app/quarter/2026-q4/page.mdx", "utf8");
const compact = await readFile("scripts/templates/poll-results-compact.mdx", "utf8");
const sourceSlides = [...original.matchAll(/<Slide\b[\s\S]*?<\/Slide>/g)].map(match => match[0]);
const summarySlides = [...compact.matchAll(/<Slide\b[\s\S]*?<\/Slide>/g)].map(match => match[0]);
if (sourceSlides.length !== 12 || summarySlides.length !== 1) throw Error("Expected twelve original slides and one summary");
const imports = compact.split("<div")[0].trim();
const summary = compact.slice(compact.indexOf("<div")).replace('number="01"', 'number="13"');
let combined = original
  .replace("<PresentationSurveyResults />", "")
  .replace('import { getQuarter, getQuarterMetadata } from "@/data/quarters";', imports)
  .replace('export const metadata = getQuarterMetadata(getQuarter("2026-q4"));', "")
  .replace(/<Presentation quarter=\{getQuarter\("2026-q4"\)\}(?: theme="devicebook")?>/, '<PresentationTheme title="2026 Q4 · 리디자인 검토">')
  .replace(/<section id="comments"[\s\S]*?<\/section>/, "")
  .replace("</Presentation>", summary + "\n</PresentationTheme>");
const finalSlides = [...combined.matchAll(/<Slide\b[\s\S]*?<\/Slide>/g)].map(match => match[0]);
if (finalSlides.length !== 13 || JSON.stringify(finalSlides.slice(0, 12)) !== JSON.stringify(sourceSlides)) {
  throw Error("The first twelve slides must remain byte-identical, followed by exactly one summary");
}
if (!finalSlides[12].includes('id="results-overview" number="13"')) throw Error("Summary must be the thirteenth slide");
const ids = finalSlides.map(slide => slide.match(/id="([^"]+)"/)?.[1]);
if (new Set(ids).size !== ids.length) throw Error("Duplicate section anchors");
await writeFile(path.join(output, "mdx/existing-2026q4-v2.mdx"), combined);
await writeFile(path.join(output, "existing-2026q4-v2.mdx"), combined);

// Retire only the obsolete review files; never delete source data or originals.
for (const name of ["mdx/poll-results-v1.mdx", "mdx/poll-results-compact-v1.mdx", "poll-results-v1.pptx"]) {
  const from = path.resolve(output, name);
  if (!from.startsWith(output + path.sep)) throw Error("Invalid review archive source");
  try { await rename(from, path.join(output, "archive", Date.now() + "-" + path.basename(name))); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
const notes = {
  1: "응답자의 방향 전환 지지와 공식 최종 결정을 구분합니다.",
  9: "금액 구간은 납부 확약이나 평균 자금이 아닙니다. 실제 납부 조건은 별도 합의가 필요합니다.",
  10: "최다 구간이 전원의 거리 한도는 아닙니다. 더 가까운 거리를 고른 회원의 제약도 확인합니다.",
  12: "이용 목적을 후보지 비교에 참고하되 시설 사양이 확정된 것으로 보지 않습니다.",
  13: "집에서 1시간 30분 거리 가정의 응답이며 연간 횟수로 환산하지 않습니다.",
  14: "지역 선호는 개별 매물의 건축 가능성·가격·실제 이동 시간을 보장하지 않습니다."
};
let report = "# 2026 Q4 설문 조사 결과\n\n집계: " + data.snapshot_at_kst + " / " + data.snapshot_at_utc +
  "\n\n분모: 현재 등록 " + data.audience.registered + "명. 개인별 원문은 포함하지 않습니다.\n";
for (const poll of data.polls) {
  report += "\n## ID " + poll.id + " — " + poll.title + "\n\n- 유형: " + poll.poll_type + "/" + poll.vote_mode +
    " · 응답 " + poll.respondents + "명 · 참여율 " + poll.participation_percentage + "%\n";
  if (poll.options) {
    report += "\n|선택지|인원|응답자 대비 비율|순위|\n|---|---:|---:|---:|\n" +
      poll.options.map(option => "|" + [option.label, option.count, option.percentage + "%", option.rank].join("|") + "|").join("\n") +
      "\n\n" + notes[poll.id] + "\n";
  } else {
    report += "\n유효 " + poll.allocation.valid_count + "건 · 제외 " + poll.allocation.invalid_count +
      "건. 문항번호와 점수를 구분하고 원래 점수 그대로 집계했습니다.\n\n|항목|평균|중앙값|최소–최대|모집단 표준편차|1/2/3/4점 인원|\n|---|---:|---:|---|---:|---|\n" +
      poll.allocation.items.map(item => "|" + [item.label, item.mean.toFixed(2), item.median,
        item.minimum + "–" + item.maximum, item.population_standard_deviation, [1,2,3,4].map(score => item.distribution[score]).join("/")].join("|") + "|").join("\n") + "\n";
  }
}
await writeFile(path.join(output, "analysis/poll-results-summary.md"), report);
const digest = value => createHash("sha256").update(value).digest("hex");
await writeFile(path.join(output, "review/artifact-manifest.json"), JSON.stringify({
  snapshotAt: data.snapshot_at_utc, originalQ4Sha256: digest(original), originalSlideCount: 12,
  combinedSlideCount: 13, originalSlidesUnchanged: true, appendedSection: "results-overview",
  snapshotSha256: digest(await readFile(dataFile))
}, null, 2));
console.log("Review generated: original twelve slides preserved; survey summary appended as slide 13; detailed ten-slide deck retired.");
