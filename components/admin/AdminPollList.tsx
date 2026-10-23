"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PollSummary } from "@/lib/supabase/types";
import { PollMeta } from "@/components/polls/PollMeta";

export function AdminPollList({ items }: { items: PollSummary[] }) {
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function change(slug: string, action: string) {
    if (pending) return;
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
    finally { setPending(""); }
  }
  return <div>
    <p role="status" className="form-feedback">{pending ? "저장 중..." : message}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!items.length && <p className="interaction-notice">등록된 투표가 없습니다.</p>}
    {items.map((item) => <article className="poll-card" key={item.poll.id}>
      <h2 className="mb-5 text-xl font-medium">{item.poll.title}</h2><PollMeta poll={item.poll} status={item.status} />
      {item.results && <p className="form-note mt-5">참여자 {item.results.participant_count}명 · 총 {item.results.total_votes}{item.poll.poll_type === "text" ? "응답" : "표"}</p>}
      {item.status === "CLOSED" && !item.poll.is_closed && <p className="form-note mt-3">기간이 종료되었습니다. 다시 진행하려면 종료일을 수정하세요.</p>}
      <div className="admin-actions">
        <Link href={`/admin/polls/${item.poll.slug}`} className="text-link">View</Link>
        <Link href={`/admin/polls/${item.poll.slug}/edit`} className="text-link">Edit</Link>
        <button type="button" className="text-link" disabled={!!pending} onClick={() => change(item.poll.slug, item.poll.is_closed ? "reopen" : "close")}>{item.poll.is_closed ? "Reopen" : "Close"}</button>
        <button type="button" className="text-link" disabled={!!pending} onClick={() => change(item.poll.slug, item.poll.is_hidden ? "unhide" : "hide")}>{item.poll.is_hidden ? "Unhide" : "Hide"}</button>
      </div>
    </article>)}
  </div>;
}
