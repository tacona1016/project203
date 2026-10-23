import type { TextResponse } from "@/lib/supabase/types";
import { formatKoreanDate } from "@/lib/polls";

export function TextResponses({ responses }: { responses: TextResponse[] }) {
  return <section className="text-responses min-w-0" aria-label="주관식 응답 결과">
    <h3 className="text-lg font-medium">응답 {responses.length}개</h3>
    {!responses.length && <p className="form-note mt-6">아직 제출된 응답이 없습니다.</p>}
    <ol className="mt-7 divide-y divide-line">
      {responses.map((response) => <li key={response.id} className="min-w-0 py-6 first:pt-0">
        <p className="font-medium">{response.participant_name}</p>
        <p className="mt-4 whitespace-pre-wrap leading-8 wrap-anywhere">{response.text_response}</p>
        <p className="mt-4 text-xs text-muted"><time dateTime={response.created_at}>{formatKoreanDate(response.created_at)}</time>
          {response.updated_at !== response.created_at && <span> · 수정 {formatKoreanDate(response.updated_at)}</span>}
        </p>
      </li>)}
    </ol>
  </section>;
}
