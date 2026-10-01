(() => {
  'use strict';

  const KEY = 'gymlog.nutrition.v1';
  const MEASURED = ['g', 'ml'];
  const NO_PLURAL = ['g', 'ml', 'tbsp', 'tsp'];
  const PLURALS = { glass: 'glasses', mango: 'mangoes', potato: 'potatoes', tomato: 'tomatoes' };
  const MACROS = [['kcal', 'Calories', 'kcal'], ['p', 'Protein', 'g'], ['c', 'Carbs', 'g'], ['f', 'Fat', 'g']];
  // USDA measures that are volumes or weights rather than "one of something".
  const NOT_A_COUNT = /^(cup|tablespoon|teaspoon|tbsp|tsp|fl oz|oz|ounce|lb|pound|liter|litre|ml|g|quantity)\b/i;

  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const pad = n => String(n).padStart(2, '0');
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => isoDate(new Date());
  const toDate = iso => new Date(iso + 'T12:00:00');
  const addDays = (iso, n) => {
    const d = toDate(iso);
    d.setDate(d.getDate() + n);
    return isoDate(d);
  };
  const fmtDate = iso => toDate(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const parseNum = v => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const r1 = x => +x.toFixed(1);
  const fmtVal = (key, x) => (key === 'kcal' ? Math.round(x).toLocaleString() : String(r1(x)));

  // ---------- Foods ----------
  // food: { name, kcal, p, c, f (per 100 g), units: [[label, grams]], src }

  const LIB = window.GYM_FOODS.map(([name, kcal, p, c, f, units, alias]) => {
    const u = (units || []).map(x => x.slice());
    if (!u.some(x => MEASURED.includes(x[0]))) u.push(['g', 1]);
    return { name, kcal, p, c, f, units: u, src: 'Built-in', hay: (name + ' ' + (alias || '')).toLowerCase() };
  });

  const isSimple = label => /^[a-z]+( [a-z]+)?$/i.test(label);
  function plural(label) {
    if (NO_PLURAL.includes(label)) return label;
    const words = label.split(' ');
    const last = words.pop();
    return [...words, PLURALS[last] || last + 's'].join(' ');
  }

  // "2 bananas", "150 g", "2 × cup, mashed"
  function qtyText(item) {
    const label = item.food.units[item.unit][0];
    if (NO_PLURAL.includes(label)) return `${item.qty} ${label}`;
    if (isSimple(label)) return `${item.qty} ${item.qty === 1 ? label : plural(label)}`;
    return `${item.qty} × ${label}`;
  }

  // Asks for a count when the unit is a piece, an amount when it is a weight or volume.
  function question(food, unit) {
    const label = food.units[unit][0];
    if (label === 'g') return 'How much? (grams)';
    if (label === 'ml') return 'How much? (ml)';
    return isSimple(label) ? `How many ${plural(label)}?` : `How many? (${label})`;
  }

  function macrosOf(item) {
    const k = (item.qty || 0) * item.food.units[item.unit][1] / 100;
    return { kcal: item.food.kcal * k, p: item.food.p * k, c: item.food.c * k, f: item.food.f * k };
  }
  const sum = items => items.reduce((t, it) => {
    const m = macrosOf(it);
    return { kcal: t.kcal + m.kcal, p: t.p + m.p, c: t.c + m.c, f: t.f + m.f };
  }, { kcal: 0, p: 0, c: 0, f: 0 });
  const macroLine = m => `P ${r1(m.p)} · C ${r1(m.c)} · F ${r1(m.f)}`;

  function searchLocal(query) {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    const q = tokens.join(' ');
    const saved = state.saved.map(f => ({ ...f, hay: f.name.toLowerCase() }));
    return [...LIB, ...saved]
      .filter(f => tokens.every(t => f.hay.includes(t)))
      .map(f => ({ f, score: f.name.toLowerCase().startsWith(q) ? 0 : f.hay.split(/[\s,/()]+/).some(w => w.startsWith(tokens[0])) ? 1 : 2 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 12)
      .map(x => x.f);
  }

  // USDA FoodData Central: generic foods come with piece weights ("1 banana" = 126 g), branded ones with a serving size.
  function fromUsda(f) {
    const n = {};
    for (const x of f.foodNutrients || []) n[x.nutrientId] = x.value;
    const p = n[1003] || 0, fat = n[1004] || 0, c = n[1005] || 0;
    const kcal = n[1008] != null ? n[1008] : n[2048] != null ? n[2048] : n[2047] != null ? n[2047] : 4 * p + 4 * c + 9 * fat;
    const branded = f.dataType === 'Branded';

    let units;
    if (branded) {
      const u = String(f.servingSizeUnit || '').toLowerCase();
      units = f.servingSize > 0 && ['g', 'grm', 'ml', 'mlt'].includes(u) ? [['serving', r1(f.servingSize)], ['g', 1]] : [['g', 1]];
    } else {
      const measures = [];
      for (const m of f.foodMeasures || []) {
        const match = /^1 (.+)$/.exec(String(m.disseminationText || '').trim());
        if (match && m.gramWeight > 0 && !measures.some(x => x[0] === match[1])) measures.push([match[1], r1(m.gramWeight)]);
      }
      const counts = measures.filter(m => !NOT_A_COUNT.test(m[0])).slice(0, 3);
      const volumes = measures.filter(m => NOT_A_COUNT.test(m[0]) && !/^quantity/i.test(m[0])).slice(0, 2);
      units = counts.length ? [...counts, ['g', 1], ...volumes] : [['g', 1], ...volumes];
    }

    let name = String(f.description || '').trim();
    if (name === name.toUpperCase()) name = name.charAt(0) + name.slice(1).toLowerCase();
    const brand = f.brandName || f.brandOwner;
    if (branded && brand) name += ` (${brand})`;
    return { name, kcal: r1(kcal), p: r1(p), c: r1(c), f: r1(fat), units, src: branded ? 'USDA branded' : 'USDA', branded };
  }

  async function searchOnline(query) {
    const res = await fetch('https://api.nal.usda.gov/fdc/v1/foods/search?pageSize=25&query=' + encodeURIComponent(query), {
      headers: { 'X-Api-Key': state.usdaKey || 'DEMO_KEY' },
    });
    if (res.status === 429) throw new Error('The shared lookup limit is used up for now. Try again in an hour, or add your own free key under Diet plan → Internet search.');
    if (res.status === 403) throw new Error('The lookup key was rejected. Check it under Diet plan → Internet search.');
    if (!res.ok) throw new Error('The food database did not respond. Try again.');
    const data = await res.json();
    const seen = new Set();
    const foods = (data.foods || []).map(fromUsda).filter(f => {
      const k = f.name.toLowerCase();
      if (!f.name || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    // Generic foods before branded products.
    return [...foods.filter(f => !f.branded), ...foods.filter(f => f.branded)].slice(0, 15);
  }

  // ---------- State ----------
  // meals: [{ id, name, items }]   item: { id, food, unit (index into food.units), qty }
  // log: { date: { eaten: { planItemId: item snapshot }, extras: [item] } }
  // saved: foods picked from the internet, kept so they work offline next time

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.meals)) return s;
    } catch (e) { /* fall through to a fresh start */ }
    return {
      targets: { kcal: null, p: null, c: null, f: null },
      meals: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map(name => ({ id: uid(), name, items: [] })),
      log: {},
      saved: [],
      usdaKey: '',
    };
  }

  const state = load();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      alert('Could not save — storage is full or unavailable.');
    }
  }

  const planItems = () => state.meals.flatMap(m => m.items);
  const hasTargets = () => MACROS.some(([k]) => state.targets[k] > 0);
  const dayLog = (date, create) => {
    if (!state.log[date] && create) state.log[date] = { eaten: {}, extras: [] };
    return state.log[date] || { eaten: {}, extras: [] };
  };

  // picker: { ctx, step: 'search' | 'qty', query, local, online, onlineState, onlineError, food, unit, qty }
  // ctx: { type: 'plan', mealId, itemId? } | { type: 'log' } | { type: 'check' }
  const newPicker = ctx => ({ ctx, step: 'search', query: '', local: [], online: null, onlineState: 'idle', food: null, unit: 0, qty: 1 });
  const ui = { view: 'today', date: today(), picker: null, check: newPicker({ type: 'check' }) };
  const activePicker = () => ui.picker || (ui.view === 'check' ? ui.check : null);

  const pickerItem = pk => ({ id: uid(), food: pk.food, unit: pk.unit, qty: pk.qty || 0 });
  const defaultQty = (food, unit) => (MEASURED.includes(food.units[unit][0]) ? 100 : 1);

  // ---------- Shared pieces ----------

  // A labelled bar: value against target, with an optional extra amount stacked on top.
  function barRow([key, label, unit], base, target, extra) {
    const total = base + (extra || 0);
    const numbers = `<b>${fmtVal(key, base)}</b>${extra ? ` + ${fmtVal(key, extra)}` : ''}${target ? ` / ${fmtVal(key, target)}` : ''} ${unit}`;
    let bar = '';
    if (target) {
      const scale = Math.max(target, total) || 1;
      // Going past the protein target is not a problem, so it never turns red.
      bar = `<div class="bar${total > target && key !== 'p' ? ' over' : ''}"><i style="width:${(base / scale) * 100}%"></i>${extra ? `<i class="extra" style="width:${(extra / scale) * 100}%"></i>` : ''}</div>`;
    }
    return `<div class="bar-row"><div class="bar-top"><span>${label}</span><span>${numbers}</span></div>${bar}</div>`;
  }
  const bars = (base, extra) => MACROS.map(m => barRow(m, base[m[0]], state.targets[m[0]], extra ? extra[m[0]] : 0)).join('');

  function tiles(m) {
    return `<div class="stats four">${MACROS.map(([k, label, unit]) =>
      `<div class="stat"><b>${fmtVal(k, m[k])}${k === 'kcal' ? '' : ' g'}</b><span>${k === 'kcal' ? 'kcal' : label}</span></div>`).join('')}</div>`;
  }

  // ---------- Food picker ----------

  function resultsHtml(pk) {
    const q = pk.query.trim();
    if (!q) return '<p class="sub n-hint">Type a food name. Common foods are built in; anything else can be searched on the internet.</p>';
    pk.local = searchLocal(q);
    const row = (f, src, i) => `
      <button class="n-row" data-n="choose" data-src="${src}" data-i="${i}">
        <span class="n-main">${esc(f.name)}<span class="n-sub">${Math.round(f.kcal)} kcal per 100 g · ${macroLine(f)}</span></span><span class="p-pr">›</span>
      </button>`;
    let html = pk.local.map((f, i) => row(f, 'local', i)).join('');
    if (q.length < 2) return html;

    if (pk.onlineState === 'idle') {
      html += `<button class="wide-btn" data-n="online">Search the internet for “${esc(q)}”</button>`;
    } else if (pk.onlineState === 'loading') {
      html += '<p class="sub n-hint">Searching the USDA food database…</p>';
    } else if (pk.onlineState === 'error') {
      html += `<p class="sub n-hint danger">${esc(pk.onlineError)}</p><button class="wide-btn" data-n="online">Try again</button>`;
    } else {
      html += '<p class="group-label">From the internet (USDA)</p>' +
        (pk.online.length ? pk.online.map((f, i) => row(f, 'online', i)).join('') : '<p class="sub n-hint">Nothing found. Try a simpler name.</p>');
    }
    return html;
  }

  function effectHtml(pk) {
    const plan = sum(planItems());
    const extra = macrosOf(pickerItem(pk));
    let verdict;
    const target = state.targets.kcal;
    if (target > 0) {
      const after = plan.kcal + extra.kcal;
      const diff = Math.round(target - after);
      verdict = diff >= 0
        ? `Fits. Your plan plus this is ${fmtVal('kcal', after)} kcal, ${diff.toLocaleString()} kcal under your target.`
        : `Goes over. Your plan plus this is ${fmtVal('kcal', after)} kcal, ${(-diff).toLocaleString()} kcal above your target.`;
      if (state.targets.p > 0) {
        const short = r1(state.targets.p - plan.p - extra.p);
        verdict += short > 0 ? ` Protein would still be ${short} g short.` : ' Protein target is covered.';
      }
    } else {
      verdict = 'Set your daily targets under Diet plan to see whether this fits.';
    }
    return `
      <section class="card">
        <h2>Effect on your diet plan</h2>
        <p class="last">${verdict}</p>
        ${bars(plan, extra)}
      </section>`;
  }

  function pickerBody(pk) {
    if (pk.step === 'search') {
      return `
        <input class="name-input n-search" type="search" data-n-field="query" placeholder="Search a food: banana, rice, roti…" value="${esc(pk.query)}" autocomplete="off" autocorrect="off" aria-label="Search a food">
        <div id="n-results">${resultsHtml(pk)}</div>`;
    }
    const f = pk.food;
    const item = pickerItem(pk);
    const unitOpts = f.units.map(([label, g], i) =>
      `<option value="${i}"${i === pk.unit ? ' selected' : ''}>${label === 'g' ? 'grams' : label === 'ml' ? 'ml' : `${esc(label)} (${g} g)`}</option>`).join('');
    const confirm = pk.ctx.type === 'plan'
      ? (pk.ctx.itemId ? 'Save' : `Add to ${state.meals.find(m => m.id === pk.ctx.mealId).name}`)
      : pk.ctx.type === 'log' ? `Add to ${ui.date === today() ? 'today' : fmtDate(ui.date)}` : 'I ate this — add to today';
    return `
      <section class="card">
        <div class="card-head"><h2>${esc(f.name)}</h2><button class="link-btn" data-n="back-search">Change</button></div>
        <p class="last">Per 100 g: ${Math.round(f.kcal)} kcal · ${macroLine(f)} · ${esc(f.src || '')}</p>
        <label class="n-q" for="n-qty">${esc(question(f, pk.unit))}</label>
        <div class="n-qty-row">
          <input id="n-qty" data-n-field="qty" inputmode="decimal" autocomplete="off" value="${pk.qty != null ? pk.qty : ''}">
          <select class="name-select" data-n-field="unit" aria-label="Unit">${unitOpts}</select>
        </div>
        <div id="n-macros">${tiles(macrosOf(item))}</div>
      </section>
      <div id="n-effect">${pk.ctx.type === 'check' ? effectHtml(pk) : ''}</div>
      <button class="primary-btn" data-n="confirm">${esc(confirm)}</button>`;
  }

  function refreshResults() {
    const pk = activePicker();
    const box = $('#n-results');
    if (pk && box) box.innerHTML = resultsHtml(pk);
  }

  async function runOnline(pk) {
    pk.onlineState = 'loading';
    refreshResults();
    const query = pk.query.trim();
    try {
      const found = await searchOnline(query);
      if (pk.query.trim() !== query) return;
      pk.online = found;
      pk.onlineState = 'done';
    } catch (e) {
      pk.onlineError = e instanceof TypeError ? 'No internet connection, so only the built-in foods are available.' : e.message;
      pk.onlineState = 'error';
    }
    if (activePicker() === pk && pk.step === 'search') refreshResults();
  }

  // ---------- Views ----------

  function itemRow(item, opts) {
    const m = macrosOf(item);
    const main = `<span class="n-main">${esc(item.food.name)}<span class="n-sub">${esc(qtyText(item))} · ${macroLine(m)}</span></span><span class="n-kcal">${Math.round(m.kcal)} kcal</span>`;
    return opts(main);
  }

  function todayView() {
    const day = dayLog(ui.date, false);
    const planIds = new Set(planItems().map(i => i.id));
    // Ticked items that have since been removed from the plan still count for that day.
    const orphans = Object.values(day.eaten).filter(i => !planIds.has(i.id));
    const eaten = sum([...Object.values(day.eaten), ...day.extras]);
    const isToday = ui.date === today();

    let html = `
      <div class="datebar n-date">
        <button class="icon-btn" data-n="day-prev" aria-label="Previous day">‹</button>
        <span>${isToday ? 'Today · ' : ''}${fmtDate(ui.date)}</span>
        <button class="icon-btn" data-n="day-next" aria-label="Next day"${isToday ? ' disabled' : ''}>›</button>
      </div>
      <section class="card">
        <h2>Eaten ${isToday ? 'so far' : 'that day'}</h2>
        ${bars(eaten)}
        ${state.targets.kcal > 0 ? `<p class="last">${eaten.kcal <= state.targets.kcal
          ? `${fmtVal('kcal', state.targets.kcal - eaten.kcal)} kcal left`
          : `${fmtVal('kcal', eaten.kcal - state.targets.kcal)} kcal over your target`}</p>` : ''}
      </section>`;

    if (!planIds.size) html += '<p class="sub n-hint">Your diet plan is empty. Build it under Diet plan and its meals will appear here to tick off.</p>';
    for (const meal of state.meals) {
      if (!meal.items.length) continue;
      const allDone = meal.items.every(i => day.eaten[i.id]);
      html += `
        <div class="n-meal-head"><p class="group-label">${esc(meal.name)}</p><button class="link-btn" data-n="tick-meal" data-meal="${meal.id}">${allDone ? 'Untick all' : 'Tick all'}</button></div>
        <section class="card n-list">${meal.items.map(item => itemRow(day.eaten[item.id] || item, main =>
          `<label class="n-item"><input type="checkbox" data-n-field="eaten" data-id="${item.id}"${day.eaten[item.id] ? ' checked' : ''}>${main}</label>`)).join('')}</section>`;
    }

    html += '<p class="group-label">Outside the plan</p>';
    const extras = [...orphans.map(i => [i, 'eaten']), ...day.extras.map(i => [i, 'extra'])];
    if (extras.length) {
      html += `<section class="card n-list">${extras.map(([item, kind]) => itemRow(item, main =>
        `<div class="n-item">${main}<button class="icon-btn danger" data-n="rm-logged" data-kind="${kind}" data-id="${item.id}" aria-label="Remove ${esc(item.food.name)}">✕</button></div>`)).join('')}</section>`;
    }
    return html + '<button class="wide-btn" data-n="add-log">+ Add something else</button>';
  }

  function planView() {
    const total = sum(planItems());
    const targets = MACROS.map(([k, label, unit]) => `
      <label class="n-target">${label}<input data-n-field="target" data-k="${k}" inputmode="decimal" autocomplete="off" placeholder="${unit}" value="${state.targets[k] != null ? state.targets[k] : ''}"></label>`).join('');

    let html = `
      <section class="card">
        <h2>Daily targets</h2>
        <div class="n-targets">${targets}</div>
      </section>
      <section class="card">
        <h2>Plan total</h2>
        <div id="n-plan-total">${bars(total)}</div>
      </section>`;

    for (const meal of state.meals) {
      const m = sum(meal.items);
      html += `
        <section class="card n-list" data-meal="${meal.id}">
          <div class="card-head">
            <input class="name-input" data-n-field="meal-name" value="${esc(meal.name)}" aria-label="Meal name">
            <button class="icon-btn danger" data-n="rm-meal" aria-label="Delete ${esc(meal.name)}">✕</button>
          </div>
          ${meal.items.map(item => itemRow(item, main => `
            <div class="n-item">
              <button class="n-edit" data-n="edit-item" data-id="${item.id}">${main}</button>
              <button class="icon-btn danger" data-n="rm-item" data-id="${item.id}" aria-label="Remove ${esc(item.food.name)}">✕</button>
            </div>`)).join('')}
          <p class="last n-subtotal">${meal.items.length ? `${Math.round(m.kcal)} kcal · ${macroLine(m)}` : 'No foods yet'}</p>
          <button class="wide-btn" data-n="add-plan">+ Add food</button>
        </section>`;
    }

    return html + `
      <button class="wide-btn" data-n="add-meal">+ Add meal</button>
      <details class="card n-details">
        <summary>Internet search</summary>
        <p class="last">Foods that are not built in are looked up in the USDA FoodData Central database using a shared key, which allows only a few searches per hour. For more, get a free key at api.data.gov/signup and paste it here.</p>
        <input class="name-input" data-n-field="usda-key" placeholder="Your own key (optional)" value="${esc(state.usdaKey || '')}" autocomplete="off" autocapitalize="off" aria-label="USDA key">
      </details>`;
  }

  function render() {
    const app = $('#app');
    if (ui.picker) {
      const titles = { plan: ui.picker.ctx.itemId ? 'Edit food' : 'Add to plan', log: 'Add food' };
      app.innerHTML = `
        <header class="top"><div class="top-row">
          <h1>${titles[ui.picker.ctx.type]}</h1>
          <button class="link-btn" data-n="close-picker">Cancel</button>
        </div></header>
        <div class="n-picker">${pickerBody(ui.picker)}</div>`;
      return;
    }
    const seg = [['today', 'Today'], ['plan', 'Diet plan'], ['check', 'Check a food']].map(([v, label]) =>
      `<button class="${ui.view === v ? 'on' : ''}" data-n="view" data-view="${v}">${label}</button>`).join('');
    app.innerHTML = `
      <h1 class="page-title">Nutrition</h1>
      <div class="seg">${seg}</div>
      ${ui.view === 'plan' ? planView() : ui.view === 'check'
        ? `<p class="sub n-hint">Look up any food to see its macros and what it does to your diet plan.</p><div class="n-picker">${pickerBody(ui.check)}</div>`
        : todayView()}`;
  }

  // ---------- Events ----------

  const findItem = id => {
    for (const meal of state.meals) {
      const item = meal.items.find(i => i.id === id);
      if (item) return { meal, item };
    }
    return null;
  };
  const snapshot = item => JSON.parse(JSON.stringify(item));

  const actions = {
    view(el) { ui.view = el.dataset.view; render(); },
    'day-prev'() { ui.date = addDays(ui.date, -1); render(); },
    'day-next'() { if (ui.date < today()) ui.date = addDays(ui.date, 1); render(); },

    'add-plan'(el) { ui.picker = newPicker({ type: 'plan', mealId: el.closest('[data-meal]').dataset.meal }); openPicker(); },
    'add-log'() { ui.picker = newPicker({ type: 'log' }); openPicker(); },
    'edit-item'(el) {
      const { meal, item } = findItem(el.dataset.id);
      ui.picker = { ...newPicker({ type: 'plan', mealId: meal.id, itemId: item.id }), step: 'qty', food: item.food, unit: item.unit, qty: item.qty };
      render();
      window.scrollTo(0, 0);
    },
    'close-picker'() { ui.picker = null; render(); },

    online() { runOnline(activePicker()); },
    choose(el) {
      const pk = activePicker();
      const { hay, branded, ...food } = (el.dataset.src === 'online' ? pk.online : pk.local)[+el.dataset.i];
      if (el.dataset.src === 'online' && !state.saved.some(f => f.name === food.name)) {
        state.saved.unshift(food);
        state.saved.length = Math.min(state.saved.length, 100);
        save();
      }
      Object.assign(pk, { step: 'qty', food, unit: 0, qty: defaultQty(food, 0) });
      render();
      window.scrollTo(0, 0);
      const input = $('#n-qty');
      if (input) { input.focus(); input.select(); }
    },
    'back-search'() {
      activePicker().step = 'search';
      render();
      const input = $('.n-search');
      if (input) input.focus();
    },
    confirm() {
      const pk = activePicker();
      if (!(pk.qty > 0)) return alert('Enter an amount first.');
      const item = pickerItem(pk);
      if (pk.ctx.type === 'plan') {
        const meal = state.meals.find(m => m.id === pk.ctx.mealId);
        const old = pk.ctx.itemId && meal.items.find(i => i.id === pk.ctx.itemId);
        if (old) Object.assign(old, { food: item.food, unit: item.unit, qty: item.qty });
        else meal.items.push(item);
        ui.view = 'plan';
      } else {
        // The checker always logs to today; "add something else" logs to the day being viewed.
        if (pk.ctx.type === 'check') ui.date = today();
        dayLog(ui.date, true).extras.push(item);
        ui.view = 'today';
      }
      if (pk.ctx.type === 'check') ui.check = newPicker({ type: 'check' });
      ui.picker = null;
      save(); render();
      window.scrollTo(0, 0);
    },

    'rm-item'(el) {
      const { meal, item } = findItem(el.dataset.id);
      meal.items = meal.items.filter(i => i !== item);
      save(); render();
    },
    'add-meal'() {
      state.meals.push({ id: uid(), name: 'New meal', items: [] });
      save(); render();
    },
    'rm-meal'(el) {
      const meal = state.meals.find(m => m.id === el.closest('[data-meal]').dataset.meal);
      if (meal.items.length && !confirm(`Delete "${meal.name}" and its ${meal.items.length} food${meal.items.length === 1 ? '' : 's'} from your plan?`)) return;
      state.meals = state.meals.filter(m => m !== meal);
      save(); render();
    },

    'tick-meal'(el) {
      const meal = state.meals.find(m => m.id === el.dataset.meal);
      const day = dayLog(ui.date, true);
      const allDone = meal.items.every(i => day.eaten[i.id]);
      for (const item of meal.items) {
        if (allDone) delete day.eaten[item.id];
        else if (!day.eaten[item.id]) day.eaten[item.id] = snapshot(item);
      }
      save(); render();
    },
    'rm-logged'(el) {
      const day = dayLog(ui.date, true);
      if (el.dataset.kind === 'eaten') delete day.eaten[el.dataset.id];
      else day.extras = day.extras.filter(i => i.id !== el.dataset.id);
      save(); render();
    },
  };

  function openPicker() {
    render();
    window.scrollTo(0, 0);
    const input = $('.n-search');
    if (input) input.focus();
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-n]');
    if (el && actions[el.dataset.n]) actions[el.dataset.n](el);
  });

  // Typing updates only the part of the page that depends on it, so the keyboard stays open.
  document.addEventListener('input', e => {
    const el = e.target;
    const field = el.dataset.nField;
    if (!field) return;
    const pk = activePicker();
    if (field === 'query') {
      Object.assign(pk, { query: el.value, online: null, onlineState: 'idle' });
      refreshResults();
    } else if (field === 'qty') {
      pk.qty = parseNum(el.value);
      $('#n-macros').innerHTML = tiles(macrosOf(pickerItem(pk)));
      if (pk.ctx.type === 'check') $('#n-effect').innerHTML = effectHtml(pk);
    } else if (field === 'target') {
      state.targets[el.dataset.k] = parseNum(el.value);
      save();
      $('#n-plan-total').innerHTML = bars(sum(planItems()));
    } else if (field === 'meal-name') {
      state.meals.find(m => m.id === el.closest('[data-meal]').dataset.meal).name = el.value.trim() || 'Meal';
      save();
    } else if (field === 'usda-key') {
      state.usdaKey = el.value.trim();
      save();
    }
  });

  document.addEventListener('change', e => {
    const el = e.target;
    const field = el.dataset.nField;
    if (field === 'unit') {
      const pk = activePicker();
      pk.unit = +el.value;
      pk.qty = defaultQty(pk.food, pk.unit);
      render();
    } else if (field === 'eaten') {
      const day = dayLog(ui.date, true);
      const found = findItem(el.dataset.id);
      if (el.checked && found) day.eaten[el.dataset.id] = snapshot(found.item);
      else delete day.eaten[el.dataset.id];
      save(); render();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.dataset) return;
    if (e.target.dataset.nField === 'query') {
      const pk = activePicker();
      if (pk.query.trim().length >= 2 && pk.onlineState !== 'loading') runOnline(pk);
      e.target.blur();
    }
  });

  window.GymNutrition = {
    render,
    // Tapping the Nutrition tab again returns to its first screen.
    home() { ui.picker = null; ui.view = 'today'; ui.date = today(); render(); },
  };
})();
