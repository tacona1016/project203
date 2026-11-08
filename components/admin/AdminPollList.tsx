"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { PollSummary } from "@/lib/supabase/types";
import { PollMeta } from "@/components/polls/PollMeta";

export function AdminPollList({ items }: { items: PollSummary[] }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const changing = useRef(false);
  async function change(slug: string, action: string) {
    if (pending || changing.current) return;
    const confirmation: Record<string, string> = {
      close: "투표를 종료할까요? 종료 후 공개 설정인 결과는 즉시 공개됩니다.",
      reopen: "투표를 재개할까요? 기간이 유효하면 참여할 수 있고 종료 후 공개 결과는 다시 숨겨집니다.",
      hide: "일반 투표 목록에서 숨길까요? 기록과 결과는 삭제되지 않습니다.",
    };
    if (confirmation[action] && !window.confirm(confirmation[action])) return;
    changing.current = true;
    setPending(slug); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/polls/${slug}/state`, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const result = await response.json();
      if (response.status === 401 || response.status === 403) { router.push("/admin"); router.refresh(); return; }
      if (!response.ok) throw new Error(result.error || "변경하지 못했습니다.");
      const target = items.find((item) => item.poll.slug === slug);
      const expired = target?.poll.voting_ends_at && new Date(target.poll.voting_ends_at) <= new Date(target.server_time);
      setMessage(action === "reopen" && expired ? "수동 종료를 해제했습니다. 기간이 만료되어 종료 상태는 유지됩니다. 종료일을 수정해주세요." : "투표 상태를 변경했습니다.");
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "변경하지 못했습니다."); }
    finally { changing.current = false; setPending(""); }
  }
  return <div>
    <p role="status" className="form-feedback">{pending ? "저장 중..." : message}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!items.length && <p className="interaction-notice">등록된 투표가 없습니다.</p>}
    {items.map((item) => <article className="poll-card" key={item.poll.id}>
      <h2 className="mb-3 text-lg font-medium">{item.poll.title}</h2><PollMeta poll={item.poll} status={item.status} />
      {item.results && <p className="form-note mt-5">참여자 {item.results.participant_count}명 · {item.poll.poll_type === "choice" && item.poll.vote_mode === "multiple" ? `총 선택 ${item.results.total_votes}개` : `총 ${item.results.total_votes}${item.poll.poll_type === "text" ? "응답" : "표"}`}</p>}
      {item.status === "CLOSED" && !item.poll.is_closed && <p className="form-note mt-3">기간이 종료되었습니다. 다시 진행하려면 종료일을 수정하세요.</p>}
      <div className="admin-actions">
        <Link href={`/admin/polls/${item.poll.slug}`} className="text-link">상세 보기</Link>
        <Link href={`/admin/polls/${item.poll.slug}/edit`} className="text-link">수정</Link>
        <button type="button" className="text-link" disabled={!!pending} onClick={() => change(item.poll.slug, item.poll.is_closed ? "reopen" : "close")}>{item.poll.is_closed ? "재개" : "종료"}</button>
        <button type="button" className="text-link" disabled={!!pending} onClick={() => change(item.poll.slug, item.poll.is_hidden ? "unhide" : "hide")}>{item.poll.is_hidden ? "표시" : "숨김"}</button>
      </div>
    </article>)}
  </div>;
}
