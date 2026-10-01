(() => {
  'use strict';

  const KEY = 'gymlog.v1';
  const DEFAULT_SETS = 3;
  const MAX_EXERCISES = 10;
  const { MUSCLES, DEFAULT_COUNT, LIBRARY, SPLITS } = window.GYM_DATA;

  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const pad = n => String(n).padStart(2, '0');
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => isoDate(new Date());
  const toDate = iso => new Date(iso + 'T12:00:00');
  const fmtDate = (iso, opts) => toDate(iso).toLocaleDateString(undefined, opts || { weekday: 'short', day: 'numeric', month: 'short' });
  const addDays = (iso, n) => {
    const d = toDate(iso);
    d.setDate(d.getDate() + n);
    return isoDate(d);
  };
  const mondayOf = iso => addDays(iso, -((toDate(iso).getDay() + 6) % 7));
  const parseNum = v => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  // ---------- Library ----------

  const muscleLabel = m => MUSCLES[m] || m;
  // [[heading, names]], heading is '' when the muscle has no sub-groups.
  const libGroups = m => {
    const lib = LIBRARY[m] || [];
    return Array.isArray(lib) ? [['', lib]] : Object.entries(lib);
  };
  const libNames = m => libGroups(m).flatMap(g => g[1]);
  const muscleOfName = name => Object.keys(LIBRARY).find(m => libNames(m).some(n => n.toLowerCase() === name.toLowerCase()));

  // ---------- State ----------
  // days: [{ id, name, groups: [{ muscle, slots: [exerciseId | null] }] }]
  // exercises: { id: { name, muscle } }
  // sessions: [{ id, dayId, dayName, date, entries: { exerciseId: { sets: [{ w, r }], drop } } }]

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.days) && s.exercises && Array.isArray(s.sessions)) return migrate(s);
    } catch (e) { /* fall through to a fresh start */ }
    return { split: null, days: [], exercises: {}, sessions: [] };
  }

  // Days used to hold a flat exercise list; sort those into muscle groups.
  function migrate(s) {
    for (const day of s.days) {
      if (day.groups) continue;
      const fromDayName = Object.keys(MUSCLES).find(m => day.name.toLowerCase().includes(m.replace(/s$/, ''))) || 'chest';
      day.groups = [];
      for (const id of day.exercises || []) {
        const ex = s.exercises[id];
        if (!ex) continue;
        ex.muscle = ex.muscle || muscleOfName(ex.name) || fromDayName;
        let g = day.groups.find(x => x.muscle === ex.muscle);
        if (!g) day.groups.push(g = { muscle: ex.muscle, slots: [] });
        g.slots.push(id);
      }
      delete day.exercises;
    }
    return s;
  }

  let state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      alert('Could not save — storage is full or unavailable.');
    }
  }

  const hasData = entry => !!entry && (entry.drop || entry.sets.some(s => s.w != null || s.r != null));
  // A set only counts as done once it has reps; a weight alone is just pre-filled.
  const isLogged = entry => !!entry && entry.sets.some(s => s.r != null);

  // Drop entries and sessions that were created but never filled in.
  function prune() {
    for (const s of state.sessions) {
      for (const id of Object.keys(s.entries)) if (!hasData(s.entries[id])) delete s.entries[id];
    }
    state.sessions = state.sessions.filter(s => Object.keys(s.entries).length);
    save();
  }

  const dayById = id => state.days.find(d => d.id === id);
  const dayExIds = day => day.groups.flatMap(g => g.slots).filter(Boolean);
  const exName = id => (state.exercises[id] ? state.exercises[id].name : 'Deleted exercise');
  const sessionsDesc = () => [...state.sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // "Chest", "Chest & Biceps", "Chest, Shoulders & Triceps"
  function autoName(day) {
    const labels = day.groups.map(g => muscleLabel(g.muscle));
    if (!labels.length) return 'New day';
    if (labels.length === 1) return labels[0];
    return labels.slice(0, -1).join(', ') + ' & ' + labels[labels.length - 1];
  }

  // The same exercise name always maps to the same id, so its history follows it between days.
  function exIdByName(name, muscle) {
    const found = Object.keys(state.exercises).find(id => state.exercises[id].name.toLowerCase() === name.toLowerCase());
    if (found) return found;
    const id = uid();
    state.exercises[id] = { name, muscle };
    return id;
  }

  function sessionFor(dayId, date, create) {
    let s = state.sessions.find(x => x.dayId === dayId && x.date === date);
    if (!s && create) {
      s = { id: uid(), dayId, dayName: dayById(dayId).name, date, entries: {} };
      state.sessions.push(s);
    }
    return s;
  }

  // Most recent logged entry for an exercise before the given date.
  function lastEntry(exId, beforeDate) {
    for (const s of sessionsDesc()) {
      if (s.date < beforeDate && isLogged(s.entries[exId])) return { date: s.date, entry: s.entries[exId] };
    }
    return null;
  }

  const better = (a, b) => a.w > b.w || (a.w === b.w && a.r > b.r);

  function bestOfEntry(entry) {
    let best = null;
    if (!entry) return best;
    for (const s of entry.sets) {
      if (!(s.r > 0)) continue;
      const c = { w: s.w || 0, r: s.r };
      if (!best || better(c, best)) best = c;
    }
    return best;
  }

  function bestSet(exId, beforeDate) {
    let best = null;
    for (const s of state.sessions) {
      if (beforeDate && s.date >= beforeDate) continue;
      const c = bestOfEntry(s.entries[exId]);
      if (c && (!best || better(c, best))) best = { ...c, date: s.date };
    }
    return best;
  }

  const fmtSet = s => (s.w ? `${s.w}×${s.r != null ? s.r : '–'}` : `BW×${s.r != null ? s.r : '–'}`);
  const fmtEntry = e => e.sets.filter(s => s.r != null).map(fmtSet).join(' · ') + (e.drop ? ' · drop set' : '');

  // Next day in the rotation after the most recently logged one.
  function nextDayId() {
    if (!state.days.length) return null;
    const todays = state.sessions.find(s => s.date === today() && dayById(s.dayId));
    if (todays) return todays.dayId;
    const last = sessionsDesc().find(s => dayById(s.dayId));
    if (!last) return state.days[0].id;
    const i = state.days.findIndex(d => d.id === last.dayId);
    return state.days[(i + 1) % state.days.length].id;
  }

  // Sessions on a date with at least one completed set.
  const loggedOn = date => state.sessions.filter(s => s.date === date && Object.values(s.entries).some(isLogged));

  // calCursor: any date inside the week/month the calendar is showing. logPast: log on a past date that has no workout.
  const ui = {
    tab: 'workout', dayId: nextDayId(), date: today(), editing: false, choosingSplit: false, progressEx: null,
    calCursor: today(), calOpen: false, logPast: false,
  };

  function selectDate(date) {
    ui.date = date;
    ui.calCursor = date;
    ui.logPast = false;
    // Jump to the workout that was done on that date.
    const done = loggedOn(date).find(s => dayById(s.dayId));
    if (done) ui.dayId = done.dayId;
    else if (date === today()) ui.dayId = nextDayId();
  }

  // ---------- Calendar ----------

  function calendar() {
    const t = today();
    const done = new Set(state.sessions.filter(s => Object.values(s.entries).some(isLogged)).map(s => s.date));
    const first = [...done].sort()[0];
    const cur = toDate(ui.calCursor);

    let start, end;
    if (ui.calOpen) {
      start = mondayOf(isoDate(new Date(cur.getFullYear(), cur.getMonth(), 1)));
      end = addDays(mondayOf(isoDate(new Date(cur.getFullYear(), cur.getMonth() + 1, 0))), 6);
    } else {
      start = mondayOf(ui.calCursor);
      end = addDays(start, 6);
    }

    let cells = '';
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const cls = ['cal-day'];
      if (d === ui.date) cls.push('sel');
      if (d === t) cls.push('today');
      if (ui.calOpen && toDate(d).getMonth() !== cur.getMonth()) cls.push('out');
      // Days without a workout only count as missed once tracking has started.
      const mark = done.has(d) ? 'done' : first && d > first && d < t ? 'missed' : '';
      const label = fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }) + (mark === 'done' ? ', workout done' : mark === 'missed' ? ', missed' : '');
      cells += `<button class="${cls.join(' ')}" data-action="cal-pick" data-date="${d}" aria-label="${label}"${d > t ? ' disabled' : ''}>${toDate(d).getDate()}<i class="dot ${mark}"></i></button>`;
    }

    return `
      <section class="card cal">
        <div class="cal-head">
          <button class="icon-btn" data-action="cal-prev" aria-label="Previous ${ui.calOpen ? 'month' : 'week'}">‹</button>
          <button class="cal-title" data-action="cal-toggle" aria-expanded="${ui.calOpen}">${cur.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} <span>${ui.calOpen ? '▴' : '▾'}</span></button>
          <button class="icon-btn" data-action="cal-next" aria-label="Next ${ui.calOpen ? 'month' : 'week'}"${end >= t ? ' disabled' : ''}>›</button>
        </div>
        <div class="cal-grid cal-week">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span>${d}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
        <div class="cal-legend"><span><i class="dot done"></i>Workout done</span><span><i class="dot missed"></i>Missed</span></div>
      </section>`;
  }

  // ---------- Split chooser ----------

  function renderSplits() {
    const cards = SPLITS.map((s, i) => `
      <section class="card">
        <button class="p-row" data-action="pick-split" data-i="${i}">
          <span class="p-name">${esc(s.name)}<span class="p-n">${s.days.length} day${s.days.length === 1 ? '' : 's'} · ${esc(s.days.map(d => d[0]).join(' → '))}</span></span>
          <span class="p-pr">${state.split === s.name ? 'Current' : '›'}</span>
        </button>
      </section>`).join('');
    $('#app').innerHTML = `
      <header class="top"><div class="top-row">
        <h1>Choose your split</h1>
        ${state.days.length ? '<button class="link-btn" data-action="cancel-split">Cancel</button>' : ''}
      </div></header>
      <p class="sub" style="margin-top:14px">Pick the routine closest to yours. Afterwards you can change the muscle groups and the number of exercises for every day.</p>
      ${cards}`;
  }

  function applySplit(split) {
    state.days = split.days.map(([name, counts]) => ({
      id: uid(),
      name,
      groups: Object.entries(counts).map(([muscle, n]) => ({ muscle, slots: Array(n).fill(null) })),
    }));
    state.split = split.name;
    ui.dayId = state.days[0].id;
    ui.date = today();
    ui.choosingSplit = false;
    // An empty custom split goes straight to choosing muscle groups.
    ui.editing = !state.days[0].groups.length;
    save();
  }

  // ---------- Workout view ----------

  function renderWorkout() {
    if (!state.days.length || ui.choosingSplit) return renderSplits();
    if (!dayById(ui.dayId)) ui.dayId = state.days[0].id;
    const day = dayById(ui.dayId);

    const dayTabs = state.days.map((d, i) =>
      `<button class="day-btn${d.id === ui.dayId ? ' on' : ''}" data-action="day" data-id="${d.id}">Day ${i + 1} · ${esc(d.name)}</button>`
    ).join('') + (ui.editing ? '<button class="day-btn add" data-action="add-day">+ Day</button>' : '');

    const title = ui.editing
      ? `<input class="name-input" data-field="day-name" value="${esc(day.name)}" aria-label="Day name">`
      : `<h1>${esc(day.name)}</h1>`;

    $('#app').innerHTML = `
      <header class="top">
        <div class="top-row">${title}<button class="link-btn" data-action="toggle-edit">${ui.editing ? 'Done' : 'Edit'}</button></div>
        <nav class="days">${dayTabs}</nav>
      </header>${ui.editing ? editBody(day) : logBody(day)}`;

    const on = $('.day-btn.on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function editBody(day) {
    const chips = Object.keys(MUSCLES).map(m =>
      `<button class="day-btn${day.groups.some(g => g.muscle === m) ? ' on' : ''}" data-action="toggle-muscle" data-muscle="${m}">${muscleLabel(m)}</button>`
    ).join('');
    const counts = day.groups.map((g, gi) => `
      <section class="card edit" data-g="${gi}">
        <span class="g-name">${muscleLabel(g.muscle)}</span>
        <button class="icon-btn" data-action="count-dec" aria-label="Fewer ${muscleLabel(g.muscle)} exercises"${g.slots.length <= 1 ? ' disabled' : ''}>−</button>
        <b class="g-count">${g.slots.length}</b>
        <button class="icon-btn" data-action="count-inc" aria-label="More ${muscleLabel(g.muscle)} exercises"${g.slots.length >= MAX_EXERCISES ? ' disabled' : ''}>+</button>
      </section>`).join('');
    return `
      <p class="group-label">Muscle groups for this day</p>
      <div class="chips">${chips}</div>
      ${day.groups.length ? '<p class="group-label">Number of exercises</p>' + counts : '<p class="empty">Tap the muscle groups you train on this day.</p>'}
      <button class="wide-btn" data-action="change-split">Change split</button>
      <button class="wide-btn danger" data-action="delete-day">Delete this day</button>`;
  }

  function logBody(day) {
    const session = sessionFor(day.id, ui.date, false);
    const past = ui.date !== today();
    let html = calendar() + `
      <div class="datebar${past ? ' past' : ''}">
        <span>${past ? fmtDate(ui.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Today · ' + fmtDate(ui.date)}</span>
        ${past ? '<button class="link-btn" data-action="go-today">Back to today</button>' : ''}
      </div>`;

    if (past) {
      // Workouts from days that no longer exist because the split was changed since.
      const orphans = loggedOn(ui.date).filter(s => !dayById(s.dayId));
      html += orphans.map(sessionCard).join('');
      if (!session && !ui.logPast) return html + (orphans.length ? '' : missedCard(day));
    }

    if (!day.groups.length) return html + '<p class="empty">No muscle groups yet. Tap Edit to choose them.</p>';

    day.groups.forEach((g, gi) => {
      html += `<p class="group-label">${muscleLabel(g.muscle)} · ${g.slots.length} exercise${g.slots.length === 1 ? '' : 's'}</p>`;
      g.slots.forEach((exId, si) => {
        html += exerciseCard(exId, session, picker(day, gi, si), `data-g="${gi}" data-slot="${si}"`);
      });
    });

    // Exercises logged in this session that have since been swapped out of the day.
    const planned = dayExIds(day);
    const extra = session ? Object.keys(session.entries).filter(id => !planned.includes(id) && hasData(session.entries[id])) : [];
    if (extra.length) {
      html += '<p class="group-label">Also logged</p>';
      for (const id of extra) html += exerciseCard(id, session, `<h2>${esc(exName(id))}</h2>`, '');
    }
    return html;
  }

  // Shown for a past date that has no workout for the selected day.
  function missedCard(day) {
    const first = state.sessions.map(s => s.date).sort()[0];
    let title, text;
    if (loggedOn(ui.date).length) {
      title = `No ${day.name} workout on this day`;
      text = 'A different workout was logged on this date.';
    } else if (first && ui.date > first) {
      title = 'Workout missed';
      text = 'No workout was logged on this day.';
    } else {
      title = 'No workout logged';
      text = 'This is before your first logged workout.';
    }
    return `
      <section class="card missed">
        <h2>${esc(title)}</h2>
        <p class="last">${text}</p>
        <button class="wide-btn" data-action="log-past">Log ${esc(day.name)} for this day</button>
      </section>`;
  }

  // Dropdown listing every exercise for the slot's muscle group.
  function picker(day, gi, si) {
    const g = day.groups[gi];
    const cur = g.slots[si];
    const curName = cur ? exName(cur) : null;
    const label = muscleLabel(g.muscle);
    const taken = new Set(dayExIds(day).filter(id => id !== cur).map(id => exName(id).toLowerCase()));
    const opt = n => `<option value="${esc(n)}"${n === curName ? ' selected' : ''}${taken.has(n.toLowerCase()) ? ' disabled' : ''}>${esc(n)}</option>`;

    const inLib = new Set(libNames(g.muscle).map(n => n.toLowerCase()));
    const own = Object.values(state.exercises).filter(e => e.muscle === g.muscle && !inLib.has(e.name.toLowerCase())).map(e => e.name);
    if (curName && !inLib.has(curName.toLowerCase()) && !own.includes(curName)) own.push(curName);

    let options = `<option value="" disabled${cur ? '' : ' selected'}>Choose ${label.toLowerCase()} exercise ${si + 1}…</option>`;
    for (const [heading, names] of libGroups(g.muscle)) {
      options += heading ? `<optgroup label="${esc(heading)}">${names.map(opt).join('')}</optgroup>` : names.map(opt).join('');
    }
    if (own.length) options += `<optgroup label="Your exercises">${own.sort().map(opt).join('')}</optgroup>`;
    options += '<option value="__custom">＋ Add your own…</option>';
    return `<select class="name-select${cur ? '' : ' unpicked'}" data-field="pick" aria-label="${label} exercise ${si + 1}">${options}</select>`;
  }

  function exerciseCard(exId, session, titleHtml, attrs) {
    if (!exId) return `<section class="card" ${attrs}><div class="card-head">${titleHtml}</div></section>`;

    const entry = session && session.entries[exId];
    const last = lastEntry(exId, ui.date);
    const n = entry ? entry.sets.length : last ? last.entry.sets.length : DEFAULT_SETS;
    let rows = '';
    for (let i = 0; i < n; i++) {
      const cur = (entry && entry.sets[i]) || {};
      const prev = (last && last.entry.sets[i]) || {};
      rows += `
        <div class="set" data-i="${i}">
          <span class="set-n">${i + 1}</span>
          <input data-f="w" inputmode="decimal" autocomplete="off" aria-label="Set ${i + 1} weight in kg" value="${cur.w != null ? cur.w : ''}" placeholder="${prev.w != null ? prev.w : ''}">
          <input data-f="r" inputmode="numeric" autocomplete="off" aria-label="Set ${i + 1} reps" value="${cur.r != null ? cur.r : ''}" placeholder="${prev.r != null ? prev.r : ''}">
        </div>`;
    }
    return `
      <section class="card" data-ex="${exId}" ${attrs}>
        <div class="card-head">${titleHtml}<span class="pr-badge"${isPR(exId, entry) ? '' : ' hidden'}>PR</span></div>
        <p class="last">${last ? `Last (${fmtDate(last.date, { day: 'numeric', month: 'short' })}): ${esc(fmtEntry(last.entry))}` : 'No previous log'}</p>
        <div class="sets">
          <div class="set-head"><span></span><span>kg</span><span>reps</span></div>
          ${rows}
        </div>
        <div class="card-foot">
          <label class="drop"><input type="checkbox" data-field="drop"${entry && entry.drop ? ' checked' : ''}> Drop set</label>
          <div class="set-btns">
            <button class="chip" data-action="rm-set" aria-label="Remove last set">−</button>
            <button class="chip" data-action="add-set">+ Set</button>
          </div>
        </div>
      </section>`;
  }

  function isPR(exId, entry) {
    const cur = bestOfEntry(entry);
    const prev = bestSet(exId, ui.date);
    return !!(cur && prev && better(cur, prev));
  }

  // Entry for the card being edited, sized to the rows currently on screen.
  function entryForCard(card) {
    const session = sessionFor(ui.dayId, ui.date, true);
    session.dayName = dayById(ui.dayId).name;
    const exId = card.dataset.ex;
    if (!session.entries[exId]) session.entries[exId] = { sets: [], drop: false };
    const entry = session.entries[exId];
    const rows = card.querySelectorAll('.set').length;
    while (entry.sets.length < rows) entry.sets.push({ w: null, r: null });
    return entry;
  }

  function pickExercise(select) {
    const card = select.closest('.card');
    const day = dayById(ui.dayId);
    const g = day.groups[+card.dataset.g];
    const si = +card.dataset.slot;

    let name = select.value;
    if (name === '__custom') {
      name = (prompt(`Name of your ${muscleLabel(g.muscle).toLowerCase()} exercise`) || '').trim();
      if (!name) return render();
    }
    const id = exIdByName(name, g.muscle);
    const old = g.slots[si];
    if (id !== old && dayExIds(day).includes(id)) {
      alert(`"${exName(id)}" is already in this day.`);
      return render();
    }
    g.slots[si] = id;
    // Numbers already typed in this box stay with the box.
    const session = sessionFor(day.id, ui.date, false);
    if (session && old && old !== id && session.entries[old] && !session.entries[id]) {
      session.entries[id] = session.entries[old];
      delete session.entries[old];
    }
    save(); render();
  }

  // ---------- History view ----------

  function sessionCard(s) {
    const day = dayById(s.dayId);
    const order = day ? dayExIds(day) : [];
    const ids = Object.keys(s.entries).filter(id => isLogged(s.entries[id]))
      .sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999));
    return `
      <section class="card" data-session="${s.id}">
        <div class="card-head"><h2>${esc(day ? day.name : s.dayName || 'Workout')}</h2><span class="h-date">${fmtDate(s.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
        <ul class="h-lines">${ids.map(id => `<li><b>${esc(exName(id))}</b> <span>${esc(fmtEntry(s.entries[id]))}</span></li>`).join('')}</ul>
        <div class="h-actions">
          ${day ? '<button class="link-btn" data-action="edit-session">Edit</button>' : ''}
          <button class="link-btn danger" data-action="delete-session">Delete</button>
        </div>
      </section>`;
  }

  function renderHistory() {
    const sessions = sessionsDesc().filter(s => Object.values(s.entries).some(isLogged));
    const cards = sessions.map(sessionCard).join('');
    $('#app').innerHTML = `
      <h1 class="page-title">History</h1>
      <p class="sub">${sessions.length} workout${sessions.length === 1 ? '' : 's'} logged</p>
      ${cards || '<p class="empty">Nothing logged yet. Your workouts will show up here.</p>'}`;
  }

  // ---------- Progress view ----------

  // One point per session: the top set of that day.
  function seriesFor(exId) {
    const pts = [];
    for (const s of [...state.sessions].sort((a, b) => (a.date < b.date ? -1 : 1))) {
      const b = bestOfEntry(s.entries[exId]);
      if (b) pts.push({ date: s.date, w: b.w, r: b.r });
    }
    return pts;
  }

  function renderProgress() {
    if (ui.progressEx && state.exercises[ui.progressEx]) return renderProgressDetail(ui.progressEx);
    ui.progressEx = null;

    const seen = new Set();
    const row = id => {
      seen.add(id);
      const pts = seriesFor(id);
      const pr = bestSet(id);
      return `
        <section class="card">
          <button class="p-row" data-action="open-progress" data-id="${id}">
            <span class="p-name">${esc(exName(id))}<span class="p-n">${pts.length ? `${pts.length} session${pts.length === 1 ? '' : 's'}` : 'Not logged yet'}</span></span>
            ${pr ? `<span class="p-pr">${fmtSet(pr)}</span>` : ''}
          </button>
        </section>`;
    };

    let html = state.days.map((d, i) => {
      const ids = dayExIds(d);
      return ids.length ? `<p class="group-label">Day ${i + 1} · ${esc(d.name)}</p>` + ids.map(row).join('') : '';
    }).join('');
    const other = Object.keys(state.exercises).filter(id => !seen.has(id) && seriesFor(id).length);
    if (other.length) html += '<p class="group-label">No longer in a day</p>' + other.map(row).join('');

    $('#app').innerHTML = `
      <h1 class="page-title">Progress</h1>
      <p class="sub">Personal records (kg × reps). Tap an exercise for its chart.</p>
      ${html || '<p class="empty">Choose your exercises in the Workout tab and they will show up here.</p>'}`;
  }

  function renderProgressDetail(exId) {
    const pts = seriesFor(exId);
    const pr = bestSet(exId);
    const byWeight = pts.some(p => p.w > 0);
    const first = pts[0], latest = pts[pts.length - 1];
    const val = p => (byWeight ? p.w : p.r);
    const change = pts.length > 1 ? val(latest) - val(first) : 0;

    $('#app').innerHTML = `
      <header class="top"><div class="top-row">
        <button class="link-btn" data-action="close-progress">‹ Back</button>
      </div></header>
      <h1 class="page-title" style="margin-top:16px">${esc(exName(exId))}</h1>
      ${pts.length ? `
        <div class="stats">
          <div class="stat"><b>${fmtSet(pr)}</b><span>Record</span></div>
          <div class="stat"><b>${fmtSet(latest)}</b><span>Latest</span></div>
          <div class="stat"><b>${change > 0 ? '+' : ''}${+change.toFixed(2)}${byWeight ? ' kg' : ''}</b><span>Since first log</span></div>
        </div>
        <section class="card">
          <p class="sub">Top set ${byWeight ? 'weight (kg)' : 'reps'} per workout</p>
          ${chart(pts.map(p => ({ date: p.date, v: val(p), pr: p.date === pr.date })))}
        </section>
        <section class="card">
          <ul class="h-lines" style="margin:0">${[...pts].reverse().map(p =>
            `<li><b>${fmtSet(p)}</b> <span>${fmtDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}${p.date === pr.date ? ' · record' : ''}</span></li>`).join('')}</ul>
        </section>`
        : '<p class="empty">Log this exercise to see its progress.</p>'}`;
    window.scrollTo(0, 0);
  }

  function chart(pts) {
    const W = 340, H = 180, L = 34, R = 12, T = 12, B = 24;
    const vals = pts.map(p => p.v);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (lo === hi) { lo -= 1; hi += 1; }
    const span = hi - lo;
    lo -= span * 0.1; hi += span * 0.1;
    const t0 = toDate(pts[0].date).getTime(), t1 = toDate(pts[pts.length - 1].date).getTime();
    const x = p => (t1 === t0 ? (L + W - R) / 2 : L + ((toDate(p.date).getTime() - t0) / (t1 - t0)) * (W - L - R));
    const y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

    let grid = '';
    for (let i = 0; i <= 3; i++) {
      const v = lo + ((hi - lo) * i) / 3;
      grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${+v.toFixed(1)}</text>`;
    }
    const short = { day: 'numeric', month: 'short' };
    const labels = pts.length > 1
      ? `<text x="${L}" y="${H - 6}">${fmtDate(pts[0].date, short)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${fmtDate(pts[pts.length - 1].date, short)}</text>`
      : `<text x="${x(pts[0])}" y="${H - 6}" text-anchor="middle">${fmtDate(pts[0].date, short)}</text>`;
    return `
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Progress chart">
        ${grid}
        <polyline class="line" points="${pts.map(p => `${x(p)},${y(p.v)}`).join(' ')}"/>
        ${pts.map(p => `<circle class="dot${p.pr ? ' pr' : ''}" cx="${x(p)}" cy="${y(p.v)}" r="4"/>`).join('')}
        ${labels}
      </svg>`;
  }

  // ---------- Render + events ----------

  function render() {
    for (const b of document.querySelectorAll('#tabbar button')) b.classList.toggle('on', b.dataset.tab === ui.tab);
    if (ui.tab === 'history') renderHistory();
    else if (ui.tab === 'progress') renderProgress();
    else renderWorkout();
  }

  const actions = {
    tab(el) {
      prune();
      if (el.dataset.tab === ui.tab && ui.tab === 'progress') ui.progressEx = null;
      ui.tab = el.dataset.tab;
      ui.editing = false;
      ui.choosingSplit = false;
      render();
      window.scrollTo(0, 0);
    },
    day(el) { ui.dayId = el.dataset.id; ui.logPast = false; render(); window.scrollTo(0, 0); },
    'toggle-edit'() { ui.editing = !ui.editing; render(); },
    'go-today'() { selectDate(today()); render(); },

    'cal-toggle'() { ui.calOpen = !ui.calOpen; ui.calCursor = ui.date; render(); },
    'cal-prev'() { moveCalendar(-1); },
    'cal-next'() { moveCalendar(1); },
    'cal-pick'(el) { selectDate(el.dataset.date); render(); },
    'log-past'() { ui.logPast = true; render(); },

    'change-split'() { ui.choosingSplit = true; render(); window.scrollTo(0, 0); },
    'cancel-split'() { ui.choosingSplit = false; render(); },
    'pick-split'(el) {
      const split = SPLITS[+el.dataset.i];
      if (state.days.length && !confirm(`Switch to "${split.name}"? Your current days are replaced. Workouts already logged stay in History.`)) return;
      applySplit(split);
      render();
      window.scrollTo(0, 0);
    },

    'add-day'() {
      const day = { id: uid(), name: 'New day', groups: [] };
      state.days.push(day);
      ui.dayId = day.id;
      save(); render();
    },
    'delete-day'() {
      const day = dayById(ui.dayId);
      if (!confirm(`Delete "${day.name}"? Workouts already logged stay in History.`)) return;
      state.days = state.days.filter(d => d !== day);
      ui.dayId = state.days.length ? state.days[0].id : null;
      if (!state.days.length) ui.editing = false;
      save(); render();
    },
    'toggle-muscle'(el) {
      const day = dayById(ui.dayId);
      const muscle = el.dataset.muscle;
      const g = day.groups.find(x => x.muscle === muscle);
      if (g && g.slots.some(Boolean) && !confirm(`Remove ${muscleLabel(muscle)} and its chosen exercises from this day? Their history is kept.`)) return;
      // Keep the day name in step with its muscles unless it was renamed by hand.
      const named = day.name !== autoName(day);
      if (g) day.groups = day.groups.filter(x => x !== g);
      else day.groups.push({ muscle, slots: Array(DEFAULT_COUNT[muscle] || 2).fill(null) });
      if (!named) day.name = autoName(day);
      save(); render();
    },
    'count-inc'(el) {
      const g = dayById(ui.dayId).groups[+el.closest('.card').dataset.g];
      if (g.slots.length < MAX_EXERCISES) g.slots.push(null);
      save(); render();
    },
    'count-dec'(el) {
      const g = dayById(ui.dayId).groups[+el.closest('.card').dataset.g];
      if (g.slots.length > 1) g.slots.pop();
      save(); render();
    },

    'add-set'(el) {
      entryForCard(el.closest('.card')).sets.push({ w: null, r: null });
      save(); render();
    },
    'rm-set'(el) {
      const entry = entryForCard(el.closest('.card'));
      if (entry.sets.length <= 1) return;
      const lastSet = entry.sets[entry.sets.length - 1];
      if ((lastSet.w != null || lastSet.r != null) && !confirm('Remove the last set and its numbers?')) return;
      entry.sets.pop();
      save(); render();
    },

    'edit-session'(el) {
      const s = state.sessions.find(x => x.id === el.closest('.card').dataset.session);
      ui.tab = 'workout'; ui.dayId = s.dayId; ui.date = s.date; ui.calCursor = s.date; ui.logPast = false;
      render();
      window.scrollTo(0, 0);
    },
    'delete-session'(el) {
      const id = el.closest('.card').dataset.session;
      const s = state.sessions.find(x => x.id === id);
      if (!confirm(`Delete the workout from ${fmtDate(s.date)}? This can't be undone.`)) return;
      state.sessions = state.sessions.filter(x => x.id !== id);
      save(); render();
    },

    'open-progress'(el) { ui.progressEx = el.dataset.id; render(); },
    'close-progress'() { ui.progressEx = null; render(); },
  };

  // Step the calendar by a week, or by a month when it is expanded.
  function moveCalendar(dir) {
    const cur = toDate(ui.calCursor);
    ui.calCursor = ui.calOpen ? isoDate(new Date(cur.getFullYear(), cur.getMonth() + dir, 1)) : addDays(ui.calCursor, 7 * dir);
    render();
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
  });

  // Typing saves straight to state without re-rendering, so focus is never lost.
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.f) {
      const card = el.closest('.card');
      const entry = entryForCard(card);
      entry.sets[+el.closest('.set').dataset.i][el.dataset.f] = parseNum(el.value);
      save();
      $('.pr-badge', card).hidden = !isPR(card.dataset.ex, entry);
    } else if (el.dataset.field === 'day-name') {
      dayById(ui.dayId).name = el.value.trim() || 'Untitled day';
      save();
    }
  });

  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.field === 'pick') {
      pickExercise(el);
    } else if (el.dataset.field === 'drop') {
      entryForCard(el.closest('.card')).drop = el.checked;
      save();
    } else if (el.dataset.f === 'w' && parseNum(el.value) != null) {
      // Carry the weight down to later sets that are still blank.
      const card = el.closest('.card');
      const entry = entryForCard(card);
      const from = +el.closest('.set').dataset.i;
      card.querySelectorAll('.set').forEach((row, i) => {
        const input = $('[data-f="w"]', row);
        if (i > from && input.value === '') {
          input.value = el.value;
          entry.sets[i].w = parseNum(el.value);
        }
      });
      save();
    }
  });

  // Enter moves to the next field instead of doing nothing.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
    const inputs = [...document.querySelectorAll('#app input:not([type="checkbox"]):not([type="date"])')];
    const next = inputs[inputs.indexOf(e.target) + 1];
    if (next) next.focus(); else e.target.blur();
  });

  prune();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
