"use client";
import { useRef, useState } from "react";
import type { PollData } from "@/lib/supabase/types";
import { type PollImage, type PollImageSet } from "@/lib/poll-images/model";
import { pollImageRequest as request, sendPollImage } from "@/lib/poll-images/client";
import { PollImageGallery } from "@/components/polls/PollImageGallery";

type Upload = { id: string; file: File; optionId: string | null; replacesId: string | null; error: string };
export function PollImageManager({ initial }: { initial: PollData }) {
  const slug = initial.poll.slug, base = `/api/admin/polls/${slug}/images`;
  const [state, setState] = useState<PollImageSet>(initial.attachments ?? { available: false, images: [] });
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [failed, setFailed] = useState<Upload[]>([]);
  const lock = useRef(false);
  async function reload() { const next = await request<PollImageSet>(base); setState(next); if (next.error) throw new Error(next.error); return next; }
  async function run(action: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "사진 처리를 확인하지 못했습니다."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function upload(items: Upload[]) {
    const failures: Upload[] = [];
    // At most one in-flight encode/upload, even for 20 option images.
    for (const item of items) {
      try {
        setMessage(`${item.file.name} · 사진 압축 및 업로드 중`);
        const saved = await sendPollImage(slug, item);
        await reload(); setMessage(`사진 업로드 완료 · ${Math.ceil(saved.byte_size / 1000)}KB`);
      } catch (error) { failures.push({ ...item, error: error instanceof Error ? error.message : "사진 저장 실패" }); }
    }
    setFailed(previous => [...previous.filter(item => !items.some(next => next.id === item.id)), ...failures]);
    if (failures.length) setMessage("일부 사진을 확인하지 못했습니다. 기존 투표·응답·사진은 유지됩니다. 재시도 전 목록을 확인해주세요. 처리 중 요청은 2분 뒤 재시도할 수 있습니다.");
  }
  function choose(files: FileList | null, optionId: string | null, replacesId: string | null = null) {
    if (!files?.length) return;
    const count = state.images.filter(image => image.option_id === null).length;
    const max = optionId || replacesId ? 1 : 3 - count;
    if (files.length > max) { setMessage(optionId ? "선택지당 사진은 1장입니다." : "질문 사진은 최대 3장입니다."); return; }
    void run(() => upload(Array.from(files).map(file => ({ id: crypto.randomUUID(), file, optionId, replacesId, error: "" }))));
  }
  function input(optionId: string | null, replacesId: string | null, label: string, disabled = false) {
    return <label className="poll-image-file">{label}<input type="file" aria-label={label} accept="image/jpeg,image/png,image/webp" multiple={!optionId && !replacesId} disabled={busy || !state.available || !!state.error || disabled} onChange={event => { choose(event.target.files, optionId, replacesId); event.target.value = ""; }} /></label>;
  }
  function imageControls(image: PollImage, index: number, questions: PollImage[]) {
    return <div key={image.id} className="poll-image-admin-item"><PollImageGallery slug={slug} images={[image]} label={image.option_id === null ? `질문 사진 ${index + 1}` : "선택지 사진"} />
      <p className="form-note">{Math.ceil(image.byte_size / 1000)}KB · {image.width}×{image.height}</p>
      <div className="poll-image-actions">{input(image.option_id === null ? null : String(image.option_id), image.id, "사진 교체")}
        <button type="button" className="text-link" disabled={busy} onClick={() => { if (window.confirm("이 사진을 삭제할까요? 투표와 응답은 유지됩니다.")) void run(async () => { await request(`${base}/${image.id}`, { method: "DELETE" }); await reload(); setMessage("사진을 삭제했습니다."); }); }}>사진 삭제</button>
        {image.option_id === null && <><button type="button" className="text-link" disabled={busy || index === 0} onClick={() => move(questions, index, -1)}>앞으로</button><button type="button" className="text-link" disabled={busy || index === questions.length - 1} onClick={() => move(questions, index, 1)}>뒤로</button></>}
      </div></div>;
  }
  function move(images: PollImage[], index: number, direction: number) {
    const ids = images.map(image => image.id); [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    void run(async () => { setState(await request<PollImageSet>(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) })); setMessage("사진 순서를 저장했습니다."); });
  }
  const questions = state.images.filter(image => image.option_id === null);
  return <section className="poll-image-admin" aria-label="투표 이미지 관리" aria-busy={busy}>
    <h2>질문 이미지 · {questions.length}/3</h2>
    <p className="form-note">JPG·PNG·WebP 원본 장당 3MiB 이하. 자동 WebP 압축 후 장당 500KB 이하로 저장합니다. 사진은 즉시 반영되며 아래 투표 설정 저장과 별개입니다.</p>
    {!state.available && <p className="interaction-notice">투표 이미지 DB·비공개 저장소 적용 후 사용할 수 있습니다. 기존 투표는 그대로 이용할 수 있습니다.</p>}
    {state.error && <p role="alert" className="form-error">{state.error}</p>}
    <div className="poll-image-admin-grid">{questions.map((image, index) => imageControls(image, index, questions))}</div>
    {input(null, null, "질문 사진 추가", questions.length >= 3)}
    {initial.poll.poll_type === "choice" && <><h3 className="mt-5">선택지 이미지</h3><p className="form-note">저장된 선택지 ID에 연결합니다. 선택지 문구·순서를 바꾸려면 사진을 먼저 삭제하고 투표 설정을 저장한 뒤 이 화면을 다시 여세요. 응답이 있는 선택지도 사진은 관리할 수 있습니다.</p>
      {initial.options.map(option => { const image = state.images.find(item => item.option_id !== null && String(item.option_id) === String(option.id)); return <div className="poll-image-option-admin" data-option-id={option.id} key={option.id}><h4>{option.label}</h4>{image ? imageControls(image, 0, []) : input(String(option.id), null, `${option.label} 사진 첨부`)}</div>; })}</>}
    {message && <p className="interaction-notice" role="status">{message}</p>}
    {failed.map(item => <div key={item.id} className="form-error" role="alert"><p>{item.file.name} · {item.error}</p><button type="button" className="text-link" disabled={busy} onClick={() => void run(() => upload([item]))}>같은 사진 재시도</button><button type="button" className="text-link ml-4" disabled={busy} onClick={() => setFailed(current => current.filter(value => value.id !== item.id))}>선택 제거</button></div>)}
    <div className="poll-image-actions"><button type="button" className="text-link" disabled={busy} onClick={() => void run(async () => { await reload(); setMessage("사진 목록을 확인했습니다."); })}>사진 상태 확인</button>
      {state.available && <button type="button" className="text-link" disabled={busy} onClick={() => void run(async () => { const value = await request<{ cleaned: number }>(`${base}/cleanup`, { method: "POST" }); await reload(); setMessage(`중단된 사진 ${value.cleaned}건을 정리했습니다. 5분 이상 경과한 대기·삭제 항목만 대상입니다.`); })}>중단된 업로드 정리</button>}</div>
  </section>;
}
