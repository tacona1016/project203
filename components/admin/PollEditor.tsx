"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PollData } from "@/lib/supabase/types";
import { parsePollInput, toSeoulInput } from "@/lib/polls";

export function PollEditor({ initial, quarterChoices }: { initial?: PollData; quarterChoices: readonly { slug: string; label: string; current: boolean }[] }) {
  const router = useRouter();
  const poll = initial?.poll;
  const [quarter, setQuarter] = useState(poll?.quarter ?? quarterChoices.find((item) => item.current)?.slug ?? "");
  const quarterLocked = (initial?.results?.total_votes ?? 0) > 0;
  const [pollType, setPollType] = useState(poll?.poll_type ?? "choice");
  const [visibility, setVisibility] = useState(poll?.results_visibility ?? "live");
  const [textMaxLength, setTextMaxLength] = useState(poll?.text_max_length ?? 1000);
  const [title, setTitle] = useState(poll?.title ?? "");
  const [description, setDescription] = useState(poll?.description ?? "");
  const [options, setOptions] = useState(initial?.options.length ? initial.options.map((option) => option.label) : ["", ""]);
  const [mode, setMode] = useState(poll?.vote_mode ?? "single");
  const [allowChange, setAllowChange] = useState(poll?.allow_vote_change ?? false);
  const [scheduled, setScheduled] = useState(!!(poll?.voting_starts_at || poll?.voting_ends_at));
  const [start, setStart] = useState(toSeoulInput(poll?.voting_starts_at ?? null));
  const [end, setEnd] = useState(toSeoulInput(poll?.voting_ends_at ?? null));
  const [hidden, setHidden] = useState(poll?.is_hidden ?? false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const body = { quarter, title, description, options: quarterLocked ? [] : options,
      poll_type: pollType, results_visibility: visibility, text_max_length: textMaxLength,
      vote_mode: pollType === "text" ? "single" : mode, allow_vote_change: allowChange, scheduled, start, end, is_hidden: hidden };
    try { parsePollInput(body, !initial, quarterChoices); } catch (error) { setError((error as Error).message); return; }
    setPending(true); setError("");
    try {
      const response = await fetch(initial ? `/api/admin/polls/${poll!.slug}` : "/api/admin/polls", {
        method: initial ? "PATCH" : "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (response.status === 401 || response.status === 403) { router.push("/admin"); router.refresh(); return; }
      if (!response.ok) throw new Error(result.error || "저장하지 못했습니다. 다시 시도해주세요.");
      router.push(`/admin/polls/${result.slug}`); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "저장하지 못했습니다."); setPending(false); }
  }

  return <form onSubmit={submit} className="admin-form" aria-busy={pending}>
    <fieldset disabled={pending}>
      <legend className="sr-only">투표 설정</legend>
      <section><h2>Basic</h2>
        <label htmlFor="poll-quarter">분기 *</label>
        <select id="poll-quarter" value={quarter} required disabled={quarterLocked} aria-describedby="poll-quarter-note" onChange={(event) => setQuarter(event.target.value)}>
          <option value="" disabled>분기를 선택해주세요</option>
          {quarterChoices.map((item) => <option key={item.slug} value={item.slug}>{item.label}{item.current ? " · Current" : ""}</option>)}
        </select>
        <p id="poll-quarter-note" className="form-note mt-3">{quarterLocked ? "이미 투표가 존재하는 Poll은 분기를 변경할 수 없습니다." : "등록된 분기 중에서 선택합니다. 투표가 등록되면 분기를 변경할 수 없습니다."}</p>
        <label htmlFor="poll-title">제목</label><input id="poll-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} />
        <label htmlFor="poll-description">설명</label><textarea id="poll-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
      </section>
      <section><h2>Poll Type</h2>
        <fieldset className="form-choices" disabled={quarterLocked}><legend className="sr-only">질문 유형</legend>
          <label><input type="radio" name="poll-type" checked={pollType === "choice"} onChange={() => setPollType("choice")} />객관식</label>
          <label><input type="radio" name="poll-type" checked={pollType === "text"} onChange={() => setPollType("text")} />주관식</label>
        </fieldset>
        {quarterLocked && <p className="form-note mt-4">응답이 있는 Poll은 유형·투표 방식·선택지를 변경할 수 없습니다.</p>}
      </section>
      {pollType === "choice" && <section><h2>Options</h2>
        {quarterLocked ? <><ol className="list-decimal pl-5">{options.map((label, index) => <li key={index} className="py-2">{label}</li>)}</ol></>
          : <><div className="grid gap-3">{options.map((label, index) => <div className="option-editor" key={index}>
            <label htmlFor={`poll-option-${index}`} className="sr-only">선택지 {index + 1}</label><span aria-hidden="true">{index + 1}.</span>
            <input id={`poll-option-${index}`} value={label} required maxLength={100} onChange={(event) => setOptions((current) => current.map((value, item) => item === index ? event.target.value : value))} />
            <button type="button" className="text-link" disabled={options.length <= 2} aria-label={`선택지 ${index + 1} 제거`} onClick={() => setOptions((current) => current.filter((_, item) => item !== index))}>제거</button>
          </div>)}</div><button type="button" className="text-link mt-5" disabled={options.length >= 20} onClick={() => setOptions((current) => [...current, ""])}>+ 선택지 추가</button></>}
      </section>}
      {pollType === "choice" ? <section><h2>Vote Settings</h2>
        <fieldset className="form-choices" disabled={quarterLocked}><legend className="sr-only">투표 방식</legend>
          <label><input type="radio" name="vote-mode" checked={mode === "single"} onChange={() => setMode("single")} />1인 1표</label>
          <label><input type="radio" name="vote-mode" checked={mode === "multiple"} onChange={() => setMode("multiple")} />중복 투표 가능</label>
        </fieldset>
        {mode === "single" && <label className="check-label"><input type="checkbox" checked={allowChange} onChange={(event) => setAllowChange(event.target.checked)} />투표 변경 허용</label>}
      </section> : <section><h2>Response Policy</h2><p className="mb-4">1인 1응답</p>
        <label className="check-label"><input type="checkbox" checked={allowChange} onChange={(event) => setAllowChange(event.target.checked)} />응답 수정 허용</label>
        <label htmlFor="text-max-length">최대 응답 글자 수</label><input id="text-max-length" type="number" min={10} max={5000} step={1} required value={textMaxLength} onChange={(event) => setTextMaxLength(Number(event.target.value))} />
        <p className="form-note mt-3">10~5000자. 기존 응답보다 짧게 줄일 수 없습니다.</p>
      </section>}
      <section><h2>Result Visibility</h2>
        <fieldset className="grid gap-4"><legend className="sr-only">결과 공개 시점</legend>
          <label className="check-label"><input type="radio" name="results-visibility" checked={visibility === "live"} onChange={() => setVisibility("live")} />실시간 공개</label>
          <p className="form-note">진행 중에도 결과와 주관식 응답을 볼 수 있습니다.</p>
          <label className="check-label"><input type="radio" name="results-visibility" checked={visibility === "after_close"} onChange={() => setVisibility("after_close")} />종료 후 공개</label>
          <p className="form-note">기간 만료 또는 수동 Close 후 공개합니다. 재개하면 다시 숨깁니다.</p>
        </fieldset>
      </section>
      <section><h2>Voting Period</h2><p className="form-note mb-5">날짜와 시간은 모두 한국 시간(Asia/Seoul)입니다.</p>
        <fieldset className="form-choices"><legend className="sr-only">투표 기간</legend>
          <label><input type="radio" name="period" checked={!scheduled} onChange={() => setScheduled(false)} />상시 투표</label>
          <label><input type="radio" name="period" checked={scheduled} onChange={() => setScheduled(true)} />기간 지정</label>
        </fieldset>
        {scheduled && <div className="date-fields">
          <div><label htmlFor="poll-start">시작 날짜 / 시간</label><input id="poll-start" type="datetime-local" required value={start} onChange={(event) => setStart(event.target.value)} /></div>
          <div><label htmlFor="poll-end">종료 날짜 / 시간</label><input id="poll-end" type="datetime-local" required value={end} onChange={(event) => setEnd(event.target.value)} /></div>
        </div>}
      </section>
      <section><h2>Visibility</h2><label className="check-label"><input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />일반 Polls 화면에서 숨기기</label></section>
      {error && <p className="form-error mb-5" role="alert">{error}</p>}
      <button type="submit" className="interaction-button">{pending ? "저장 중..." : initial ? "변경 저장" : "투표 만들기"}</button>
    </fieldset>
  </form>;
}
