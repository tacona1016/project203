import type { PollData } from "../supabase/types.ts";
import { type PollImage } from "./model.ts";
import { listPollImages, pollImageRequest, PollRequestError, sendPollImage, validatePollImageFile } from "./client.ts";

export type DraftImage = { clientId: string; file: File; previewUrl: string };
export type DraftOption = { clientKey: string; label: string; image: DraftImage | null };
export type CreatePlan = { body: Record<string, unknown>; questions: DraftImage[]; options: DraftOption[]; hidden: boolean };
export type CreateUpload = { id: string; file: File; optionId: string | null; replacesId: null; label: string; ready: boolean; error: string };
export type CreateProgress = { stage: string; slug: string | null; uncertain: boolean; completed: boolean; uploads: CreateUpload[]; error: string };

export function mapCreatedOptions(options: DraftOption[], data: PollData): Map<string, string> {
  const saved = [...data.options].sort((a, b) => a.display_order - b.display_order);
  if (saved.length !== options.length || new Set(options.map(item => item.clientKey)).size !== options.length || new Set(saved.map(item => String(item.id))).size !== saved.length || saved.some((item, index) => item.display_order !== index + 1 || item.label !== options[index].label.trim() || String(item.poll_id) !== String(data.poll.id))) throw new Error("생성된 선택지의 개수·순서·ID가 예상과 다릅니다. 이미지를 연결하지 않았습니다. 생성된 투표 관리에서 확인해주세요.");
  return new Map(options.map((option, index) => [option.clientKey, String(saved[index].id)]));
}
const api = {
  create: (body: Record<string, unknown>) => pollImageRequest<{ slug: string }>("/api/admin/polls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  detail: (slug: string) => pollImageRequest<PollData>(`/api/admin/polls/${slug}`),
  list: listPollImages, upload: sendPollImage,
  state: (slug: string, action: "hide" | "unhide") => pollImageRequest(`/api/admin/polls/${slug}/state`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }),
  order: (slug: string, ids: string[]) => pollImageRequest(`/api/admin/polls/${slug}/images`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }),
};
export class PollCreateFlow {
  progress: CreateProgress = { stage: "입력 확인", slug: null, uncertain: false, completed: false, uploads: [], error: "" };
  private busy = false;
  private attempted = false;
  private boundIds: string | null = null;
  private cancelled = false;
  private plan: CreatePlan;
  private notify: (value: CreateProgress) => void;
  private services: typeof api;
  constructor(plan: CreatePlan, notify: (value: CreateProgress) => void, services = api) { this.plan = plan; this.notify = notify; this.services = services; }
  cancel() { this.cancelled = true; }
  private active() { if (this.cancelled) throw new Error("저장 화면을 벗어났습니다. 관리자 목록에서 생성된 투표를 확인해주세요."); }
  private update() { this.notify({ ...this.progress, uploads: this.progress.uploads.map(item => ({ ...item })) }); }
  private bind(data: PollData) {
    if (data.poll.slug !== this.progress.slug || data.poll.poll_type !== this.plan.body.poll_type) throw new Error("생성된 투표를 확인하지 못했습니다. 투표 관리에서 확인해주세요.");
    const options = data.poll.poll_type === "choice" ? mapCreatedOptions(this.plan.options, data) : new Map<string, string>();
    const fingerprint = JSON.stringify([String(data.poll.id), [...options]]);
    if (this.boundIds !== null && fingerprint !== this.boundIds) throw new Error("생성 후 선택지가 변경되었습니다. 이미지 연결을 중단했습니다. 투표 관리에서 확인해주세요.");
    this.boundIds = fingerprint;
    if (!this.progress.uploads.length) this.progress.uploads = [
      ...this.plan.questions.map((image, index) => ({ id: image.clientId, file: image.file, optionId: null, replacesId: null, label: `질문 사진 ${index + 1}`, ready: false, error: "" })),
      ...this.plan.options.filter(option => option.image).map(option => ({ id: option.image!.clientId, file: option.image!.file, optionId: options.get(option.clientKey)!, replacesId: null, label: `${option.label} 사진`, ready: false, error: "" })),
    ];
  }
  private confirm(images: PollImage[], data: PollData) {
    for (const item of this.progress.uploads) {
      const image = images.find(image => image.id === item.id);
      item.ready = !!image && String(image.poll_id) === String(data.poll.id) && String(image.option_id) === String(item.optionId) && image.byte_size > 0 && image.byte_size <= 500_000;
      if (item.ready) item.error = "";
    }
    this.update();
  }
  async save(omitFailed = false) {
    if (this.busy || this.progress.uncertain || this.progress.completed) return;
    this.busy = true; this.progress.error = ""; this.update();
    const hasImages = this.plan.questions.length > 0 || this.plan.options.some(option => option.image);
    try {
      this.active();
      if (!this.progress.slug) {
        if (this.attempted) return;
        const images = [...this.plan.questions, ...this.plan.options.flatMap(option => option.image ? [option.image] : [])];
        if (this.plan.questions.length > 3 || this.plan.options.length > 20 || new Set(images.map(image => image.clientId)).size !== images.length) throw new Error("사진 개수와 선택지 연결을 확인해주세요.");
        images.forEach(image => validatePollImageFile(image.file));
        this.attempted = true; this.progress.stage = "투표 생성 중"; this.update();
        try {
          const created = await this.services.create({ ...this.plan.body, is_hidden: hasImages || this.plan.hidden });
          if (typeof created?.slug !== "string" || created.slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(created.slug)) throw new Error("생성 응답을 확인하지 못했습니다.");
          this.progress.slug = created.slug; this.progress.stage = "투표 생성 완료"; this.update();
        } catch (error) {
          // Only explicit validation/auth rejections are known not to create.
          if (!(error instanceof PollRequestError) || ![400, 401, 403, 422].includes(error.status ?? 0)) {
            this.progress.uncertain = true;
            throw new Error("투표 생성 응답을 확인하지 못했습니다. 중복 생성을 막기 위해 다시 전송하지 않습니다. 관리자 목록에서 생성 여부를 먼저 확인해주세요.");
          }
          this.attempted = false; throw error;
        }
      }
      const slug = this.progress.slug;
      this.active();
      if (!hasImages) { this.progress.completed = true; this.progress.stage = "투표 생성 완료 · 사진 0개"; return; }
      this.progress.stage = "선택지 ID 및 저장 상태 확인"; this.update();
      let detail = await this.services.detail(slug); this.bind(detail);
      this.confirm(await this.services.list(slug), detail);
      const pending = this.progress.uploads.filter(item => !item.ready);
      if (pending.length && !detail.poll.is_hidden) {
        await this.services.state(slug, "hide"); detail = await this.services.detail(slug); this.bind(detail);
        if (!detail.poll.is_hidden) throw new Error("임시 숨김을 확인하지 못했습니다. 업로드를 중단했습니다.");
      }
      if (!omitFailed) for (const item of pending) {
        this.active();
        this.progress.stage = `${item.label} 압축 및 업로드 중`; this.update();
        try { await this.services.upload(slug, item); item.ready = true; item.error = ""; }
        catch (error) { item.error = error instanceof Error ? error.message : "사진 저장을 확인하지 못했습니다."; }
        this.update();
      }
      this.progress.stage = "최종 이미지 저장 확인"; this.update();
      this.active();
      const images = await this.services.list(slug); this.confirm(images, detail);
      if (!omitFailed && this.progress.uploads.some(item => !item.ready)) throw new Error("투표는 생성됐으며 숨김 상태를 유지합니다. 실패한 사진만 재시도하거나 생성된 투표 관리에서 이어서 등록해주세요.");
      if (!omitFailed && this.plan.questions.length) {
        const ids = this.plan.questions.map(image => image.clientId);
        const actual = images.filter(image => image.option_id === null);
        if (actual.length !== ids.length || actual.some(image => !ids.includes(image.id))) throw new Error("질문 사진 구성이 변경되었습니다. 숨김 상태에서 투표 관리로 확인해주세요.");
        await this.services.order(slug, ids);
      }
      this.progress.stage = this.plan.hidden ? "숨김 유지 확인" : "이미지 확인 완료 · 투표 공개 중"; this.update();
      this.active();
      try { await this.services.state(slug, this.plan.hidden ? "hide" : "unhide"); }
      catch { /* A lost state-change ACK must be checked, never assumed failed. */ }
      const final = await this.services.detail(slug); this.bind(final);
      if (final.poll.is_hidden !== this.plan.hidden) throw new Error("최종 공개 상태를 확인하지 못했습니다. 같은 투표에서 상태 확인을 재시도해주세요.");
      if (!omitFailed) {
        this.confirm(await this.services.list(slug), final);
        if (this.progress.uploads.some(item => !item.ready)) {
          await this.services.state(slug, "hide");
          throw new Error("최종 확인 중 사진 구성이 바뀌어 숨김으로 되돌렸습니다. 투표 관리에서 확인해주세요.");
        }
      }
      this.progress.completed = true; this.progress.stage = `투표 생성 완료 · 사진 ${this.progress.uploads.filter(item => item.ready).length}개 저장${omitFailed ? " · 미완료 사진 제외" : ""}`;
    } catch (error) { this.progress.error = error instanceof Error ? error.message : "저장을 확인하지 못했습니다. 상태를 확인해주세요."; }
    finally { this.busy = false; this.update(); }
  }
}
