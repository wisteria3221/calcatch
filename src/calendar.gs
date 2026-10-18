/**
 * Google カレンダーの読み書き（Calendar API の高度なサービスを使用）。
 *
 * 必要な権限を絞るため、CalendarApp ではなく Calendar API を使う。
 *   calendar.calendarlist.readonly … カレンダー一覧と、メインカレンダーのタイムゾーンの取得
 *   calendar.events.owned          … 自分が所有するカレンダーの予定の読み取りと作成
 */

// 既存予定との照合に使うタイトル類似度のしきい値（0〜1）
const SAME_TITLE_THRESHOLD = 0.8;     // ほぼ同じタイトル
const SIMILAR_TITLE_THRESHOLD = 0.5;  // 似ているタイトル

let calendarTimeZoneMemo_ = null;

/** メインカレンダーのタイムゾーン（例: Asia/Tokyo） */
function getCalendarTimeZone_() {
  if (!calendarTimeZoneMemo_) {
    const primary = Calendar.CalendarList.get('primary');
    calendarTimeZoneMemo_ = (primary && primary.timeZone) || Session.getScriptTimeZone();
  }
  return calendarTimeZoneMemo_;
}

/** 自分が所有するカレンダーの ID 一覧 */
function getOwnedCalendarIds_() {
  const res = Calendar.CalendarList.list({ minAccessRole: 'owner', maxResults: 250 });
  const ids = (res.items || []).map((c) => c.id);
  return ids.length ? ids : ['primary'];
}

/** 指定した期間にある予定を、照合しやすい形で返す（ページを順にたどってすべて取得する） */
function listEvents_(calendarId, rangeStart, rangeEnd, tz) {
  const items = [];
  let pageToken;
  do {
    const res = Calendar.Events.list(calendarId, {
      timeMin: rangeStart.toISOString(),
      timeMax: rangeEnd.toISOString(),
      singleEvents: true,
      showDeleted: false,
      maxResults: 250,
      pageToken: pageToken,
    });
    Array.prototype.push.apply(items, res.items || []);
    pageToken = res.nextPageToken;
  } while (pageToken);
  return items
    .filter((e) => e.status !== 'cancelled' && e.start && e.end)
    .map((e) => {
      const allDay = !!e.start.date;
      return {
        title: e.summary || '',
        description: e.description || '',
        allDay: allDay,
        start: allDay ? Utilities.parseDate(e.start.date, tz, 'yyyy-MM-dd') : new Date(e.start.dateTime),
        end: allDay ? Utilities.parseDate(e.end.date, tz, 'yyyy-MM-dd') : new Date(e.end.dateTime),
      };
    });
}

/**
 * 予定をメインカレンダーに登録し、登録した予定の URL を返す。
 * 説明欄の最後に、元のメールへのリンクを付ける。
 */
function createCalendarEvent_(ev, tz, mailLink) {
  const description = [ev.description, '', `${t_('originalEmail')}: ${mailLink}`].join('\n').trim();
  const resource = {
    summary: ev.title,
    location: ev.location || undefined,
    description: description,
  };
  if (ev.allDay) {
    resource.start = { date: Utilities.formatDate(new Date(ev.start), tz, 'yyyy-MM-dd') };
    resource.end = { date: Utilities.formatDate(new Date(ev.end), tz, 'yyyy-MM-dd') };
  } else {
    resource.start = { dateTime: ev.start, timeZone: tz };
    resource.end = { dateTime: ev.end, timeZone: tz };
  }
  const created = Calendar.Events.insert(resource, 'primary');
  return created.htmlLink || '';
}

// ---------------------------------------------------------------------------
// 既存予定との照合
// ---------------------------------------------------------------------------

/**
 * 抽出した各予定について、所有するカレンダーに同じ・似た予定があるかを調べ、
 * 見つかった場合は ev.existing に { level, title, start, end, allDay } を付ける。
 *   level: 'same'    … 登録済みの可能性が高い
 *          'similar' … 似た予定がある
 */
