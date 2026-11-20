"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PollData } from "@/lib/supabase/types";
import { fromSeoulInput, parsePollInput, toSeoulInput } from "@/lib/polls";
import { PollImageManager } from "./PollImageManager";
import Link from "next/link";
import { PollDraftImages } from "./PollDraftImages";
import { PollCreateFlow, type CreateProgress, type DraftImage, type DraftOption } from "@/lib/poll-images/create-flow";
import type { ChoiceLimit } from "@/lib/poll-choice-limit";

const subscribe = () => () => {};

export function PollEditor({ initial, quarterChoices }: { initial?: PollData; quarterChoices: readonly { slug: string; label: string; current: boolean }[] }) {
  const router = useRouter();
  // Do not allow the prerendered form to perform a native submission before hydration.
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  const poll = initial?.poll;
  const [quarter, setQuarter] = useState(poll?.quarter ?? quarterChoices.find((item) => item.current)?.slug ?? "");
  const quarterLocked = initial?.has_responses ?? (initial?.results?.total_votes ?? 0) > 0;
  const [pollType, setPollType] = useState(poll?.poll_type ?? "choice");
  const [visibility, setVisibility] = useState(poll?.results_visibility ?? "live");
  const [textMaxLength, setTextMaxLength] = useState(poll?.text_max_length ?? 1000);
  const [title, setTitle] = useState(poll?.title ?? "");
  const [description, setDescription] = useState(poll?.description ?? "");
  const [options, setOptions] = useState<DraftOption[]>(initial?.options.length ? initial.options.map(option => ({ clientKey: `saved-${option.id}`, label: option.label, image: null })) : [1, 2].map(n => ({ clientKey: `draft-${n}`, label: "", image: null })));
  const [questions, setQuestions] = useState<DraftImage[]>([]);
  const [creation, setCreation] = useState<CreateProgress | null>(null);
  const creator = useRef<PollCreateFlow | null>(null), objectUrls = useRef(new Set<string>()), allowLeave = useRef(false);
  const mounted = useRef(true);
  const [mode, setMode] = useState(poll?.vote_mode ?? "single");
  const [maxChoices, setMaxChoices] = useState<ChoiceLimit>(poll?.max_choices_per_participant ?? null);
  const appliedLimit = pollType === "choice" && mode === "multiple" ? maxChoices : null;
  const limitInvalid = appliedLimit !== null && appliedLimit > options.length;
  const [allowChange, setAllowChange] = useState(poll?.allow_vote_change ?? false);
  const [scheduled, setScheduled] = useState(!!(poll?.voting_starts_at || poll?.voting_ends_at));
  const [start, setStart] = useState(toSeoulInput(poll?.voting_starts_at ?? null));
  const [end, setEnd] = useState(toSeoulInput(poll?.voting_ends_at ?? null));
  const [hidden, setHidden] = useState(poll?.is_hidden ?? false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const submitting = useRef(false);
  const recovery = !initial && ready && !creation ? new URL(window.location.href).searchParams : null;
  const resume = recovery?.get("resume");
  const resumeSlug = resume && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resume) && resume.length <= 100 ? resume : null;
  const uncertainReload = recovery?.get("creation") === "uncertain";
  const creationLocked = !!creation?.slug || !!creation?.uncertain || !!resumeSlug || uncertainReload;
  const warnOnLeave = !initial && (!!title || questions.length > 0 || options.some(option => option.image) || pending || creationLocked);
  useEffect(() => { mounted.current = true; const urls = objectUrls.current; return () => { mounted.current = false; creator.current?.cancel(); for (const url of urls) URL.revokeObjectURL(url); urls.clear(); }; }, []);
  useEffect(() => {
    if (!warnOnLeave) return;
    const warn = (event: BeforeUnloadEvent) => { if (!allowLeave.current) { event.preventDefault(); event.returnValue = ""; } };
    const click = (event: MouseEvent) => {
      if (allowLeave.current || !(event.target instanceof Element) || !event.target.closest("a[href]") || event.defaultPrevented) return;
      if (!window.confirm("작성 중인 내용과 사진 초안이 사라질 수 있습니다. 생성된 투표는 삭제되지 않습니다. 이동할까요?")) { event.preventDefault(); event.stopPropagation(); }
    };
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const traverse = (event: Event) => {
      const next = event as Event & { navigationType?: string; destination?: { url: string } };
      if (allowLeave.current || !event.cancelable || next.navigationType !== "traverse" || next.destination?.url === window.location.href) return;
      if (window.confirm("이동하면 사진 초안이 사라집니다. 생성된 투표는 삭제되지 않습니다. 이동할까요?")) allowLeave.current = true;
      else event.preventDefault();
    };
    window.addEventListener("beforeunload", warn); navigation?.addEventListener("navigate", traverse); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", warn); navigation?.removeEventListener("navigate", traverse); document.removeEventListener("click", click, true); };
  }, [warnOnLeave]);
  function makeImage(file: File): DraftImage { const previewUrl = URL.createObjectURL(file); objectUrls.current.add(previewUrl); return { clientId: crypto.randomUUID(), file, previewUrl }; }
  function release(image: DraftImage | null) { if (image) { URL.revokeObjectURL(image.previewUrl); objectUrls.current.delete(image.previewUrl); } }
  function changeType(value: "choice" | "text") {
    if (value === "text" && options.some(option => option.image)) {
      if (!window.confirm("주관식으로 바꾸면 선택지 사진 초안이 제거됩니다. 계속할까요?")) return;
      options.forEach(option => release(option.image)); setOptions(current => current.map(option => ({ ...option, image: null })));
    }
    setPollType(value);
  }
  function marker(slug?: string) {
    const url = new URL(window.location.href); url.searchParams.delete("resume"); url.searchParams.delete("creation");
    if (slug) url.searchParams.set("resume", slug); else url.searchParams.set("creation", "uncertain");
    window.history.replaceState(null, "", url.pathname + url.search);
  }
  async function saveCreation(omitFailed = false) {
    if (!creator.current || submitting.current) return;
    submitting.current = true; setPending(true);
    await creator.current.save(omitFailed);
    if (!mounted.current) return;
    const result = creator.current.progress;
    if (result.completed) { allowLeave.current = true; router.push(`/admin/polls/${result.slug}?created=1`); router.refresh(); }
    else if (!result.slug && !result.uncertain) {
      creator.current = null; const url = new URL(window.location.href); url.searchParams.delete("creation"); window.history.replaceState(null, "", url.pathname + url.search);
    }
    submitting.current = false; setPending(false);
  }
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
    if (!ready || pending || submitting.current || creationLocked) return;
    setAttempted(true);
    if (limitInvalid) { setError(`최대 선택 개수는 현재 선택지 ${options.length}개를 넘을 수 없습니다.`); return; }
    const body = { quarter, title, description, options: quarterLocked ? [] : options.map(option => option.label),
      poll_type: pollType, results_visibility: visibility, text_max_length: pollType === "text" ? textMaxLength : poll?.text_max_length ?? 1000,
      vote_mode: pollType === "text" ? "single" : mode, max_choices_per_participant: appliedLimit, allow_vote_change: allowChange, scheduled, start, end, is_hidden: hidden };
    try { parsePollInput(body, !initial, quarterChoices); } catch (error) {
      setError((error as Error).message);
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (initial && !window.confirm("요약한 설정으로 투표를 수정할까요? 결과 공개 시점과 기간을 다시 확인해주세요.")) return;
    if (!initial) {
      setError("");
      creator.current = new PollCreateFlow({ body, questions: [...questions], options: pollType === "choice" ? options.map(option => ({ ...option })) : [], hidden }, value => { if (mounted.current) { setCreation(value); if (value.slug) marker(value.slug); } });
      marker(); await saveCreation(); return;
    }
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

  return <form onSubmit={submit} method="post" noValidate className="admin-form" aria-busy={!ready || pending}>
    <fieldset disabled={!ready || pending || creationLocked}>
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
      {initial ? <PollImageManager initial={initial} /> : <section><h2>질문 이미지</h2><p className="form-note">원본 JPG·PNG·WebP 장당 3MiB 이하. 투표 만들기를 누르면 자동 압축해 장당 500KB 이하로 저장합니다. 선택한 사진은 지금 서버에 업로드되지 않습니다.</p>
        <PollDraftImages images={questions} maximum={3} label="질문 이미지" onSelect={files => { const images = files.map(makeImage); setQuestions(current => [...current, ...images]); }} onRemove={id => { release(questions.find(image => image.clientId === id) ?? null); setQuestions(current => current.filter(image => image.clientId !== id)); }} onMove={(id, direction) => setQuestions(current => { const next = [...current], index = next.findIndex(image => image.clientId === id); if (index + direction < 0 || index + direction >= next.length) return current; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; })} />
      </section>}
      <section><h2>투표 유형</h2>
        <fieldset className="form-choices" disabled={quarterLocked}><legend className="sr-only">질문 유형</legend>
          <label><input type="radio" name="poll-type" checked={pollType === "choice"} onChange={() => changeType("choice")} />객관식</label>
          <label><input type="radio" name="poll-type" checked={pollType === "text"} onChange={() => changeType("text")} />주관식</label>
        </fieldset>
        {quarterLocked && <p className="form-note mt-4">응답이 있는 투표는 유형·투표 방식·선택지를 변경할 수 없습니다.</p>}
      </section>
      {pollType === "choice" && <section><h2>선택지</h2>
        {quarterLocked ? <><ol className="list-decimal pl-5">{options.map(option => <li key={option.clientKey} className="py-2">{option.label}</li>)}</ol></>
          : <><div className="grid gap-3">{options.map((option, index) => <div className="option-editor" key={option.clientKey} data-client-key={option.clientKey}>
            <label htmlFor={`poll-option-${index}`} className="sr-only">선택지 {index + 1}</label><span aria-hidden="true">{index + 1}.</span>
            <input id={`poll-option-${index}`} value={option.label} required aria-invalid={attempted && (!option.label.trim() || Array.from(option.label.trim()).length > 100)} aria-describedby={attempted && (!option.label.trim() || Array.from(option.label.trim()).length > 100) ? `poll-option-error-${index}` : undefined} onChange={event => setOptions(current => current.map(value => value.clientKey === option.clientKey ? { ...value, label: event.target.value } : value))} />
            <button type="button" className="text-link" disabled={options.length <= 2} aria-label={`선택지 ${index + 1} 제거`} onClick={() => { release(option.image); setOptions(current => current.filter(value => value.clientKey !== option.clientKey)); }}>제거</button>
            {attempted && (!option.label.trim() || Array.from(option.label.trim()).length > 100) && <p id={`poll-option-error-${index}`} className="form-error col-span-full">선택지를 1~100자로 입력해주세요.</p>}
            {!initial && <div className="col-span-full min-w-0"><PollDraftImages images={option.image ? [option.image] : []} maximum={1} label={`선택지 ${index + 1} 이미지`} onSelect={files => { const image = makeImage(files[0]); release(option.image); setOptions(current => current.map(value => value.clientKey === option.clientKey ? { ...value, image } : value)); }} onRemove={() => { release(option.image); setOptions(current => current.map(value => value.clientKey === option.clientKey ? { ...value, image: null } : value)); }} /></div>}
          </div>)}</div><button type="button" className="text-link mt-5" disabled={options.length >= 20} onClick={() => setOptions(current => [...current, { clientKey: crypto.randomUUID(), label: "", image: null }])}>+ 선택지 추가</button></>}
      </section>}
      {pollType === "choice" ? <section><h2>투표 설정</h2>
        <fieldset className="form-choices" disabled={quarterLocked}><legend className="sr-only">투표 방식</legend>
          <label><input type="radio" name="vote-mode" checked={mode === "single"} onChange={() => setMode("single")} />1인 1표</label>
          <label><input type="radio" name="vote-mode" checked={mode === "multiple"} onChange={() => setMode("multiple")} />복수선택 허용</label>
        </fieldset>
        {mode === "multiple" && <div>
          <label htmlFor="poll-max-choices">최대 선택 개수</label>
          <select id="poll-max-choices" value={maxChoices ?? ""} disabled={quarterLocked} aria-invalid={limitInvalid} aria-describedby="poll-max-choices-note" onChange={event => setMaxChoices(event.target.value === "" ? null : Number(event.target.value) as ChoiceLimit)}>
            <option value="">제한 없음</option>{[2, 3, 4, 5].map(limit => <option key={limit} value={limit}>최대 {limit}개</option>)}
          </select>
          <p id="poll-max-choices-note" className={limitInvalid ? "form-error mt-3" : "form-note mt-3"}>{quarterLocked ? "이미 참여 기록이 있어 최대 선택 개수를 변경할 수 없습니다." : limitInvalid ? `최대 선택 개수는 현재 선택지 ${options.length}개를 넘을 수 없습니다.` : "1개부터 설정한 개수까지 선택할 수 있습니다. 제한 없음은 모든 선택지를 허용합니다."}</p>
        </div>}
        <label className="check-label"><input type="checkbox" checked={allowChange} onChange={(event) => setAllowChange(event.target.checked)} />선택 변경 허용</label>
        {mode === "multiple" && <p className="form-note mt-3">여러 선택지를 한 번에 제출합니다. 변경을 허용하면 기존 선택 전체를 새 선택으로 바꿀 수 있습니다.</p>}
      </section> : <section><h2>응답 설정</h2><p className="mb-4">1인 1응답</p>
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
          {pollType === "choice" && mode === "multiple" && <div><dt>최대 선택 개수</dt><dd>{appliedLimit === null ? "제한 없음" : `최대 ${appliedLimit}개`}</dd></div>}
          <div><dt>{pollType === "text" ? "응답 수정" : "선택 변경"}</dt><dd>{allowChange ? "허용" : "허용하지 않음"}</dd></div>
          {pollType === "text" && <div><dt>최대 응답 길이</dt><dd>{textMaxLength}자</dd></div>}
          <div><dt>결과 공개</dt><dd>{visibility === "live" ? "진행 중에도 실시간 공개" : "투표 종료 후 공개"}</dd></div>
          <div><dt>투표 기간</dt><dd>{scheduled ? `${start ? start.replace("T", " ") : "시작 미입력"} ~ ${end ? end.replace("T", " ") : "종료 미입력"} (한국 시간)` : "상시 투표"}</dd></div>
          <div><dt>일반 목록</dt><dd>{hidden ? "숨김 · 관리자만 확인" : "표시"}</dd></div>
        </dl>
      </section>
      {error && <p className="form-error mb-5" role="alert">{error}</p>}
      <button type="submit" className="interaction-button" disabled={limitInvalid}>{pending ? "저장 중..." : initial ? "변경 저장" : "투표 만들기"}</button>
    </fieldset>
    {!initial && (creation || resumeSlug || uncertainReload) && <section className="interaction-notice mt-5" aria-label="투표 생성 진행" aria-live="polite">
      {creation && <><p role="status">{creation.stage}</p>{creation.slug && <p>✓ 투표 생성 완료 · 같은 투표에서 사진을 저장합니다.</p>}
        <p>질문 이미지 {creation.uploads.filter(item => item.optionId === null && item.ready).length}/{questions.length} 저장 · 선택지 이미지 {creation.uploads.filter(item => item.optionId !== null && item.ready).length}/{options.filter(option => option.image).length} 저장</p>
        {creation.uploads.filter(item => item.error).map(item => <p className="form-error" key={item.id}>{item.label} · {item.error}</p>)}
        {creation.error && <p className="form-error" role="alert">{creation.error}</p>}
        {creation.slug && !creation.completed && <div className="poll-image-actions"><button type="button" className="interaction-button" disabled={pending} onClick={() => void saveCreation()}>실패한 이미지 재시도 / 저장 상태 확인</button>
          <button type="button" className="text-link" disabled={pending} onClick={() => { if (window.confirm("미완료 사진을 제외하고 현재 저장된 사진만으로 완료할까요? 원래 공개 설정이 적용되며 생성된 투표·사진은 삭제되지 않습니다.")) void saveCreation(true); }}>저장된 이미지만으로 완료</button>
          <Link className="text-link" href={`/admin/polls/${creation.slug}/edit`}>생성된 투표 관리로 이동</Link></div>}</>}
      {!creation && <p>새로고침으로 사진 초안이 사라졌습니다. {resumeSlug ? "이미 생성된 투표에서 사진을 다시 선택해주세요." : "생성 응답이 불확실합니다. 관리자 목록에서 생성 여부를 먼저 확인해주세요."} 새 투표는 자동으로 만들지 않습니다.</p>}
      {(creation?.uncertain || uncertainReload) && <Link className="text-link" href="/admin/polls">관리자 목록에서 생성 여부 확인</Link>}
      {resumeSlug && <Link className="text-link" href={`/admin/polls/${resumeSlug}/edit`}>생성된 투표에서 이어서 등록</Link>}
    </section>}
  </form>;
}
