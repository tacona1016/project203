import type { Comment } from "@/lib/supabase/types";

const formatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function CommentList({ comments }: { comments: Comment[] }) {
  if (!comments.length) return <p className="form-note py-8">아직 의견이 없습니다. 첫 의견을 남겨주세요.</p>;

  return (
    <ol className="comment-list" aria-label="댓글 목록, 최신순">
      {comments.map((comment) => (
        <li key={comment.id}>
          <article>
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="m-0! text-base!">{comment.participant_name}</h3>
              <time className="text-xs text-muted" dateTime={comment.created_at}>
                {formatter.format(new Date(comment.created_at))}
              </time>
            </header>
            <p className="mt-4 whitespace-pre-wrap wrap-anywhere">{comment.content}</p>
          </article>
        </li>
      ))}
    </ol>
  );
}
