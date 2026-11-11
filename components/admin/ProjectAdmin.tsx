"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fromSeoulInput, toSeoulInput, formatKoreanDate } from "@/lib/polls";
import { parseProjectCommand, type ProjectAdminState, type ProjectEntry, type ProjectKind } from "@/lib/project/model";

type Save = (command: Record<string, unknown>) => Promise<void>;
const str = (v: unknown) => typeof v === "string" ? v : "";
const labels = { status: "프로젝트 현황", event: "공동 일정", decision: "결정사항", history: "변경 이력" };

export function ProjectAdmin({ initial }: { initial: ProjectAdminState }) {
  const [state, setState] = useState(initial), [tab, setTab] = useState<keyof typeof labels>("status");
  const [selected, setSelected] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [note, setNote] = useState(""), [error, setError] = useState(""), [nonce, setNonce] = useState(0);
  const inFlight = useRef(false), router = useRouter();
  async function load() {
    const r = await fetch("/api/admin/project", { cache: "no-store" });
    if (!r.ok) throw Error("최신 정보를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.");
    setState(await r.json());
  }
  const save: Save = async body => {
    if (inFlight.current) return;
    try { parseProjectCommand(body); } catch (e) { setError(e instanceof Error ? e.message : "입력 내용을 확인해주세요."); return; }
    inFlight.current = true; setBusy(true); setError(""); setNote("");
    try {
      const r = await fetch("/api/admin/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "저장하지 못했습니다.");
      if (!Number.isSafeInteger(data.version) || !data.key) throw Error("저장 여부를 확인하지 못했습니다. 최신 정보를 조회해주세요.");
      setNote("저장되었습니다. HOME의 다음 조회부터 반영됩니다.");
      try { await load(); router.refresh(); } catch { setNote("저장은 완료됐지만 최신 목록을 불러오지 못했습니다. 새로 불러오기를 눌러주세요."); }
    } catch (e) { setError(e instanceof Error ? e.message : "저장 여부를 확인하지 못했습니다. 최신 정보를 조회한 뒤 다시 시도해주세요."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const entry = state.entries.find(e => e.kind === tab && (tab === "status" || e.key === selected));
  function choose(next: keyof typeof labels, key: string | null = null) { setTab(next); setSelected(key); setNote(""); setError(""); setNonce(v => v + 1); }
  return <div className="project-admin">
    <nav className="project-admin-tabs" aria-label="프로젝트 관리">{Object.entries(labels).map(([key, label]) => <button key={key} type="button" disabled={busy} aria-pressed={tab === key} onClick={() => choose(key as keyof typeof labels)}>{label}</button>)}</nav>
    {!state.configured && <p className="interaction-notice" role="status">관리 DB가 아직 적용되지 않았습니다. 기존 HOME은 파일 설정으로 유지됩니다. 검토된 SQL의 TEST 검증과 운영 적용 승인 후 편집할 수 있습니다.</p>}
    {note && <p className="form-feedback" role="status">{note}</p>}{error && <p className="interaction-error" role="alert">{error}</p>}
    {busy && <p className="form-note" role="status">저장 중...</p>}
    <button type="button" className="text-link mb-4" disabled={busy} onClick={() => { setError(""); void load().catch(e => setError(e.message)); }}>최신 정보 불러오기</button>
    {tab !== "history" && <>
      {tab !== "status" && <div className="project-entry-list"><button type="button" className="secondary-link" disabled={busy} onClick={() => choose(tab)}>+ {tab === "event" ? "일정 추가" : "확정 공지 등록"}</button>
        {state.entries.filter(e => e.kind === tab).map(e => <button key={e.key} type="button" disabled={busy} aria-pressed={selected === e.key} onClick={() => choose(tab, e.key)}>
          <span>{tab === "event" ? str(e.data?.title) : state.notices.find(n => n.id === e.key)?.title ?? `공지 #${e.key}`}</span>
          <small>{e.deleted_at ? "삭제됨·복구 가능" : e.superseded_by ? "후속 결정으로 대체" : e.is_visible ? "표시" : "숨김·취소"} · v{e.version}</small>
        </button>)}
      </div>}
      <EntryForm key={`${tab}:${selected}:${entry?.version ?? 0}:${nonce}`} kind={tab} entry={entry} state={state} disabled={busy || !state.configured} save={save} cancel={() => setNonce(v => v + 1)} />
    </>}
    {tab === "history" && <section><h2 className="text-lg font-medium mb-3">변경 이력</h2><p className="form-note mb-4">복원도 새 변경 기록으로 남습니다. 기존 글·투표·결정을 삭제하지 않습니다.</p>
      {!state.revisions.length && <p className="interaction-notice">아직 변경 기록이 없습니다.</p>}
      {state.revisions.map(r => <details key={r.id} className="project-revision"><summary>{labels[r.kind]} · {r.key} · {formatKoreanDate(r.created_at)}</summary>
        <pre>{JSON.stringify({ before: r.before_data?.data, after: r.after_data.data, relatedPolls: r.after_data.related_poll_slugs, visible: r.after_data.is_visible, deleted: !!r.after_data.deleted_at }, null, 2)}</pre>
        <button type="button" className="secondary-link" disabled={busy || !state.configured} onClick={() => {
          if (confirm("이 시점의 내용으로 복원할까요? 현재 내용과 복원 이력을 모두 보존합니다.")) void save({ kind: r.kind, action: "restore", id: r.key, version: state.entries.find(e => e.kind === r.kind && e.key === r.key)?.version ?? 0, historyId: r.id });
        }}>이 내용으로 복원</button>
      </details>)}
    </section>}
    <p className="form-note mt-5"><Link href="/admin" className="text-link">투표 관리로 →</Link> · <Link href="/board/new?type=notice" className="text-link">공지 작성 →</Link></p>
  </div>;
}

function EntryForm({ kind, entry, state, disabled, save, cancel }: { kind: ProjectKind; entry?: ProjectEntry; state: ProjectAdminState; disabled: boolean; save: Save; cancel: () => void }) {
  const d = entry?.data ?? {}, [error, setError] = useState("");
  const [phase, setPhase] = useState(str(d.phase)), [goal, setGoal] = useState(str(d.goal));
  const [next, setNext] = useState(str(d.nextAction)), [date, setDate] = useState(str(d.updatedAt));
  const [links, setLinks] = useState(((d.relatedLinks ?? []) as { label: string; href: string }[]).map(l => `${l.label} | ${l.href}`).join("\n"));
  const [title, setTitle] = useState(str(d.title)), [start, setStart] = useState(toSeoulInput(str(d.startsAt) || null));
  const [location, setLocation] = useState(str(d.location)), [description, setDescription] = useState(str(d.description)), [href, setHref] = useState(str(d.href));
  const [post, setPost] = useState(entry?.key ?? ""), [decided, setDecided] = useState(str(d.decidedOn));
  const [polls, setPolls] = useState(entry?.related_poll_slugs ?? []), [visible, setVisible] = useState(entry?.is_visible ?? true);
  const [successor, setSuccessor] = useState(entry?.superseded_by ?? ""), [query, setQuery] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    try {
      const data = kind === "status" ? { phase, goal, nextAction: next, updatedAt: date, relatedLinks: links.split("\n").filter(Boolean).map(line => { const [label, ...path] = line.split("|"); return { label: label.trim(), href: path.join("|").trim() }; }) }
        : kind === "event" ? { title, startsAt: fromSeoulInput(start), location, description, href, isVisible: visible }
        : { decidedOn: decided || null, relatedPollSlugs: polls, isVisible: visible, supersededBy: successor || null };
      const command = { kind, action: "save", id: kind === "decision" ? post : entry?.key ?? null, version: entry?.version ?? 0, data };
      parseProjectCommand(command); await save(command);
    } catch (e) { setError(e instanceof Error ? e.message : "입력 내용을 확인해주세요."); }
  }
  return <form className="admin-form project-admin-form" onSubmit={submit}><fieldset disabled={disabled}>
    <h2 className="text-lg font-medium">{labels[kind]}</h2>
    {kind === "status" ? <>
      <label htmlFor="project-phase">현재 단계</label><input id="project-phase" required maxLength={120} value={phase} onChange={e => setPhase(e.target.value)} />
      <label htmlFor="project-goal">현재 논의 목표</label><textarea id="project-goal" rows={2} maxLength={1000} value={goal} onChange={e => setGoal(e.target.value)} />
      <label htmlFor="project-next">다음 행동</label><textarea id="project-next" rows={2} required maxLength={1000} value={next} onChange={e => setNext(e.target.value)} />
      <label htmlFor="project-date">확인된 기준일</label><input id="project-date" type="date" required value={date} onChange={e => setDate(e.target.value)} />
      <label htmlFor="project-links">관련 내부 링크 (최대4개)</label><p className="form-note">한 줄에 이름 | /polls/실제-slug 또는 /board/공지번호 형식으로 입력합니다.</p><textarea id="project-links" rows={3} value={links} onChange={e => setLinks(e.target.value)} />
    </> : kind === "event" ? <>
      <label htmlFor="project-event-title">일정 제목</label><input id="project-event-title" required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} />
      <label htmlFor="project-event-start">날짜·시간 (Asia/Seoul)</label><input id="project-event-start" type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} />
      <label htmlFor="project-event-place">장소</label><input id="project-event-place" maxLength={240} value={location} onChange={e => setLocation(e.target.value)} />
      <label htmlFor="project-event-description">설명</label><textarea id="project-event-description" rows={3} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} />
      <label htmlFor="project-event-link">관련 내부 페이지</label><input id="project-event-link" value={href} onChange={e => setHref(e.target.value)} />
    </> : <>
      <label htmlFor="decision-search">공지 검색</label><input id="decision-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="최근 공지 목록에서 제목 검색" />
      <label htmlFor="decision-post">실제로 확정된 공지</label><select id="decision-post" required disabled={!!entry} value={post} onChange={e => setPost(e.target.value)}><option value="">공지 선택</option>{state.notices.filter(n => n.title.includes(query) || n.id === post).map(n => <option key={n.id} value={n.id}>{n.title}</option>)}</select>
      {entry && !state.notices.some(n => n.id === post) && <p className="form-note">원문이 삭제되었거나 공지 유형이 아닙니다. HOME에 표시되지 않으며 원문 복구 후 관리할 수 있습니다.</p>}
      <label htmlFor="decision-date">확인된 결정일 (미정이면 비워두기)</label><input id="decision-date" type="date" value={decided} onChange={e => setDecided(e.target.value)} />
      {post && <Link className="text-link" href={`/board/${post}`}>원문 공지 확인 →</Link>}
      <fieldset className="project-poll-options"><legend>관련 투표</legend>{state.polls.map(p => <label key={p.slug}><input type="checkbox" checked={polls.includes(p.slug)} onChange={e => setPolls(prev => e.target.checked ? [...prev, p.slug] : prev.filter(s => s !== p.slug))} />{p.title}{p.is_hidden ? " (숨김 — HOME 링크 미표시)" : ""}</label>)}</fieldset>
      <label htmlFor="decision-successor">후속 결정으로 대체</label><select id="decision-successor" value={successor} onChange={e => setSuccessor(e.target.value)}><option value="">현재 유효한 결정</option>{state.entries.filter(e => e.kind === "decision" && e.key !== post).map(e => <option key={e.key} value={e.key}>{state.notices.find(n => n.id === e.key)?.title ?? `공지 #${e.key}`}</option>)}</select>
      <p className="form-note">투표 종료와 최종 결정은 별개입니다. 먼저 후속 공지를 등록한 뒤 연결해주세요.</p>
    </>}
    {kind !== "status" && <label className="project-visible"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />HOME에 표시 {kind === "event" ? "(해제하면 취소·숨김)" : ""}</label>}
    {entry?.deleted_at && <p className="interaction-notice">삭제된 일정입니다. 저장하면 새 변경 이력을 남기고 복구합니다.</p>}
    {error && <p className="interaction-error" role="alert">{error}</p>}
    <div className="admin-actions"><button type="submit" className="interaction-button">저장</button><button type="button" className="text-link" onClick={cancel}>변경 취소</button>
      {kind === "status" && <button type="button" className="text-link" onClick={() => { if (confirm("현황을 비우고 기존 미정 안내를 표시할까요? 변경 이력은 보존합니다.")) void save({ kind, action: "save", id: "current", version: entry?.version ?? 0, data: null }); }}>현황 비우기</button>}
      {kind === "event" && entry && !entry.deleted_at && <button type="button" className="text-link button-danger" onClick={() => { if (confirm("이 일정을 삭제할까요? 기록과 복원 이력은 보존합니다.")) void save({ kind, action: "delete", id: entry.key, version: entry.version }); }}>일정 삭제</button>}
    </div>
  </fieldset></form>;
}