function annotateExistingEvents_(events, tz, threadId) {
  if (events.length === 0) return;
  // 予定の開始日の 0 時から、終了日の翌日 0 時までを検索範囲にする。
  // API の呼び出しを減らすため、全予定をまとめた範囲でカレンダーごとに 1 回だけ取得し、照合は手元で行う
  const ranges = events.map((ev) => {
    const start = new Date(ev.start);
    const end = new Date(ev.end);
    return {
      start: start,
      end: end,
      searchStart: startOfDay_(start, tz),
      searchEnd: ev.allDay ? end : addDays_(end, 1, tz),
    };
  });
  const rangeStart = new Date(Math.min.apply(null, ranges.map((r) => r.searchStart.getTime())));
  const rangeEnd = new Date(Math.max.apply(null, ranges.map((r) => r.searchEnd.getTime())));

  let existing = [];
  getOwnedCalendarIds_().forEach((calendarId) => {
    existing = existing.concat(listEvents_(calendarId, rangeStart, rangeEnd, tz));
  });

  events.forEach((ev, i) => {
    const { start, end, searchStart, searchEnd } = ranges[i];
    let best = null;
    existing.forEach((e) => {
      // まとめて取得した範囲のうち、この予定の検索範囲にかかるものだけを照合する
      if (e.end <= searchStart || e.start >= searchEnd) return;
      const match = classifyExisting_(ev, start, end, e, threadId);
      if (!match) return;
      const score = (match.level === 'same' ? 10 : 0) + match.similarity;
      if (!best || score > best.score) {
        best = {
          score: score,
          level: match.level,
          title: e.title,
          allDay: e.allDay,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
        };
      }
    });

    if (best) {
      delete best.score;
      ev.existing = best;
    }
  });
}

/** 既存の予定 e が、抽出した予定 ev と同じ／似ているかを判定する。該当しなければ null */
function classifyExisting_(ev, start, end, e, threadId) {
  const similarity = titleSimilarity_(ev.title, e.title);
  const eStart = e.start.getTime();
  const eEnd = e.end.getTime();
  const overlaps = eStart < end.getTime() && eEnd > start.getTime();
  const sameTime = ev.allDay === e.allDay && eStart === start.getTime() && eEnd === end.getTime();
  // このアドオンが同じメールから登録した予定（説明欄に元メールのリンクがある）
  const fromSameMail = !!threadId && e.description.indexOf(threadId) !== -1;

  if ((fromSameMail && overlaps) ||
      (similarity >= SAME_TITLE_THRESHOLD && overlaps) ||
      (sameTime && similarity >= SIMILAR_TITLE_THRESHOLD)) {
    return { level: 'same', similarity: similarity };
  }
  if ((similarity >= SIMILAR_TITLE_THRESHOLD && overlaps) ||
      similarity >= SAME_TITLE_THRESHOLD) {
    return { level: 'similar', similarity: similarity };
  }
  return null;
}

/**
 * タイトルの類似度（0〜1）。全角半角・大文字小文字・記号・空白の違いを無視し、
 * 2 文字ずつの組（バイグラム）の重なり具合（Dice 係数）で測る。
 */
function titleSimilarity_(a, b) {
  const na = normalizeTitle_(a);
  const nb = normalizeTitle_(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // 片方がもう片方を丸ごと含む場合（例：「定例会議」と「第3回 定例会議」）
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 4 && longer.indexOf(shorter) !== -1) return 0.9;
  if (na.length < 2 || nb.length < 2) return 0;

  const bigrams = (s) => {
    const map = {};
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      map[g] = (map[g] || 0) + 1;
    }
    return map;
  };
  const ga = bigrams(na);
  const gb = bigrams(nb);
  let common = 0;
  Object.keys(ga).forEach((g) => {
    if (gb[g]) common += Math.min(ga[g], gb[g]);
  });
  return (2 * common) / ((na.length - 1) + (nb.length - 1));
}

function normalizeTitle_(s) {
  return String(s || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '');
}

function startOfDay_(date, tz) {
  return Utilities.parseDate(Utilities.formatDate(date, tz, 'yyyy-MM-dd'), tz, 'yyyy-MM-dd');
}

/**
 * date のその日（tz での日付）から days 日ずらした日の 0 時を返す。
 * 夏時間の切り替え日は 1 日が 24 時間ではないため、ミリ秒の足し算ではなく日付で計算する
 */
function addDays_(date, days, tz) {
  const [y, m, d] = Utilities.formatDate(date, tz, 'yyyy-MM-dd').split('-').map(Number);
  const shifted = Utilities.formatDate(new Date(Date.UTC(y, m - 1, d + days)), 'UTC', 'yyyy-MM-dd');
  return Utilities.parseDate(shifted, tz, 'yyyy-MM-dd');
}
