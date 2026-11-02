import Link from "next/link";
import { contentLinks, validContentLinks } from "@/data/content-links";
import { quarters, isPresentationPublished, getQuarterLabel } from "@/data/quarters";
import { requireAccessSession } from "@/lib/auth/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function RelatedContent({ quarter, pollSlug }: { quarter?: string; pollSlug?: string }) {
  await requireAccessSession();
  const groups = validContentLinks(contentLinks, quarters).filter(group => quarter ? group.quarter === quarter : !!pollSlug && group.pollSlugs.includes(pollSlug));
  if (!groups.length) return null;
  const client = getSupabaseAdminClient();
  if (!client) return <p className="form-note">관련 자료를 불러오지 못했습니다.</p>;
  const pollIds = [...new Set(groups.flatMap(group => group.pollSlugs))].filter(slug => slug !== pollSlug);
  const postIds = [...new Set(groups.flatMap(group => group.decisionPostIds))];
  const result = await Promise.all([
      pollIds.length ? client.from("polls").select("slug,title").in("slug", pollIds).eq("is_hidden", false).retry(false) : { data: [], error: null },
      postIds.length ? client.from("board_posts").select("id,title").in("id", postIds).eq("post_type", "notice").is("deleted_at", null).retry(false) : { data: [], error: null },
    ]).then(([polls, notices]) => polls.error || notices.error ? null : { polls: polls.data ?? [], notices: notices.data ?? [] }).catch(() => null);
    if (!result) return <p className="form-note mt-8">관련 자료를 불러오지 못했습니다. 잠시 후 다시 확인해주세요.</p>;
    const { polls, notices } = result;
    const presentations = pollSlug ? quarters.filter(item => groups.some(group => group.quarter === item.slug) && isPresentationPublished(item.slug)) : [];
    if (!polls.length && !notices.length && !presentations.length) return null;
    return <aside className="related-content" aria-label="연결된 논의와 결정">
      <h2 className="text-lg font-medium">함께 볼 자료</h2>
      <p className="form-note mt-2">투표 결과와 최종 결정은 별개입니다. 아래는 직접 등록하고 확인한 자료입니다.</p>
      <ul className="mt-5 grid gap-4">
        {presentations.map(item => <li key={item.slug}><Link className="text-link" href={`/quarter/${item.slug}`}>발표 · {getQuarterLabel(item)} →</Link></li>)}
        {polls.map(item => <li key={item.slug}><Link className="text-link" href={`/polls/${item.slug}`}>투표 · {item.title} →</Link></li>)}
        {notices.map(item => <li key={item.id}><Link className="text-link" href={`/board/${item.id}`}>결정 공지 · {item.title} →</Link></li>)}
      </ul>
    </aside>;
}
