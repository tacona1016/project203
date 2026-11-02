"use client";

<<<<<<< HEAD
import { useState, useSyncExternalStore, type FormEvent } from "react";
=======
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
>>>>>>> e9843ed (.)
import { useRouter } from "next/navigation";
import type { PollData } from "@/lib/supabase/types";
import { fromSeoulInput, parsePollInput, toSeoulInput } from "@/lib/polls";

const subscribe = () => () => {};

const subscribe = () => () => {};

export function PollEditor({ initial, quarterChoices }: { initial?: PollData; quarterChoices: readonly { slug: string; label: string; current: boolean }[] }) {
  const router = useRouter();
  // Do not allow the prerendered form to perform a native submission before hydration.
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
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
  const [attempted, setAttempted] = useState(false);
  const submitting = useRef(false);
  const titleInvalid = attempted && (!title.trim() || Array.from(title.trim()).length > 160);
  const descriptionInvalid = attempted && Array.from(description.trim()).length > 2000;
  const quarterInvalid = attempted && !quarterChoices.some(item => item.slug === quarter);
  const textLengthInvalid = attempted && pollType === "text" && (!Number.isInteger(textMaxLength) || textMaxLength < 10 || textMaxLength > 5000);
  let periodInvalid = false;
  if (attempted && scheduled) {
    try { const starts = fromSeoulInput(start), ends = fromSeoulInput(end); periodInvalid = !starts || !ends || ends <= starts; }
    catch { periodInvalid = true; }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
<<<<<<< HEAD
    if (!ready || pending) return;
=======
    if (!ready || pending || submitting.current) return;
    setAttempted(true);
>>>>>>> e9843ed (.)
    const body = { quarter, title, description, options: quarterLocked ? [] : options,
      poll_type: pollType, results_visibility: visibility, text_max_length: pollType === "text" ? textMaxLength : poll?.text_max_length ?? 1000,
      vote_mode: pollType === "text" ? "single" : mode, allow_vote_change: allowChange, scheduled, start, end, is_hidden: hidden };
    try { parsePollInput(body, !initial, quarterChoices); } catch (error) {
      setError((error as Error).message);
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (initial && !window.confirm("요약한 설정으로 투표를 수정할까요? 결과 공개 시점과 기간을 다시 확인해주세요.")) return;
    submitting.current = true; setPending(true); setError("");
    try {
      const response = await fetch(initial ? `/api/admin/polls/${poll!.slug}` : "/api/admin/polls", {
        method: initial ? "PATCH" : "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (response.status === 401 || response.status === 403) { router.push("/admin"); router.refresh(); return; }
      if (!response.ok) throw new Error(result.error || "저장하지 못했습니다. 다시 시도해주세요.");
      router.push(`/admin/polls/${result.slug}`); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "저장하지 못했습니다."); submitting.current = false; setPending(false); }
  }

<<<<<<< HEAD
  return <form onSubmit={submit} method="post" className="admin-form" aria-busy={!ready || pending}>
=======
  return <form onSubmit={submit} method="post" noValidate className="admin-form" aria-busy={!ready || pending}>
>>>>>>> e9843ed (.)
    <fieldset disabled={!ready || pending}>
      <legend className="sr-only">투표 설정</legend>
      <section><h2>기본 정보</h2>
        <label htmlFor="poll-quarter">분기 *</label>
        <select id="poll-quarter" value={quarter} required disabled={quarterLocked} aria-invalid={quarterInvalid} aria-describedby="poll-quarter-note" onChange={(event) => setQuarter(event.target.value)}>
          <option value="" disabled>분기를 선택해주세요</option>
          {quarterChoices.map((item) => <option key={item.slug} value={item.slug}>{item.label}{item.current ? " · 현재 분기" : ""}</option>)}
        </select>
        <p id="poll-quarter-note" className="form-note mt-3">{quarterLocked ? "이미 응답이 있는 투표는 분기를 변경할 수 없습니다." : "등록된 분기 중에서 선택합니다. 응답이 등록되면 분기를 변경할 수 없습니다."}</p>
        {quarterInvalid && <p className="form-error mt-3">등록된 분기를 선택해주세요.</p>}
        <label htmlFor="poll-title">제목</label><input id="poll-title" value={title} onChange={(event) => setTitle(event.target.value)} required aria-invalid={titleInvalid} aria-describedby={titleInvalid ? "poll-title-error" : undefined} />
        {titleInvalid && <p id="poll-title-error" className="form-error mt-3">제목을 1~160자로 입력해주세요.</p>}
        <label htmlFor="poll-description">설명</label><textarea id="poll-description" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} aria-invalid={descriptionInvalid} aria-describedby={descriptionInvalid ? "poll-description-error" : undefined} />
        {descriptionInvalid && <p id="poll-description-error" className="form-error mt-3">설명은 2,000자 이내로 입력해주세요.</p>}
      </section>
      <section><h2>투표 유형</h2>
        <fieldset className="form-choices" disabled={quarterLocked}><legend className="sr-only">질문 유형</legend>
          <label><input type="radio" name="poll-type" checked={pollType === "choice"} onChange={() => setPollType("choice")} />객관식</label>
          <label><input type="radio" name="poll-type" checked={pollType === "text"} onChange={() => setPollType("text")} />주관식</label>
        </fieldset>
        {quarterLocked && <p className="form-note mt-4">응답이 있는 투표는 유형·투표 방식·선택지를 변경할 수 없습니다.</p>}
      </section>
      {pollType === "choice" && <section><h2>선택지</h2>
        {quarterLocked ? <><ol className="list-decimal pl-5">{options.map((label, index) => <li key={index} className="py-2">{label}</li>)}</ol></>
          : <><div className="grid gap-3">{options.map((label, index) => <div className="option-editor" key={index}>
            <label htmlFor={`poll-option-${index}`} className="sr-only">선택지 {index + 1}</label><span aria-hidden="true">{index + 1}.</span>
            <input id={`poll-option-${index}`} value={label} required aria-invalid={attempted && (!label.trim() || Array.from(label.trim()).length > 100)} aria-describedby={attempted && (!label.trim() || Array.from(label.trim()).length > 100) ? `poll-option-error-${index}` : undefined} onChange={(event) => setOptions((current) => current.map((value, item) => item === index ? event.target.value : value))} />
            <button type="button" className="text-link" disabled={options.length <= 2} aria-label={`선택지 ${index + 1} 제거`} onClick={() => setOptions((current) => current.filter((_, item) => item !== index))}>제거</button>
            {attempted && (!label.trim() || Array.from(label.trim()).length > 100) && <p id={`poll-option-error-${index}`} className="form-error col-span-full">선택지를 1~100자로 입력해주세요.</p>}
          </div>)}</div><button type="button" className="text-link mt-5" disabled={options.length >= 20} onClick={() => setOptions((current) => [...current, ""])}>+ 선택지 추가</button></>}
      </section>}
      {pollType === "choice" ? <section><h2>투표 설정</h2>
        <fieldset className="form-choices" disabled={quarterLocked}><legend className="sr-only">투표 방식</legend>
          <label><input type="radio" name="vote-mode" checked={mode === "single"} onChange={() => setMode("single")} />1인 1표</label>
          <label><input type="radio" name="vote-mode" checked={mode === "multiple"} onChange={() => setMode("multiple")} />복수선택 허용</label>
        </fieldset>
        <label className="check-label"><input type="checkbox" checked={allowChange} onChange={(event) => setAllowChange(event.target.checked)} />선택 변경 허용</label>
        {mode === "multiple" && <p className="form-note mt-3">여러 선택지를 한 번에 제출합니다. 변경을 허용하면 기존 선택 전체를 새 선택으로 바꿀 수 있습니다.</p>}
<<<<<<< HEAD
      </section> : <section><h2>Response Policy</h2><p className="mb-4">1인 1응답</p>
=======
      </section> : <section><h2>응답 설정</h2><p className="mb-4">1인 1응답</p>
>>>>>>> e9843ed (.)
        <label className="check-label"><input type="checkbox" checked={allowChange} onChange={(event) => setAllowChange(event.target.checked)} />응답 수정 허용</label>
        <label htmlFor="text-max-length">최대 응답 글자 수</label><input id="text-max-length" type="number" min={10} max={5000} step={1} required value={textMaxLength} aria-invalid={textLengthInvalid} aria-describedby={textLengthInvalid ? "text-max-length-error" : undefined} onChange={(event) => setTextMaxLength(Number(event.target.value))} />
        {textLengthInvalid && <p id="text-max-length-error" className="form-error mt-3">10~5,000자 사이의 정수로 입력해주세요.</p>}
        <p className="form-note mt-3">10~5000자. 기존 응답보다 짧게 줄일 수 없습니다.</p>
      </section>}
      <section><h2>결과 공개 설정</h2>
        <fieldset className="grid gap-4"><legend className="sr-only">결과 공개 시점</legend>
          <label className="check-label"><input type="radio" name="results-visibility" checked={visibility === "live"} onChange={() => setVisibility("live")} />실시간 공개</label>
          <p className="form-note">진행 중에도 결과와 주관식 응답을 볼 수 있습니다.</p>
          <label className="check-label"><input type="radio" name="results-visibility" checked={visibility === "after_close"} onChange={() => setVisibility("after_close")} />종료 후 공개</label>
          <p className="form-note">기간 만료 또는 관리자 수동 종료 후 공개합니다. 다시 진행 중으로 열면 결과를 숨깁니다.</p>
        </fieldset>
      </section>
      <section><h2>투표 기간</h2><p className="form-note mb-5">날짜와 시간은 모두 한국 시간(Asia/Seoul)입니다.</p>
        <fieldset className="form-choices"><legend className="sr-only">투표 기간</legend>
          <label><input type="radio" name="period" checked={!scheduled} onChange={() => setScheduled(false)} />상시 투표</label>
          <label><input type="radio" name="period" checked={scheduled} onChange={() => setScheduled(true)} />기간 지정</label>
        </fieldset>
        {scheduled && <div className="date-fields">
          <div><label htmlFor="poll-start">시작 날짜 / 시간</label><input id="poll-start" type="datetime-local" required value={start} aria-invalid={periodInvalid} aria-describedby={periodInvalid ? "poll-period-error" : undefined} onChange={(event) => setStart(event.target.value)} /></div>
          <div><label htmlFor="poll-end">종료 날짜 / 시간</label><input id="poll-end" type="datetime-local" required value={end} aria-invalid={periodInvalid} aria-describedby={periodInvalid ? "poll-period-error" : undefined} onChange={(event) => setEnd(event.target.value)} /></div>
          {periodInvalid && <p id="poll-period-error" className="form-error col-span-full">시작과 종료를 입력하고, 종료가 시작보다 늦은지 확인해주세요.</p>}
        </div>}
      </section>
      <section><h2>표시 설정</h2><label className="check-label"><input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />일반 투표 목록에서 숨기기</label></section>
      <section className="admin-setting-summary" aria-labelledby="poll-summary-title">
        <h2 id="poll-summary-title">저장 전 확인</h2>
        <p className="form-note mb-5">아래 설정을 확인한 뒤 저장해주세요. 변경 사항은 저장 버튼을 눌러야 반영됩니다.</p>
        <dl>
          <div><dt>분기</dt><dd>{quarterChoices.find((item) => item.slug === quarter)?.label ?? "분기를 선택해주세요"}</dd></div>
          <div><dt>유형</dt><dd>{pollType === "choice" ? "객관식" : "주관식"}</dd></div>
          <div><dt>참여 방식</dt><dd>{pollType === "text" ? "1인 1응답" : mode === "multiple" ? "복수선택 · 선택지당 1표" : "단일선택 · 1인 1표"}</dd></div>
          <div><dt>{pollType === "text" ? "응답 수정" : "선택 변경"}</dt><dd>{allowChange ? "허용" : "허용하지 않음"}</dd></div>
          {pollType === "text" && <div><dt>최대 응답 길이</dt><dd>{textMaxLength}자</dd></div>}
          <div><dt>결과 공개</dt><dd>{visibility === "live" ? "진행 중에도 실시간 공개" : "투표 종료 후 공개"}</dd></div>
          <div><dt>투표 기간</dt><dd>{scheduled ? `${start ? start.replace("T", " ") : "시작 미입력"} ~ ${end ? end.replace("T", " ") : "종료 미입력"} (한국 시간)` : "상시 투표"}</dd></div>
          <div><dt>일반 목록</dt><dd>{hidden ? "숨김 · 관리자만 확인" : "표시"}</dd></div>
        </dl>
      </section>
      {error && <p className="form-error mb-5" role="alert">{error}</p>}
      <button type="submit" className="interaction-button">{pending ? "저장 중..." : initial ? "변경 저장" : "투표 만들기"}</button>
    </fieldset>
  </form>;
}
