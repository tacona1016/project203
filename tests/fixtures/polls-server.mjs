import http from "node:http";
import { randomUUID } from "node:crypto";
let people, polls, options, votes, comments, sequence;
const now = () => new Date().toISOString();
function reset() {
  people = Array.from({ length: 10 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, display_name: `친구${i + 1}`, is_active: true, display_order: i + 1, created_at: now() }));
  polls = []; options = []; votes = []; comments = []; sequence = 100;
  const slugs = ["land-priority", "changeable", "repeat", "upcoming", "closed", "hidden", "current-poll", "text-live", "text-private", "text-fixed", "choice-private"];
  slugs.forEach((slug, i) => {
    const id = i + 1, text = slug.startsWith("text-");
    polls.push({ id, slug, quarter: i === 6 ? "2027-q1" : "2026-q4", title: ["우선순위", "변경 가능 투표", "중복 투표", "예정 투표", "종료 투표", "숨긴 투표", "Current poll", "공개 의견", "종료 후 공개 의견", "수정 불가 의견", "비공개 집계"][i], description: "함께 검토할 기준입니다.", poll_type: text ? "text" : "choice", results_visibility: i >= 8 ? "after_close" : "live", text_max_length: 1000, vote_mode: i === 2 ? "multiple" : "single", allow_repeat_vote: i === 2, allow_vote_change: i === 1 || i === 8, is_closed: false, is_hidden: i === 5, created_at: now(), updated_at: now(), voting_starts_at: i === 3 ? new Date(Date.now() + 86400000).toISOString() : i === 4 ? new Date(Date.now() - 172800000).toISOString() : null, voting_ends_at: i === 3 ? new Date(Date.now() + 172800000).toISOString() : i === 4 ? new Date(Date.now() - 86400000).toISOString() : null });
    if (!text) ["접근성", "환경"].forEach((label, j) => options.push({ id: id * 100 + j + 1, poll_id: id, label, display_order: j + 1 }));
  });
  votes.push({ id: 1, poll_id: 1, option_id: 101, text_response: null, participant_id: people[0].id, created_at: now(), updated_at: now() });
}
reset();
const status = p => p.is_hidden ? "HIDDEN" : p.is_closed || (p.voting_ends_at && new Date(p.voting_ends_at) <= new Date()) ? "CLOSED" : p.voting_starts_at && new Date(p.voting_starts_at) > new Date() ? "UPCOMING" : "ACTIVE";
function results(id) { const rows = votes.filter(v => v.poll_id === Number(id)), counts = {}; rows.filter(v => v.option_id != null).forEach(v => counts[v.option_id] = (counts[v.option_id] || 0) + 1); return { counts, total_votes: rows.length, participant_count: new Set(rows.map(v => v.participant_id)).size }; }
const canSee = (p, admin) => admin || p.results_visibility === "live" || status(p) === "CLOSED";
const summary = (p, admin) => ({ poll: p, status: status(p), results: canSee(p, admin) ? results(p.id) : null, server_time: now() });
const detail = (p, admin) => !p || p.is_hidden && !admin ? null : ({ ...summary(p, admin), options: p.poll_type === "choice" ? options.filter(o => o.poll_id === p.id) : [], responses: p.poll_type === "text" && canSee(p, admin) ? votes.filter(v => v.poll_id === p.id).map(v => ({ ...v, participant_name: people.find(person => person.id === v.participant_id).display_name })) : null });
http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const json = (value, code = 200) => res.writeHead(code).end(JSON.stringify(value));
  const fail = code => json({ code, message: "fixture validation rejected" }, 400);
  const url = new URL(req.url, "http://127.0.0.1:3102"); let body = {};
  if (req.method === "POST") { const chunks = []; for await (const chunk of req) chunks.push(chunk); body = JSON.parse(Buffer.concat(chunks).toString() || "{}"); }
  if (url.pathname === "/_test") { if (body.reset) reset(); if(body.changeParticipant) Object.assign(people.find(p=>p.id===body.changeParticipant.id),body.changeParticipant); if (body.changePoll) Object.assign(polls.find(p => p.slug === body.changePoll.slug), body.changePoll); return json({ participants: people, polls, options, votes, comments }); }
  if (req.headers.apikey !== "fixture-only-backend-key") return json({ message: "server only" }, 403);
  const table = url.pathname.replace("/rest/v1/", "");
  const match = row => [...url.searchParams].every(([key, value]) => !value.startsWith("eq.") || String(row[key]) === value.slice(3));
  const single = rows => req.headers.accept?.includes("vnd.pgrst.object") ? rows[0] : rows;
  const joined = c => ({ ...c, participant: { id: c.participant_id, display_name: people.find(p => p.id === c.participant_id)?.display_name } });
  if (req.method === "GET") {
    if (table === "participants") { const fields=url.searchParams.get("select"); const rows=people.filter(match).map(p=>fields&&fields!=="*"?Object.fromEntries(fields.split(",").map(k=>[k,p[k]])):p); return json(single(rows)); }
    if (table === "polls") return json(single(polls.filter(match)));
    if (table === "poll_options") return json(options.filter(match));
    if (table === "votes") { const rows = votes.filter(match); res.setHeader("Content-Range", `0-${Math.max(rows.length - 1, 0)}/${rows.length}`); return json(rows.slice(0, Number(url.searchParams.get("limit") || rows.length))); }
    if (table === "comments") return json(comments.filter(match).map(joined));
  }
  if (table === "rpc/get_poll_catalog") return json(polls.filter(p => (!body.p_slug || p.slug === body.p_slug) && (body.p_include_hidden || !p.is_hidden)).map(p => summary(p, body.p_include_hidden)).reverse());
  if (table === "rpc/get_poll_detail") return json(detail(polls.find(p => p.slug === body.p_slug), body.p_admin));
  if (table === "rpc/get_poll_results") return json(results(body.p_poll_id));
  if (table === "rpc/submit_vote" || table === "rpc/submit_text_response") {
    const p = polls.find(p => p.id === Number(body.p_poll_id)), text = table.endsWith("submit_text_response"); let s = "success";
    const response = body.p_text_response?.trim();
    if (!p || p.is_hidden) s = "poll_not_found";
    else if ((p.poll_type === "text") !== text) s = "invalid_poll_type";
    else if (!people.some(person => person.id === body.p_participant_id && person.is_active)) s = "inactive_participant";
    else if (status(p) === "CLOSED") s = "poll_closed";
    else if (status(p) === "UPCOMING") s = "poll_upcoming";
    else if (text && !response) s = "invalid_response";
    else if (text && Array.from(response).length > p.text_max_length) s = "response_too_long";
    else if (!text && !options.some(o => o.poll_id === p.id && o.id === Number(body.p_option_id))) s = "invalid_option";
    else {
      const previous = votes.filter(v => v.poll_id === p.id && v.participant_id === body.p_participant_id);
      if ((text || p.vote_mode === "single") && previous.length) {
        if (!p.allow_vote_change) s = "already_voted";
        else if (previous.length > 1) s = "legacy_votes_conflict";
        else if (text ? previous[0].text_response === response : previous[0].option_id === Number(body.p_option_id)) s = "unchanged";
        else { Object.assign(previous[0], text ? { text_response: response } : { option_id: Number(body.p_option_id) }, { updated_at: now() }); s = "vote_changed"; }
      } else { const stamp = now(); votes.push({ id: ++sequence, poll_id: p.id, participant_id: body.p_participant_id, option_id: text ? null : Number(body.p_option_id), text_response: text ? response : null, created_at: stamp, updated_at: stamp }); }
    }
    return json({ status: s });
  }
  if (table === "rpc/admin_create_poll") {
    const d = body.p_data, id = ++sequence, slug = "poll-" + randomUUID();
    if (d.poll_type === "choice" && d.options.length < 2) return fail("22023");
    polls.push({ id, slug, ...d, allow_repeat_vote: d.vote_mode === "multiple", is_closed: false, created_at: now(), updated_at: now() });
    if (d.poll_type === "choice") d.options.forEach((label, i) => options.push({ id: ++sequence, poll_id: id, label, display_order: i + 1 }));
    return json({ slug });
  }
  if (table === "rpc/admin_update_poll") {
    const p = polls.find(p => p.id === Number(body.p_poll_id)), d = body.p_data, previous = votes.filter(v => v.poll_id === p.id), voted = previous.length > 0;
    if (voted && p.quarter !== d.quarter) return fail("P2031");
    if (voted && (p.poll_type !== d.poll_type || p.vote_mode !== d.vote_mode)) return fail("P2032");
    if (previous.some(v => v.text_response && Array.from(v.text_response).length > d.text_max_length)) return fail("P2033");
    const labels = options.filter(o => o.poll_id === p.id).map(o => o.label);
    if (voted && d.options.length && JSON.stringify(labels) !== JSON.stringify(d.options)) return fail("P2032");
    if (!voted && d.poll_type === "choice" && d.options.length < 2) return fail("22023");
    if (!voted && (p.poll_type !== d.poll_type || d.poll_type === "choice" && JSON.stringify(labels) !== JSON.stringify(d.options))) {
      options = options.filter(o => o.poll_id !== p.id);
      if (d.poll_type === "choice") d.options.forEach((label, i) => options.push({ id: ++sequence, poll_id: p.id, label, display_order: i + 1 }));
    }
    const values = Object.fromEntries(Object.entries(d).filter(([key]) => key !== "options")); Object.assign(p, values, { updated_at: now() }); return json({ slug: p.slug });
  }
  if (table === "rpc/admin_set_poll_state") {
    const p = polls.find(p => p.id === Number(body.p_poll_id));
    if (body.p_action === "close") p.is_closed = true; if (body.p_action === "reopen") p.is_closed = false;
    if (body.p_action === "hide") p.is_hidden = true; if (body.p_action === "unhide") p.is_hidden = false;
    return json({ slug: p.slug });
  }
  if (table === "comments") { const row = { id: ++sequence, ...body, created_at: now() }; comments.unshift(row); return json(joined(row), 201); }
  return json({ message: "unsupported fixture call", table }, 404);
}).listen(3102, "127.0.0.1", () => console.log("Poll types protocol fixture ready; production is not used."));
