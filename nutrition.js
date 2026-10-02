(() => {
  'use strict';

  const KEY = 'gymlog.nutrition.v1';
  const { confirm: ask, alert: tell } = window.GymDialog;
  const MEASURED = ['g', 'ml'];
  const NO_PLURAL = ['g', 'ml', 'tbsp', 'tsp'];
  const PLURALS = { glass: 'glasses', mango: 'mangoes', potato: 'potatoes', tomato: 'tomatoes' };
  const MACROS = [['kcal', 'Calories', 'kcal'], ['p', 'Protein', 'g'], ['c', 'Carbs', 'g'], ['f', 'Fat', 'g']];
  // Fiber is tracked alongside the macros: it has a target and a bar, but stays out of the short P · C · F lines.
  const NUTRIENTS = [...MACROS, ['fi', 'Fiber', 'g']];
  const FIBER_PER_1000_KCAL = 14;
  const NOT_EXACT = 'A plan cannot match the targets exactly: every food has its own mix of macros, and portions are rounded to amounts you can measure. Being 10–20 kcal or a few grams off makes no difference.';
  const LEGEND = '<p class="sub n-legend">P = protein · C = carbs · F = fat · Fi = fiber, all in grams</p>';
  // [key, label, description, multiplier applied to the resting burn]
  const ACTIVITY = [
    ['sedentary', 'Sedentary', 'Desk job, little or no exercise', 1.2],
    ['light', 'Lightly active', 'Light exercise 1–3 days a week', 1.375],
    ['moderate', 'Moderately active', 'Training 3–5 days a week', 1.55],
    ['very', 'Very active', 'Hard training 6–7 days a week', 1.725],
    ['extra', 'Extra active', 'Physical job plus hard training', 1.9],
  ];
  // [key, label, kcal change from maintenance, protein in g per kg of body weight]
  const GOALS = [['lose', 'Lose fat', -500, 2], ['maintain', 'Maintain', 0, 1.8], ['gain', 'Build muscle', 300, 1.8]];
  const KCAL_PER_KG = 7700;

  // Diet plan styles: [key, short label, full label, description]
  const STYLES = [
    ['mixed', 'Mixed', 'Mixed', 'A bit of everything: chicken, fish, eggs, rice, oats, fruit'],
    ['desi', 'Desi', 'Desi / South Asian', 'Roti, daal, curry, biryani, paratha, lassi'],
    ['veg', 'Vegetarian', 'Vegetarian', 'No meat, fish or eggs: lentils, paneer, chickpeas, dairy'],
    ['gym', 'Gym food', 'Simple gym food', 'Plain and easy to prep: chicken, rice, oats, eggs'],
  ];
  const MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
  // Two plans per style, one list per meal: [built-in food, unit, starting amount, role].
  // Role 'p' foods are scaled to reach the protein target, 'c' foods to reach calories, 'v' (vegetables) to reach
  // the fiber target, and 'x' stay as they are.
  const PLANS = {
    mixed: [
      [
        [['Oats, dry', 'g', 70, 'c'], ['Milk, whole', 'ml', 250, 'x'], ['Banana', 'banana', 1, 'c'], ['Egg, boiled', 'egg', 3, 'p']],
        [['Chicken breast, cooked', 'g', 180, 'p'], ['Rice, white, cooked', 'g', 220, 'c'], ['Broccoli', 'g', 100, 'v'], ['Olive oil', 'tbsp', 1, 'x']],
        [['Salmon, cooked', 'g', 150, 'p'], ['Potato, boiled', 'g', 250, 'c'], ['Spinach', 'g', 80, 'v'], ['Green beans', 'g', 100, 'v']],
        [['Greek yogurt, plain', 'g', 200, 'p'], ['Almonds', 'g', 25, 'x'], ['Apple', 'apple', 1, 'x']],
      ],
      [
        [['Bread, whole wheat', 'slice', 3, 'c'], ['Omelette', 'egg', 3, 'p'], ['Orange juice', 'ml', 200, 'x']],
        [['Beef, lean, cooked', 'g', 150, 'p'], ['Pasta, cooked', 'g', 220, 'c'], ['Mixed salad', 'g', 150, 'v'], ['Olive oil', 'tbsp', 1, 'x']],
        [['Chicken curry', 'g', 250, 'p'], ['Roti / chapati', 'roti', 2, 'c'], ['Green beans', 'g', 100, 'v'], ['Yogurt, plain', 'g', 150, 'x']],
        [['Whey protein powder', 'scoop', 1, 'x'], ['Banana', 'banana', 1, 'c'], ['Peanut butter', 'tbsp', 1, 'x']],
      ],
    ],
    desi: [
      [
        [['Paratha, plain', 'paratha', 1, 'c'], ['Omelette', 'egg', 2, 'p'], ['Tea with milk and sugar', 'cup', 1, 'x']],
        [['Chicken curry', 'g', 250, 'p'], ['Roti / chapati', 'roti', 2, 'c'], ['Raita', 'g', 100, 'x'], ['Mixed salad', 'g', 150, 'v']],
        [['Daal (lentil curry)', 'g', 250, 'p'], ['Rice, white, cooked', 'g', 200, 'c'], ['Chicken tikka', 'g', 120, 'p'], ['Spinach', 'g', 100, 'v']],
        [['Yogurt, plain', 'g', 200, 'x'], ['Dates', 'date', 3, 'x'], ['Roasted chickpeas', 'g', 40, 'x']],
      ],
      [
        [['Roti / chapati', 'roti', 2, 'c'], ['Egg, fried', 'egg', 2, 'p'], ['Yogurt, plain', 'g', 150, 'x'], ['Tea with milk and sugar', 'cup', 1, 'x']],
        [['Chicken biryani', 'g', 350, 'c'], ['Chicken tikka', 'g', 120, 'p'], ['Raita', 'g', 100, 'x'], ['Mixed salad', 'g', 150, 'v']],
        [['Qeema (minced meat curry)', 'g', 200, 'p'], ['Roti / chapati', 'roti', 2, 'c'], ['Mixed vegetable curry', 'g', 150, 'x'], ['Cabbage', 'g', 100, 'v']],
        [['Lassi, sweet', 'glass', 1, 'x'], ['Banana', 'banana', 1, 'x'], ['Almonds', 'g', 20, 'x']],
      ],
    ],
    veg: [
      [
        [['Oats, dry', 'g', 70, 'c'], ['Milk, whole', 'ml', 300, 'p'], ['Banana', 'banana', 1, 'x'], ['Peanut butter', 'tbsp', 1, 'x']],
        [['Chana masala', 'g', 300, 'p'], ['Rice, white, cooked', 'g', 200, 'c'], ['Raita', 'g', 100, 'x'], ['Mixed salad', 'g', 150, 'v']],
        [['Paneer', 'g', 120, 'p'], ['Roti / chapati', 'roti', 3, 'c'], ['Mixed vegetable curry', 'g', 200, 'x'], ['Spinach', 'g', 100, 'v']],
        [['Greek yogurt, plain', 'g', 200, 'p'], ['Almonds', 'g', 25, 'x'], ['Apple', 'apple', 1, 'x']],
      ],
      [
        [['Bread, whole wheat', 'slice', 3, 'c'], ['Peanut butter', 'tbsp', 2, 'x'], ['Milk, whole', 'ml', 300, 'p']],
        [['Daal (lentil curry)', 'g', 300, 'p'], ['Roti / chapati', 'roti', 3, 'c'], ['Yogurt, plain', 'g', 200, 'x'], ['Mixed salad', 'g', 150, 'v']],
        [['Palak paneer', 'g', 250, 'p'], ['Rice, white, cooked', 'g', 200, 'c'], ['Kidney beans, boiled', 'g', 150, 'p'], ['Cabbage', 'g', 100, 'v']],
        [['Whey protein powder', 'scoop', 1, 'x'], ['Roasted chickpeas', 'g', 40, 'x'], ['Banana', 'banana', 1, 'x']],
      ],
    ],
    gym: [
      [
        [['Oats, dry', 'g', 80, 'c'], ['Whey protein powder', 'scoop', 1, 'x'], ['Banana', 'banana', 1, 'x'], ['Egg, boiled', 'egg', 3, 'p']],
        [['Chicken breast, cooked', 'g', 200, 'p'], ['Rice, white, cooked', 'g', 250, 'c'], ['Broccoli', 'g', 100, 'v'], ['Olive oil', 'tbsp', 1, 'x']],
        [['Chicken breast, cooked', 'g', 180, 'p'], ['Sweet potato, baked', 'g', 250, 'c'], ['Spinach', 'g', 80, 'v'], ['Green beans', 'g', 100, 'v']],
        [['Greek yogurt, plain', 'g', 200, 'p'], ['Bread, whole wheat', 'slice', 2, 'c'], ['Peanut butter', 'tbsp', 1, 'x']],
      ],
      [
        [['Egg, boiled', 'egg', 4, 'p'], ['Bread, whole wheat', 'slice', 2, 'c'], ['Milk, whole', 'ml', 250, 'x']],
        [['Beef, lean, cooked', 'g', 180, 'p'], ['Rice, white, cooked', 'g', 250, 'c'], ['Carrot', 'g', 100, 'v'], ['Mixed salad', 'g', 150, 'v']],
        [['White fish, cooked', 'g', 200, 'p'], ['Potato, boiled', 'g', 300, 'c'], ['Broccoli', 'g', 150, 'v'], ['Olive oil', 'tbsp', 1, 'x']],
        [['Whey protein powder', 'scoop', 1, 'x'], ['Banana', 'banana', 2, 'c'], ['Almonds', 'g', 25, 'x']],
      ],
    ],
  };
  // How each food in a suggested plan is meant to be prepared, so its calories hold true.
  const PLAIN_VEG = 'Steamed, boiled or raw, with no oil or butter.';
  const PREP = {
    'Chicken breast, cooked': 'Grilled, baked, boiled or air-fried, skinless, weighed after cooking. Use an oil spray or at most 1 tsp oil; every extra teaspoon adds about 40 kcal.',
    'Beef, lean, cooked': 'Lean mince or steak, grilled or dry-fried with the fat drained off. Weighed after cooking.',
    'Salmon, cooked': 'Baked, grilled or air-fried with no added oil. Weighed after cooking.',
    'White fish, cooked': 'Baked, grilled or air-fried with no added oil, not battered. Weighed after cooking.',
    'Egg, boiled': 'Boiled or poached, no oil.',
    'Egg, fried': 'Fried in about 1 tsp oil per egg, which is already counted.',
    'Omelette': 'Made with about 1 tsp oil or butter in total, which is already counted.',
    'Rice, white, cooked': 'Boiled or steamed with no oil or butter. Weighed after cooking.',
    'Pasta, cooked': 'Boiled, weighed after cooking, with no oil or creamy sauce.',
    'Oats, dry': 'Weighed dry, then cooked in water or in the milk listed in this meal.',
    'Potato, boiled': 'Boiled or baked with no butter or oil.',
    'Sweet potato, baked': 'Baked or air-fried with no oil.',
    'Bread, whole wheat': 'Plain or toasted, with no butter.',
    'Broccoli': PLAIN_VEG,
    'Spinach': PLAIN_VEG,
    'Carrot': PLAIN_VEG,
    'Green beans': PLAIN_VEG,
    'Cabbage': PLAIN_VEG,
    'Mixed salad': 'Cucumber, tomato, onion and leaves with lemon and salt. No oily or creamy dressing.',
    'Olive oil': 'This is the oil for cooking or dressing this meal. Measure it; do not pour freely.',
    'Greek yogurt, plain': 'Plain and unsweetened.',
    'Yogurt, plain': 'Plain and unsweetened.',
    'Whey protein powder': 'Mixed with water. If you mix it with milk, add the milk as a separate food.',
    'Almonds': 'Plain, not fried or salted.',
    'Roasted chickpeas': 'Dry-roasted, not fried.',
    'Roti / chapati': 'Medium size (about 40 g each), with no ghee or butter on top.',
    'Paratha, plain': 'Cooked with about 1 tsp oil or ghee, which is already counted.',
    'Chicken curry': 'Home-cooked with skinless chicken and about 1 tbsp oil per person. Restaurant curry has far more oil.',
    'Chicken tikka': 'Grilled, baked or air-fried, with no cream or butter.',
    'Chicken biryani': 'Home-cooked. Takeaway biryani is oilier, so count about a third more.',
    'Daal (lentil curry)': 'Home-cooked with a light tarka, about 1 tsp oil or ghee per bowl.',
    'Chana masala': 'Home-cooked with about 1 tsp oil per serving.',
    'Qeema (minced meat curry)': 'Lean mince with about 1 tsp oil per serving; skim off the extra fat.',
    'Mixed vegetable curry': 'Home-cooked with about 1 tsp oil per serving.',
    'Palak paneer': 'Home-cooked with little oil and no cream.',
    'Paneer': 'Raw, grilled or dry-fried, not deep-fried.',
    'Kidney beans, boiled': 'Boiled, or canned and drained, with no oil.',
    'Raita': 'Plain yogurt with cucumber, no sugar.',
    'Lassi, sweet': 'Made with plain yogurt, water and about 2 tsp sugar per glass.',
    'Tea with milk and sugar': 'About 1 tsp sugar and a splash of milk per cup.',
    'Peanut butter': 'A level tablespoon, not a heaped one.',
  };

  // Foods a plan can list raw instead of cooked: cooked name → [raw name, grams cooked per gram raw].
  const RAW = {
    'Chicken breast, cooked': ['Chicken breast, raw', 0.75],
    'Beef, lean, cooked': ['Beef, lean, raw', 0.8],
    'Salmon, cooked': ['Salmon, raw', 0.95],
    'White fish, cooked': ['White fish, raw', 0.8],
    'Rice, white, cooked': ['Rice, white, raw', 2.8],
    'Pasta, cooked': ['Pasta, dry', 2.3],
    'Potato, boiled': ['Potato, raw', 0.9],
    'Sweet potato, baked': ['Sweet potato, raw', 0.95],
  };
  const PREP_RAW = {
    'Chicken breast, raw': 'Weighed raw, skinless. Grill, bake, boil or air-fry it with an oil spray or at most 1 tsp oil; every extra teaspoon adds about 40 kcal.',
    'Beef, lean, raw': 'Lean mince or steak, weighed raw. Grill or dry-fry it and drain off the fat.',
    'Salmon, raw': 'Weighed raw. Bake, grill or air-fry it with no added oil.',
    'White fish, raw': 'Weighed raw. Bake, grill or air-fry it with no added oil, not battered.',
    'Rice, white, raw': 'Weighed dry, before cooking. Boil or steam it with no oil or butter.',
    'Pasta, dry': 'Weighed dry, before cooking. Boil it; no oil or creamy sauce.',
    'Potato, raw': 'Weighed raw. Boil or bake it with no butter or oil.',
    'Sweet potato, raw': 'Weighed raw. Bake or air-fry it with no oil.',
  };

  // Everyday activities: [key, label, MET — how many times the resting burn the activity costs]
  const EXERCISES = [
    ['walk', 'Walking, normal pace', 3.5], ['briskwalk', 'Walking, brisk', 4.3], ['jog', 'Jogging', 7], ['run', 'Running', 9.8],
    ['weights', 'Weight training', 5], ['cycle', 'Cycling', 7], ['swim', 'Swimming', 6], ['hiit', 'HIIT / circuit training', 8],
    ['skip', 'Skipping rope', 11], ['stairs', 'Climbing stairs', 8], ['football', 'Football', 7], ['cricket', 'Cricket', 4.8],
    ['badminton', 'Badminton', 5.5], ['yoga', 'Yoga / stretching', 2.5], ['chores', 'Housework', 3.3],
    ['feet', 'On your feet at work', 2.5], ['labour', 'Physical labour', 5],
  ];

  // Amounts are rounded to what you can actually measure.
  const STEP = { g: 10, ml: 50, tbsp: 0.5, tsp: 0.5, cup: 0.5, glass: 0.5 };

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
    return { name, kcal, p, c, f, fi: window.GYM_FIBER[name] || 0, units: u, src: 'Built-in', hay: (name + ' ' + (alias || '')).toLowerCase() };
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
    return { kcal: item.food.kcal * k, p: item.food.p * k, c: item.food.c * k, f: item.food.f * k, fi: (item.food.fi || 0) * k };
  }
  const sum = items => items.reduce((t, it) => {
    const m = macrosOf(it);
    return { kcal: t.kcal + m.kcal, p: t.p + m.p, c: t.c + m.c, f: t.f + m.f, fi: t.fi + m.fi };
  }, { kcal: 0, p: 0, c: 0, f: 0, fi: 0 });
  const macroLine = m => `P ${r1(m.p)} · C ${r1(m.c)} · F ${r1(m.f)} · Fi ${r1(m.fi || 0)}`;

  const words = text => text.toLowerCase().split(/[\s,/()]+/).filter(Boolean);

  // Foods matching every word; if there are none, the foods sharing the most words ("chicken breast air fried" → chicken breast).
  function searchLocal(query) {
    const tokens = words(query);
    if (!tokens.length) return { list: [], partial: false };
    const q = tokens.join(' ');
    const all = [...LIB, ...state.saved.map(f => ({ ...f, hay: f.name.toLowerCase() }))];
    const exact = all
      .filter(f => tokens.every(t => f.hay.includes(t)))
      .map(f => ({ f, score: f.name.toLowerCase().startsWith(q) ? 0 : words(f.hay).some(w => w.startsWith(tokens[0])) ? 1 : 2 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 12)
      .map(x => x.f);
    if (exact.length) return { list: exact, partial: false };

    const scored = all.map(f => {
      const w = words(f.hay);
      return { f, hits: tokens.filter(t => t.length > 2 && w.some(x => x.startsWith(t))).length };
    });
    const best = Math.max(0, ...scored.map(x => x.hits));
    return { list: best ? scored.filter(x => x.hits === best).slice(0, 5).map(x => x.f) : [], partial: true };
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
    return { name, kcal: r1(kcal), p: r1(p), c: r1(c), f: r1(fat), fi: r1(n[1079] || 0), units, src: branded ? 'USDA branded' : 'USDA', branded };
  }

  // Open Food Facts: packaged products from around the world, with a serving size when the label has one.
  function fromOff(p) {
    const n = p.nutriments || {};
    const kcal = n['energy-kcal_100g'] != null ? +n['energy-kcal_100g'] : n.energy_100g != null ? n.energy_100g / 4.184 : null;
    let name = String(p.product_name || '').trim();
    if (!name || kcal == null || !Number.isFinite(kcal)) return null;
    const brand = String(p.brands || '').split(',')[0].trim();
    if (brand && !name.toLowerCase().includes(brand.toLowerCase())) name += ` (${brand})`;
    const serving = parseFloat(p.serving_quantity);
    return {
      name, kcal: r1(kcal), p: r1(+n.proteins_100g || 0), c: r1(+n.carbohydrates_100g || 0), f: r1(+n.fat_100g || 0), fi: r1(+n.fiber_100g || 0),
      units: serving > 0 ? [['serving', r1(serving)], ['g', 1]] : [['g', 1]],
      src: 'Open Food Facts', branded: true,
    };
  }

  // One retry after a pause: both databases drop requests now and then.
  async function getJson(url, headers) {
    for (let attempt = 0; ; attempt++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 12000);
      try {
        const res = await fetch(url, { headers, signal: ctl.signal });
        if (res.status === 429 || res.status === 403) throw Object.assign(new Error('limit'), { final: true });
        if (!res.ok) throw new Error('http ' + res.status);
        return await res.json();
      } catch (e) {
        if (e.final || attempt >= 1) throw e;
        await new Promise(r => setTimeout(r, 1500));
      } finally {
        clearTimeout(timer);
      }
    }
  }

  // Asks both databases at once and merges what comes back. Returns { foods, failed: [source names] }.
  async function searchOnline(query) {
    const q = encodeURIComponent(query);
    const sources = [
      // The key goes in the address, not a header: a header forces the browser to send an extra
      // permission request first, which doubles the calls against the hourly limit and sometimes fails.
      ['USDA', getJson('https://api.nal.usda.gov/fdc/v1/foods/search?pageSize=25&api_key=' + encodeURIComponent(state.usdaKey || 'DEMO_KEY') + '&query=' + q)
        .then(d => (d.foods || []).map(fromUsda))],
      ['Open Food Facts', getJson('https://world.openfoodfacts.org/cgi/search.pl?action=process&json=1&search_simple=1&sort_by=unique_scans_n&page_size=20' +
        '&fields=product_name,brands,nutriments,serving_quantity&search_terms=' + q)
        .then(d => (d.products || []).map(fromOff).filter(Boolean))],
    ];
    const settled = await Promise.allSettled(sources.map(s => s[1]));
    const failed = sources.filter((s, i) => settled[i].status === 'rejected').map(s => s[0]);
    const [usda, off] = settled.map(r => (r.status === 'fulfilled' ? r.value : []));

    // Best name match first; ties keep generic foods ahead of products.
    const tokens = words(query);
    const seen = new Set();
    const foods = [...usda.filter(f => !f.branded), ...off, ...usda.filter(f => f.branded)]
      .filter(f => {
        const k = f.name.toLowerCase();
        if (!f.name || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map(f => {
        const name = f.name.toLowerCase();
        return { f, phrase: name.includes(tokens.join(' ')) ? 1 : 0, hits: tokens.filter(t => name.includes(t)).length, length: words(name).length };
      })
      // The exact phrase beats scattered words; shorter names beat long descriptions.
      .sort((a, b) => b.phrase - a.phrase || b.hits - a.hits || a.length - b.length)
      .slice(0, 20)
      .map(x => x.f);
    return { foods, failed };
  }

  // ---------- State ----------
  // meals: [{ id, name, items }]   item: { id, food, unit (index into food.units), qty }
  // log: { date: { eaten: { planItemId: item snapshot }, extras: [item] } }
  // saved: foods picked from the internet, kept so they work offline next time

  // body: { sex: 'male' | 'female', dob: 'YYYY-MM-DD', height (cm), weight (kg), activity, goal }
  const emptyBody = () => ({ sex: null, dob: '', height: null, weight: null, activity: '', goal: 'maintain' });

  // Foods saved before fiber was tracked get it from the built-in list where the name matches.
  function addFiber(s) {
    const fix = food => {
      if (food && food.fi == null) food.fi = window.GYM_FIBER[food.name] || 0;
    };
    for (const meal of s.meals) meal.items.forEach(i => fix(i.food));
    for (const day of Object.values(s.log || {})) [...Object.values(day.eaten || {}), ...(day.extras || [])].forEach(i => fix(i.food));
    (s.saved || []).forEach(fix);
    if (s.targets && s.targets.fi === undefined) s.targets.fi = null;
    return s;
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.meals)) {
        s.body = s.body || emptyBody();
        return addFiber(s);
      }
    } catch (e) { /* fall through to a fresh start */ }
    return {
      body: emptyBody(),
      targets: { kcal: null, p: null, c: null, f: null, fi: null },
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
      tell('Could not save — storage is full or unavailable.');
    }
  }

  const planItems = () => state.meals.flatMap(m => m.items);
  const dayItems = day => [...Object.values(day.eaten || {}), ...(day.extras || [])];
  // Dates with at least one food logged, oldest first.
  const loggedDates = () => Object.keys(state.log).filter(d => dayItems(state.log[d]).length).sort();
  const hasTargets = () => NUTRIENTS.some(([k]) => state.targets[k] > 0);
  const dayLog = (date, create) => {
    if (!state.log[date] && create) state.log[date] = { eaten: {}, extras: [] };
    return state.log[date] || { eaten: {}, extras: [] };
  };

  // picker: { ctx, step: 'search' | 'qty', query, local, online, onlineState, onlineError, food, unit, qty }
  // ctx: { type: 'plan', mealId, itemId? } | { type: 'log' } | { type: 'check' }
  // orig: the suggested per-100 g values, kept once the user types their own macros.
  const newPicker = ctx => ({ ctx, step: 'search', query: '', local: [], online: null, onlineState: 'idle', food: null, unit: 0, qty: 1, orig: null });
  // suggest: { style, variant } while the suggested diet plan is open.
  // calCursor: any date inside the week/month the calendar is showing.
  // setup: true until sex, date of birth, height and weight are entered; the app shows only the setup screen meanwhile.
  const ui = { view: 'today', date: today(), calCursor: today(), calOpen: false, picker: null, check: newPicker({ type: 'check' }), suggest: null, setup: !bodyStats().bmr, guide: false };
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
      // Going past the protein or fiber target is not a problem, so those never turn red.
      bar = `<div class="bar${total > target && key !== 'p' && key !== 'fi' ? ' over' : ''}"><i style="width:${(base / scale) * 100}%"></i>${extra ? `<i class="extra" style="width:${(extra / scale) * 100}%"></i>` : ''}</div>`;
    }
    return `<div class="bar-row"><div class="bar-top"><span>${label}</span><span>${numbers}</span></div>${bar}</div>`;
  }
  const bars = (base, extra) => NUTRIENTS.map(m => barRow(m, base[m[0]], state.targets[m[0]], extra ? extra[m[0]] : 0)).join('');

  function tiles(m) {
    return `<div class="stats four">${MACROS.map(([k, label, unit]) =>
      `<div class="stat"><b>${fmtVal(k, m[k])}${k === 'kcal' ? '' : ' g'}</b><span>${k === 'kcal' ? 'kcal' : label}</span></div>`).join('')}</div>`;
  }

  // The macros and fiber as editable boxes, pre-filled with the suggested values.
  function macroInputs(m) {
    return NUTRIENTS.map(([k, label]) => `
      <label class="n-target">${label}<input data-n-field="macro" data-k="${k}" inputmode="decimal" autocomplete="off" value="${k === 'kcal' ? Math.round(m[k]) : r1(m[k])}"></label>`).join('');
  }
  // food.custom marks a food the user typed in themselves: one "serving" whose macros they enter.
  const per100 = f => (f.custom
    ? 'Your own food. Type the macros for one serving below, from the packet or a quick search.'
    : `Per 100 g: ${Math.round(f.kcal)} kcal · ${macroLine(f)} · ${esc(f.src || '')}`);
  const macroNote = pk => (pk.food.custom
    ? 'It is saved under this name, so next time it comes up when you search.'
    : pk.orig
      ? 'You changed these numbers. <button class="link-btn n-inline" data-n="reset-macros">Reset to suggested</button>'
      : 'Suggested values. Change any number if your portion is different.');

  // ---------- Food picker ----------

  function resultsHtml(pk) {
    const q = pk.query.trim();
    if (!q) return '<p class="sub n-hint">Type a food name. Common foods are built in; anything else can be searched on the internet.</p>';
    const local = searchLocal(q);
    pk.local = local.list;
    const row = (f, src, i) => `
      <button class="n-row" data-n="choose" data-src="${src}" data-i="${i}">
        <span class="n-main">${esc(f.name)}<span class="n-sub">${f.custom ? `${Math.round(f.kcal)} kcal per serving` : `${Math.round(f.kcal)} kcal per 100 g`} · ${macroLine(f)}${src === 'online' ? ' · ' + esc(f.src) : ''}</span></span><span class="p-pr">›</span>
      </button>`;
    let html = (local.partial && pk.local.length ? '<p class="group-label">Closest built-in foods</p>' : '') +
      pk.local.map((f, i) => row(f, 'local', i)).join('');
    if (q.length < 2) return html;

    if (pk.onlineState === 'idle') {
      html += `<button class="wide-btn" data-n="online">Search the internet for “${esc(q)}”</button>`;
    } else if (pk.onlineState === 'loading') {
      html += '<p class="sub n-hint">Searching the food databases…</p>';
    } else {
      const failed = pk.onlineFailed;
      if (pk.online.length) html += '<p class="group-label">From the internet</p>' + pk.online.map((f, i) => row(f, 'online', i)).join('');
      else if (!failed.length) html += `<p class="sub n-hint">Nothing found online for “${esc(q)}”. Try fewer words or the brand name.</p>`;
      if (failed.length) {
        html += `<p class="sub n-hint">${failed.length === 2
          ? (navigator.onLine === false ? 'No internet connection.' : 'The food databases did not respond. Wait a few seconds and try again.')
          : `${failed[0]} did not respond, so some results may be missing.`}</p>
          <button class="wide-btn" data-n="online">Try again</button>`;
      }
    }

    // Whatever was typed can always be logged by hand.
    return html + `
      <p class="group-label">Can’t find it?</p>
      <button class="wide-btn" data-n="manual">Enter the macros for “${esc(q)}” yourself</button>
      <a class="wide-btn n-link" href="https://www.google.com/search?q=${encodeURIComponent(q + ' calories protein carbs fat')}" target="_blank" rel="noopener">Look up “${esc(q)}” on Google</a>`;
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
      `<option value="${i}"${i === pk.unit ? ' selected' : ''}>${label === 'g' ? 'grams' : label === 'ml' ? 'ml' : f.custom ? esc(label) : `${esc(label)} (${g} g)`}</option>`).join('');
    const confirm = pk.ctx.type === 'plan'
      ? (pk.ctx.itemId ? 'Save' : `Add to ${state.meals.find(m => m.id === pk.ctx.mealId).name}`)
      : pk.ctx.type === 'log' ? `Add to ${ui.date === today() ? 'today' : fmtDate(ui.date)}` : 'I ate this — add to today';
    return `
      <section class="card">
        <div class="card-head"><h2>${esc(f.name)}</h2><button class="link-btn" data-n="back-search">Change</button></div>
        <p class="last" id="n-per100">${per100(f)}</p>
        <label class="n-q" for="n-qty">${esc(question(f, pk.unit))}</label>
        <div class="n-qty-row">
          <input id="n-qty" data-n-field="qty" inputmode="decimal" autocomplete="off" value="${pk.qty != null ? pk.qty : ''}">
          <select class="name-select" data-n-field="unit" aria-label="Unit">${unitOpts}</select>
        </div>
        <div class="n-targets" id="n-macros">${macroInputs(macrosOf(item))}</div>
        <p class="last" id="n-macro-note">${macroNote(pk)}</p>
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
    const found = await searchOnline(query);
    if (pk.query.trim() !== query) return;
    pk.online = found.foods;
    pk.onlineFailed = found.failed;
    pk.onlineState = 'done';
    if (activePicker() === pk && pk.step === 'search') refreshResults();
  }

  // ---------- Views ----------

  // withNote also shows how the food is meant to be prepared (suggested plans carry these notes).
  function itemRow(item, opts, withNote) {
    const m = macrosOf(item);
    const note = withNote && item.note ? `<span class="n-sub n-note">${esc(item.note)}</span>` : '';
    const main = `<span class="n-main">${esc(item.food.name)}<span class="n-sub">${esc(qtyText(item))} · ${macroLine(m)}</span>${note}</span><span class="n-kcal">${Math.round(m.kcal)} kcal</span>`;
    return opts(main);
  }

  function todayView() {
    const day = dayLog(ui.date, false);
    const planIds = new Set(planItems().map(i => i.id));
    // Ticked items that have since been removed from the plan still count for that day.
    const orphans = Object.values(day.eaten).filter(i => !planIds.has(i.id));
    const eaten = sum([...Object.values(day.eaten), ...day.extras]);
    const isToday = ui.date === today();

    const logged = loggedDates();
    const first = logged[0];
    const nothing = !isToday && !logged.includes(ui.date);
    let html = window.GymUI.calendar({
      cursor: ui.calCursor, open: ui.calOpen, selected: ui.date, attr: 'data-n', doneLabel: 'Food logged',
      // Days with nothing logged only count as missed once tracking has started.
      mark: d => (logged.includes(d) ? 'done' : first && d > first && d < today() ? 'missed' : ''),
    }) + `
      <div class="datebar${isToday ? '' : ' past'}">
        <span>${isToday ? 'Today · ' + fmtDate(ui.date) : toDate(ui.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        ${isToday ? '' : '<button class="link-btn" data-n="go-today">Back to today</button>'}
      </div>
      ${nothing ? `
        <section class="card missed">
          <h2>${first && ui.date > first ? 'Nothing logged' : 'No food logged'}</h2>
          <p class="last">${first && ui.date > first ? 'No food was logged on this day.' : 'This is before your first logged day.'} If you remember what you ate, tick it or add it below.</p>
        </section>` : ''}
      <section class="card">
        <h2>Eaten ${isToday ? 'so far' : 'that day'}</h2>
        ${bars(eaten)}
        ${state.targets.kcal > 0 ? `<p class="last">${eaten.kcal <= state.targets.kcal
          ? `${fmtVal('kcal', state.targets.kcal - eaten.kcal)} kcal left`
          : `${fmtVal('kcal', eaten.kcal - state.targets.kcal)} kcal over your target`}</p>` : ''}
      </section>`;

    // What the Workout tab logged for this date. Shown for information; it never changes the targets.
    const workout = window.GymUI.workoutBurn(ui.date);
    if (workout.logged) {
      html += `
        <section class="card">
          <h2>Workout ${isToday ? 'today' : 'that day'}</h2>
          ${workout.timed ? `
            <div class="stats two">
              <div class="stat"><b>≈ ${Math.round(workout.kcal)} kcal</b><span>Burned in ${workout.min} min</span></div>
              ${eaten.kcal > 0 ? `<div class="stat"><b>${fmtVal('kcal', eaten.kcal - workout.kcal)} kcal</b><span>Eaten minus burned</span></div>` : ''}
            </div>
            <p class="last">For information only: your calorie target stays the same. If your maintenance under Body already includes your training, these calories are already counted there.</p>`
            : '<p class="last">You logged a workout. Add the minutes for each exercise in the Workout tab to see the calories burned here.</p>'}
        </section>`;
    }

    if (!planIds.size) html += '<p class="sub n-hint">Your diet plan is empty. Build it under Diet plan and its meals will appear here to tick off.</p>';
    for (const meal of state.meals) {
      if (!meal.items.length) continue;
      const allDone = meal.items.every(i => day.eaten[i.id]);
      html += `
        <div class="n-meal-head"><p class="group-label">${esc(meal.name)}</p><button class="link-btn" data-n="tick-meal" data-meal="${meal.id}">${allDone ? 'Untick all' : 'Tick all'}</button></div>
        <section class="card n-list">${meal.items.map(item => itemRow(day.eaten[item.id] || item, main =>
          `<label class="n-item"><input type="checkbox" data-n-field="eaten" data-id="${item.id}"${day.eaten[item.id] ? ' checked' : ''}>${main}</label>`)).join('')}</section>`;
    }

    const loggedList = (items, kind) => `<section class="card n-list">${items.map(item => itemRow(item, main =>
      `<div class="n-item">${main}<button class="icon-btn danger" data-n="rm-logged" data-kind="${kind}" data-id="${item.id}" aria-label="Remove ${esc(item.food.name)}">✕</button></div>`)).join('')}</section>`;

    // Foods ticked while a different plan was in place: still counted for the day, but kept apart from extras.
    if (orphans.length) {
      html += `
        <div class="n-meal-head"><p class="group-label">Ticked from an earlier plan</p><button class="link-btn danger" data-n="rm-orphans">Remove all</button></div>
        <p class="sub">You ticked these before your plan changed. They still count towards this day; remove them if you did not eat them.</p>
        ${loggedList(orphans, 'eaten')}`;
    }
    html += '<p class="group-label">Outside the plan</p>';
    if (day.extras.length) html += loggedList(day.extras, 'extra');
    return html + '<button class="wide-btn" data-n="add-log">+ Add something else</button>';
  }

  function planView() {
    const total = sum(planItems());
    const targets = NUTRIENTS.map(([k, label, unit]) => `
      <label class="n-target">${label}<input data-n-field="target" data-k="${k}" inputmode="decimal" autocomplete="off" placeholder="${unit}" value="${state.targets[k] != null ? state.targets[k] : ''}"></label>`).join('');

    let html = `
      <section class="card">
        <h2>Daily targets</h2>
        <div class="n-targets">${targets}</div>
      </section>
      <section class="card">
        <h2>Plan total</h2>
        <div id="n-plan-total">${bars(total)}</div>
        ${planItems().length && hasTargets() ? `<p class="last">${NOT_EXACT}</p>` : ''}
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
              <button class="link-btn n-inline" data-n="edit-item" data-id="${item.id}">Edit</button>
              <button class="icon-btn danger" data-n="rm-item" data-id="${item.id}" aria-label="Remove ${esc(item.food.name)}">✕</button>
            </div>`, true)).join('')}
          <p class="last n-subtotal">${meal.items.length ? `${Math.round(m.kcal)} kcal · ${macroLine(m)}` : 'No foods yet'}</p>
          <button class="wide-btn" data-n="add-plan">+ Add food</button>
        </section>`;
    }

    return html + `
      <button class="wide-btn" data-n="add-meal">+ Add meal</button>
      ${planItems().length ? '<button class="wide-btn danger" data-n="clear-plan">Remove all foods from my plan</button>' : ''}
      <details class="card n-details">
        <summary>Internet search</summary>
        <p class="last">Foods that are not built in are looked up in two free databases: USDA FoodData Central and Open Food Facts. The USDA one runs on a shared key that allows only a few searches per hour. For more, get a free key at api.data.gov/signup and paste it here.</p>
        <input class="name-input" data-n-field="usda-key" placeholder="Your own key (optional)" value="${esc(state.usdaKey || '')}" autocomplete="off" autocapitalize="off" aria-label="USDA key">
      </details>`;
  }

  // ---------- Body ----------

  function ageFrom(dob) {
    const b = toDate(dob), now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
    return age;
  }

  // Resting burn by the Mifflin-St Jeor equation; maintenance is that times the activity multiplier.
  function bodyStats() {
    const b = state.body;
    const age = b.dob ? ageFrom(b.dob) : null;
    const complete = b.sex && b.weight > 0 && b.height > 0 && age != null && age >= 10 && age <= 110;
    const bmr = complete ? 10 * b.weight + 6.25 * b.height - 5 * age + (b.sex === 'male' ? 5 : -161) : null;
    // Maintenance comes from one of three places: the total typed in, resting burn plus typed-in
    // activity calories, or resting burn times the activity level.
    const custom = b.activity === 'custom';
    const active = b.activity === 'active';
    const level = ACTIVITY.find(a => a[0] === b.activity);
    const tdee = custom ? (b.customTdee > 0 ? b.customTdee : null)
      : active ? (bmr && b.activityKcal > 0 ? bmr + b.activityKcal : null)
        : level && bmr ? bmr * level[3] : null;
    return { age, bmr, tdee, custom, active };
  }

  // Calories an activity burns on top of resting, for the user's weight.
  const exerciseKcal = a => {
    // An activity the user added themselves carries the calories they typed.
    if (a.key === 'own') return a.kcal || 0;
    const met = (EXERCISES.find(e => e[0] === a.key) || EXERCISES[0])[2];
    return Math.max(0, met - 1) * (state.body.weight || 0) * ((a.minutes || 0) / 60);
  };
  // The worked-out activities, when there are any, set the activity calories.
  function recalcActivity() {
    const list = state.body.activities || [];
    if (list.length) state.body.activityKcal = Math.round(list.reduce((t, a) => t + exerciseKcal(a), 0));
  }

  function suggestedTargets(stats) {
    const [, , delta, proteinPerKg] = GOALS.find(g => g[0] === state.body.goal) || GOALS[1];
    // A cut never goes below the resting burn.
    const kcal = Math.round(Math.max(stats.tdee + delta, stats.bmr || 0) / 10) * 10;
    const p = Math.round(state.body.weight * proteinPerKg);
    const f = Math.round((kcal * 0.25) / 9);
    const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
    return { kcal, p, c, f, fi: Math.round((kcal / 1000) * FIBER_PER_1000_KCAL) };
  }

  function bodyResults() {
    const b = state.body;
    const stats = bodyStats();
    const missing = [!b.sex && 'sex', !b.dob && 'date of birth', !(b.height > 0) && 'height', !(b.weight > 0) && 'weight'].filter(Boolean);
    if (!stats.bmr && !stats.tdee) {
      return `<section class="card"><p class="last" style="margin:0">${stats.custom
        ? 'Type the calories you burn per day above.'
        : missing.length
          ? `Add your ${missing.join(', ')} to see how many calories you burn in a day.`
          : 'Check your date of birth — the age it gives is outside the range this estimate works for.'}</p></section>`;
    }

    const about = [
      stats.bmr ? `Age ${stats.age}. “At rest” is what your body burns doing nothing all day.` : `Add your ${missing.join(', ')} to also see your burn at rest.`,
      stats.custom
        ? (stats.tdee ? 'Maintenance is the number you typed in.' : 'Type the calories you burn per day above to see the rest.')
        : stats.active
          ? (stats.tdee
            ? `Maintenance is your burn at rest plus the ${fmtVal('kcal', b.activityKcal)} kcal of activity you entered: eat this much and your weight stays the same.`
            : stats.bmr ? 'Enter your activity calories above to see your maintenance calories.' : 'Your activity calories are added to your burn at rest, so the details above are needed first.')
          : (stats.tdee ? 'Maintenance adds your activity: eat this much and your weight stays the same.' : 'Choose your activity level above to see your maintenance calories.'),
      stats.bmr ? 'The calculated figures are estimates and can be off by around 10%.' : '',
    ].join(' ');
    let html = `
      <section class="card">
        <h2>Your daily calorie burn</h2>
        <div class="stats two">
          <div class="stat"><b>${stats.bmr ? fmtVal('kcal', stats.bmr) + ' kcal' : '—'}</b><span>At rest (BMR)</span></div>
          <div class="stat"><b>${stats.tdee ? fmtVal('kcal', stats.tdee) + ' kcal' : '—'}</b><span>Maintenance</span></div>
        </div>
        <p class="last">${about}</p>
      </section>`;
    if (!stats.tdee) return html;

    // The comparison uses the calorie target set under Diet plan; without one it falls back to the plan's foods.
    const plan = sum(planItems());
    const hasFoods = planItems().length > 0;
    const target = state.targets.kcal > 0 ? state.targets.kcal : null;
    if (target || hasFoods) {
      const basis = target || plan.kcal;
      const what = target ? `Your calorie target of ${fmtVal('kcal', target)} kcal` : `The foods in your plan (${fmtVal('kcal', plan.kcal)} kcal)`;
      const diff = Math.round(basis - stats.tdee);
      const perWeek = r1((Math.abs(diff) * 7) / KCAL_PER_KG);
      let verdict = Math.abs(diff) < 100
        ? `${what} is about at maintenance, so your weight should stay roughly the same.`
        : `${what} is ${Math.abs(diff).toLocaleString()} kcal ${diff < 0 ? 'below' : 'above'} maintenance. Eaten every day, that is roughly ${perWeek} kg ${diff < 0 ? 'lost' : 'gained'} per week.`;
      if (target && hasFoods) {
        const gap = Math.round(plan.kcal - target);
        verdict += Math.abs(gap) < 50
          ? ' The foods in your plan match that target.'
          : ` The foods in your plan add up to ${fmtVal('kcal', plan.kcal)} kcal, ${Math.abs(gap).toLocaleString()} kcal ${gap < 0 ? 'under' : 'over'} that target.`;
      } else if (target) {
        verdict += ' Your plan has no foods yet.';
      } else {
        verdict += ' Set a calorie target under Diet plan and the comparison will use it.';
      }
      const scale = Math.max(target || 0, plan.kcal, stats.tdee);
      const bar = (label, value, cls) => `
        <div class="bar-row"><div class="bar-top"><span>${label}</span><span><b>${fmtVal('kcal', value)}</b> kcal</span></div>
          <div class="bar"><i class="${cls}" style="width:${(value / scale) * 100}%"></i></div></div>`;
      html += `
        <section class="card">
          <h2>Your diet plan vs maintenance</h2>
          <p class="last">${verdict}</p>
          ${target ? bar('Your calorie target', target, '') : ''}
          ${hasFoods ? bar('Foods in your plan', plan.kcal, target ? 'soft' : '') : ''}
          ${bar('Maintenance', stats.tdee, 'extra')}
          ${hasFoods ? `<p class="last">Protein in your plan: ${r1(plan.p)} g${b.weight > 0 ? `, which is ${r1(plan.p / b.weight)} g per kg of body weight` : ''}.</p>` : ''}
          ${stats.bmr && basis < stats.bmr ? '<p class="last">That is below your burn at rest, which is very low to eat for long.</p>' : ''}
        </section>`;
    } else {
      html += '<section class="card"><h2>Your diet plan vs maintenance</h2><p class="last">Set a calorie target or add foods under Diet plan and the comparison appears here.</p></section>';
    }

    if (!(b.weight > 0)) {
      return html + '<section class="card"><h2>Suggested daily targets</h2><p class="last">Add your weight above to get suggested targets and a diet plan.</p></section>';
    }
    const t = suggestedTargets(stats);
    const goal = GOALS.find(g => g[0] === b.goal) || GOALS[1];
    html += `
      <section class="card">
        <h2>Suggested daily targets</h2>
        <div class="seg">${GOALS.map(g => `<button class="${g[0] === goal[0] ? 'on' : ''}" data-n="goal" data-goal="${g[0]}">${g[1]}</button>`).join('')}</div>
        <p class="last">${goal[2] === 0 ? 'Maintenance calories' : `${Math.abs(goal[2])} kcal ${goal[2] < 0 ? 'below' : 'above'} maintenance`}, ${goal[3]} g of protein per kg, a quarter of calories from fat, the rest from carbs.</p>
        ${tiles(t)}
        <p class="last">Fiber: ${t.fi} g a day (${FIBER_PER_1000_KCAL} g for every 1,000 kcal), from vegetables, fruit, whole grains and beans.</p>
        <button class="primary-btn" data-n="suggest-open">Suggest a diet plan for this</button>
        <button class="wide-btn" data-n="use-targets">Only use these as my daily targets</button>
      </section>`;
    return html;
  }

  // ---------- Suggested diet plan ----------

  const libFood = name => {
    const { hay, ...food } = LIB.find(f => f.name === name);
    return food;
  };
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  // Turn a template into a plan whose totals sit as close as real portions allow to the targets for
  // calories, protein, carbs and fat, with fiber at or above its target.
  function buildPlan(style, variant, target, weigh) {
    // How far each kind of food may move from its reference amount: [smallest, largest] as a multiple.
    const RANGE = { p: [0.6, 1.5], c: [0.5, 1.6], v: [1, 3], x: [0.25, 2.5] };
    const meals = PLANS[style][variant].map((list, i) => ({
      name: MEAL_NAMES[i],
      items: list.map(([name, unit, qty, role]) => {
        // Meat, fish and starches are listed raw or cooked as the user prefers.
        const raw = weigh === 'raw' && RAW[name];
        const food = libFood(raw ? raw[0] : name);
        const step = STEP[unit] || 1;
        const snap = x => Math.max(step, Math.round(x / step) * step);
        const base = raw ? snap(qty / raw[1]) : qty;
        return { id: uid(), food, unit: food.units.findIndex(u => u[0] === unit), qty: base, base, step, snap, role, cooked: name };
      }),
    }));
    const items = meals.flatMap(m => m.items);

    // Running totals as plain numbers: [kcal, protein, carbs, fat, fiber], plus each food's share per unit.
    const KEYS = ['kcal', 'p', 'c', 'f', 'fi'];
    const per = items.map(i => {
      const m = macrosOf({ ...i, qty: 1 });
      return KEYS.map(k => m[k]);
    });
    const goal = KEYS.map(k => Math.max(target[k] || 0, 1));
    const WEIGHT = [4, 2, 1, 1];
    // Reference amounts: the template's protein foods scaled together to the protein target, and its carb
    // foods scaled together to fill the remaining calories. A pull towards these keeps the meals balanced
    // instead of piling everything into one food.
    const part = role => KEYS.map((k, n) => items.reduce((s, it, j) => s + (it.role === role ? per[j][n] * it.base : 0), 0));
    const P = part('p'), C = part('c'), X = part('x'), V = part('v');
    let sp = 1, sc = 1;
    for (let pass = 0; pass < 4; pass++) {
      if (P[1] > 0) sp = clamp((target.p - C[1] * sc - X[1] - V[1]) / P[1], 0.5, 2.5);
      if (C[0] > 0) sc = clamp((target.kcal - P[0] * sp - X[0] - V[0]) / C[0], 0.3, 3.5);
    }
    for (const it of items) {
      it.ref = it.base * (it.role === 'p' ? sp : it.role === 'c' ? sc : 1);
      it.min = it.snap(it.ref * RANGE[it.role][0]);
      it.max = it.snap(it.ref * RANGE[it.role][1]);
      it.qty = clamp(it.snap(it.ref), it.min, it.max);
    }
    const pull = (i, qty) => 0.001 * ((qty - i.ref) / i.ref) ** 2;
    const score = (tot, drift) => {
      let e = drift;
      for (let n = 0; n < 4; n++) e += WEIGHT[n] * ((tot[n] - goal[n]) / goal[n]) ** 2;
      if (tot[4] < goal[4]) e += ((goal[4] - tot[4]) / goal[4]) ** 2;
      return e;
    };

    let total = KEYS.map((k, n) => items.reduce((s, it, j) => s + per[j][n] * it.qty, 0));
    let drift = items.reduce((s, it) => s + pull(it, it.qty), 0);
    let best = score(total, drift);

    // Each round tries every single change (one food up or down a step) and every pair of changes,
    // and keeps the one that brings the totals closest to the targets. Stops when nothing helps.
    const fits = (it, d) => it.qty + d * it.step >= it.min - 1e-9 && it.qty + d * it.step <= it.max + 1e-9;
    for (let round = 0; round < 600; round++) {
      let move = null;
      const consider = changes => {
        const tot = total.slice();
        let dr = drift;
        for (const [j, d] of changes) {
          const it = items[j];
          for (let n = 0; n < 5; n++) tot[n] += d * it.step * per[j][n];
          dr += pull(it, it.qty + d * it.step) - pull(it, it.qty);
        }
        const e = score(tot, dr);
        if (e < best - 1e-9 && (!move || e < move.e)) move = { e, changes, tot, dr };
      };
      for (let a = 0; a < items.length; a++) {
        for (const d of [1, -1]) {
          if (!fits(items[a], d)) continue;
          consider([[a, d]]);
          for (let b = a + 1; b < items.length; b++) {
            for (const d2 of [1, -1]) if (fits(items[b], d2)) consider([[a, d], [b, d2]]);
          }
        }
      }
      if (!move) break;
      for (const [j, d] of move.changes) items[j].qty = +(items[j].qty + d * items[j].step).toFixed(2);
      total = move.tot;
      drift = move.dr;
      best = move.e;
    }

    const round5 = g => Math.round(g / 5) * 5;
    for (const item of items) {
      // The note says how the food is prepared and gives the other weight (raw or cooked).
      const raw = RAW[item.cooked];
      item.note = !raw ? PREP[item.cooked] || ''
        : weigh === 'raw' ? `${PREP_RAW[raw[0]]} About ${round5(item.qty * raw[1])} g once cooked.`
          : `${PREP[item.cooked]} About ${round5(item.qty / raw[1])} g raw.`;
      for (const k of ['base', 'ref', 'step', 'snap', 'min', 'max', 'role', 'cooked']) delete item[k];
    }
    return meals;
  }

  function suggestPage() {
    const s = ui.suggest;
    const head = title => `
      <header class="top"><div class="top-row">
        <h1>${title}</h1>
        <button class="link-btn" data-n="suggest-close">Cancel</button>
      </div></header>`;

    const weigh = state.body.weigh || 'raw';
    const weighSeg = `
      <div class="seg">
        <button class="${weigh === 'raw' ? 'on' : ''}" data-n="suggest-weigh" data-weigh="raw">Raw weights</button>
        <button class="${weigh === 'cooked' ? 'on' : ''}" data-n="suggest-weigh" data-weigh="cooked">Cooked weights</button>
      </div>`;

    if (!s.style) {
      return head('Diet plan') + `
        <p class="sub n-hint">How do you weigh meat, fish, rice, pasta and potatoes?</p>
        ${weighSeg}
        <p class="sub n-hint">Raw means before cooking. Either way, each food also shows the other weight. Curries, daal and other cooked dishes are always weighed as served.</p>
        <p class="sub n-hint">What kind of food do you want in your plan?</p>
        ${STYLES.map(([key, , label, text]) => `
          <section class="card">
            <button class="p-row" data-n="suggest-style" data-style="${key}">
              <span class="p-name">${label}<span class="p-n">${text}</span></span><span class="p-pr">›</span>
            </button>
          </section>`).join('')}`;
    }

    const target = suggestedTargets(bodyStats());
    const goal = GOALS.find(g => g[0] === state.body.goal) || GOALS[1];
    s.meals = buildPlan(s.style, s.variant, target, weigh);
    const total = sum(s.meals.flatMap(m => m.items));
    const notes = [];
    if (total.fi < target.fi * 0.85) notes.push('Fiber is a little short of the target. More vegetables, fruit or beans would close the gap.');
    if (total.p < target.p * 0.9) notes.push('This style comes up short on protein. A protein shake or an extra protein portion would close the gap.');
    const off = MACROS.filter(([k]) => Math.abs(total[k] - target[k]) > target[k] * 0.1).map(m => m[1].toLowerCase());
    if (off.length) notes.push(`With this style's foods, ${off.join(' and ')} could not be brought within 10% of the target. Another style or option may fit better.`);
    notes.push(NOT_EXACT);

    return head('Suggested plan') + `
      <div class="chips">${STYLES.map(([key, short]) =>
        `<button class="day-btn${key === s.style ? ' on' : ''}" data-n="suggest-style" data-style="${key}">${short}</button>`).join('')}</div>
      ${weighSeg}
      ${LEGEND}
      <section class="card">
        <h2>${goal[1]}: plan vs targets</h2>
        ${NUTRIENTS.map(m => barRow(m, total[m[0]], target[m[0]], 0)).join('')}
        ${notes.map(n => `<p class="last">${n}</p>`).join('')}
      </section>
      ${s.meals.map(meal => {
        const m = sum(meal.items);
        return `
          <p class="group-label">${meal.name} · ${Math.round(m.kcal)} kcal</p>
          <section class="card n-list">${meal.items.map(item => itemRow(item, main => `<div class="n-item">${main}</div>`, true)).join('')}</section>`;
      }).join('')}
      <section class="card">
        <h2>How to cook this plan</h2>
        <ul class="n-rules">
          <li>${weigh === 'raw'
            ? 'Meat, fish, rice, pasta and potatoes are listed at their raw weight: weigh them before cooking. Each note also gives the cooked weight.'
            : 'Meat, fish, rice, pasta and potatoes are listed at their cooked weight: weigh them after cooking. Each note also gives the raw weight.'}</li>
          <li>Curries, daal, biryani and other cooked dishes are weighed as served.</li>
          <li>Grill, bake, boil, steam or air-fry. Nothing in this plan is deep-fried.</li>
          <li>The only oil is what each food’s note says or what is listed as its own item. Every extra teaspoon of oil, ghee or butter adds about 40 kcal.</li>
          <li>Curries and daal are home-cooked with little oil. Restaurant and takeaway versions can have double the calories.</li>
          <li>Salt, spices, lemon, garlic, chilli and vinegar are free. Sauces, mayo and sugar are not: add them as foods if you use them.</li>
        </ul>
      </section>
      <p class="sub n-hint">A starting point built from typical foods and average portions, not advice from a dietitian. You can change any food or amount after saving.</p>
      <button class="primary-btn" data-n="suggest-use">Use this plan and these targets</button>
      <button class="wide-btn" data-n="suggest-other">Show me another option</button>`;
  }

  // Google search for what the user's own activity burns, filled in with their minutes and weight.
  const ownLink = a => 'https://www.google.com/search?q=' + encodeURIComponent(
    `calories burned ${a.name || 'activity'} ${a.minutes || 30} minutes${state.body.weight > 0 ? ` ${state.body.weight} kg` : ''}`);

  // Activity calories: typed in directly, or added up from a list of activities and minutes.
  function activityHtml() {
    const b = state.body;
    const list = b.activities || [];
    const rows = list.map((a, i) => `
      <div class="n-act" data-i="${i}">
        <select class="name-select" data-n-field="act-key" aria-label="Activity">${EXERCISES.map(e =>
          `<option value="${e[0]}"${e[0] === a.key ? ' selected' : ''}>${e[1]}</option>`).join('')}
          <option value="own"${a.key === 'own' ? ' selected' : ''}>Other — add your own</option></select>
        <input data-n-field="act-min" inputmode="decimal" autocomplete="off" placeholder="min" aria-label="Minutes per day" value="${a.minutes != null ? a.minutes : ''}">
        ${a.key === 'own'
          ? `<input class="n-act-own-kcal" data-n-field="act-kcal" inputmode="decimal" autocomplete="off" placeholder="kcal" aria-label="Calories burned" value="${a.kcal != null ? a.kcal : ''}">`
          : `<span class="n-act-kcal">${Math.round(exerciseKcal(a))} kcal</span>`}
        <button class="icon-btn danger" data-n="act-rm" aria-label="Remove activity">✕</button>
      </div>
      ${a.key === 'own' ? `
        <div class="n-act-own" data-i="${i}">
          <input class="name-input" data-n-field="act-name" placeholder="Activity name, e.g. boxing" autocomplete="off" value="${esc(a.name || '')}">
          <a class="link-btn n-inline" href="${ownLink(a)}" target="_blank" rel="noopener">Find its calories on Google, then type them in the kcal box</a>
        </div>` : ''}`).join('');
    return `
      <label class="n-target n-activity">Calories you burn through activity per day (kcal)
        <input data-n-field="body" data-k="activityKcal" inputmode="decimal" autocomplete="off" placeholder="e.g. 500" value="${b.activityKcal != null ? b.activityKcal : ''}">
      </label>
      <p class="last">The app adds this to your burn at rest. Count everything you do in a day, not only the gym: walking, work, chores.</p>
      <p class="last"><b>Where to get the number:</b> a fitness watch or your phone’s health app shows it as “active calories”. Or search Google for “calories burned” with the activity, the minutes and your weight. Or add your activities below and the app works it out.</p>
      <a class="link-btn n-inline" href="https://www.google.com/search?q=calories+burned+calculator+by+activity" target="_blank" rel="noopener">Search Google for a calories-burned calculator</a>
      <p class="group-label">Work it out from your day</p>
      ${b.weight > 0 ? '' : '<p class="last">Add your weight above first; the calories depend on it.</p>'}
      ${rows}
      <button class="wide-btn" data-n="act-add">+ Add an activity</button>
      ${list.length ? '<p class="last">Minutes per day, averaged over the week. The total fills in the box above.</p>' : ''}`;
  }

  function bodyView() {
    const b = state.body;
    const sexBtn = (v, label) => `<button class="${b.sex === v ? 'on' : ''}" data-n="sex" data-sex="${v}">${label}</button>`;
    return `
      <section class="card">
        <h2>Your details</h2>
        <div class="seg">${sexBtn('male', 'Male')}${sexBtn('female', 'Female')}</div>
        <div class="n-form">
          <label class="n-target">Date of birth<input type="date" data-n-field="body" data-k="dob" value="${esc(b.dob)}" max="${today()}"></label>
          <label class="n-target">Height (cm)<input data-n-field="body" data-k="height" inputmode="decimal" autocomplete="off" value="${b.height != null ? b.height : ''}"></label>
          <label class="n-target">Weight (kg)<input data-n-field="body" data-k="weight" inputmode="decimal" autocomplete="off" value="${b.weight != null ? b.weight : ''}"></label>
        </div>
        <label class="n-target n-activity">Daily activity level
          <select class="name-select" data-n-field="activity">
            <option value="">Not set</option>
            ${ACTIVITY.map(a => `<option value="${a[0]}"${b.activity === a[0] ? ' selected' : ''}>${a[1]} — ${a[2]}</option>`).join('')}
            <option value="active"${b.activity === 'active' ? ' selected' : ''}>I know my activity calories — type them in</option>
            <option value="custom"${b.activity === 'custom' ? ' selected' : ''}>I know my total daily burn — type it in</option>
          </select>
        </label>
        ${b.activity === 'custom' ? `
          <label class="n-target n-activity">Total calories you burn per day (kcal)
            <input data-n-field="body" data-k="customTdee" inputmode="decimal" autocomplete="off" placeholder="e.g. 2600" value="${b.customTdee != null ? b.customTdee : ''}">
          </label>
          <p class="last">This is everything: your burn at rest plus all activity. If you only know what your activity burns, choose “I know my activity calories” instead.</p>` : ''}
        ${ACTIVITY.some(a => a[0] === b.activity) ? `
          <p class="last">These preset levels are rough multipliers, and they often come out too high, especially the top two. For a closer figure, add up what you actually do in a day instead, and compare the result with another calculator before you rely on it.</p>
          <button class="wide-btn" data-n="act-switch">Work it out from my activities instead</button>` : ''}
        ${b.activity === 'active' ? activityHtml() : ''}
      </section>
      <div id="n-body-results">${bodyResults()}</div>
      <button class="wide-btn" data-n="guide-open">How to use the app</button>`;
  }

  // ---------- Progress (rendered inside the Progress tab) ----------

  function progressHtml() {
    const days = loggedDates().map(date => ({ date, ...sum(dayItems(state.log[date])) }));
    if (!days.length) return '<p class="empty">Tick off your meals or add foods under Nutrition → Today, and your eating history builds up here.</p>';

    const t = state.targets;
    const weekStart = addDays(today(), -6);
    const week = days.filter(d => d.date >= weekStart);
    const avg = k => (week.length ? week.reduce((s, d) => s + d[k], 0) / week.length : 0);
    const onTarget = t.kcal > 0 ? week.filter(d => Math.abs(d.kcal - t.kcal) <= t.kcal * 0.1).length : null;
    const recent = days.slice(-30);
    const chartCard = ([k, label, unit]) => `
      <section class="card">
        <p class="sub">${label} per day${t[k] > 0 ? ` · dashed line is your ${fmtVal(k, t[k])} ${unit} target` : ''}</p>
        ${window.GymUI.chart(recent.map(d => ({ date: d.date, v: k === 'kcal' ? Math.round(d[k]) : r1(d[k]) })), t[k])}
      </section>`;

    return `
      <p class="group-label">Last 7 days · ${week.length} of 7 logged</p>
      ${week.length ? `
        <div class="stats four">
          <div class="stat"><b>${fmtVal('kcal', avg('kcal'))}</b><span>kcal / day</span></div>
          <div class="stat"><b>${Math.round(avg('p'))} g</b><span>Protein</span></div>
          <div class="stat"><b>${Math.round(avg('fi'))} g</b><span>Fiber</span></div>
          <div class="stat"><b>${onTarget == null ? '—' : `${onTarget}/${week.length}`}</b><span>On target</span></div>
        </div>
        <p class="sub n-hint">Averages over the days you logged. “On target” counts days within 10% of your calorie target${onTarget == null ? '; set one under Nutrition → Diet plan' : ''}.</p>`
        : '<p class="sub n-hint">Nothing logged in the last 7 days.</p>'}
      ${[NUTRIENTS[0], NUTRIENTS[1], NUTRIENTS[4]].map(chartCard).join('')}
      <p class="group-label">Day by day</p>
      <section class="card">
        <ul class="h-lines" style="margin:0">${[...days].reverse().slice(0, 30).map(d =>
          `<li><b>${fmtDate(d.date)}</b> <span>${fmtVal('kcal', d.kcal)} kcal · ${macroLine(d)}</span></li>`).join('')}</ul>
      </section>`;
  }

  // ---------- First-run setup ----------

  // Shows what is still missing, or the result and the button to continue.
  function setupStatus() {
    const b = state.body;
    const stats = bodyStats();
    if (stats.bmr) {
      return `
        <section class="card">
          <h2>All set</h2>
          <p class="last">At ${stats.age}, your body burns about <b>${fmtVal('kcal', stats.bmr)} kcal</b> a day at rest. You can change these details any time under Nutrition → Body, where you can also add your activity level.</p>
        </section>
        <button class="primary-btn" data-n="setup-done">Continue</button>`;
    }
    const missing = [!b.sex && 'sex', !b.dob && 'date of birth', !(b.height > 0) && 'height', !(b.weight > 0) && 'weight'].filter(Boolean);
    return `<p class="sub n-hint">${missing.length
      ? `Still needed: ${missing.join(', ')}.`
      : 'Check your date of birth: the age it gives is outside the range the calculation works for.'}</p>
      <button class="primary-btn" disabled>Continue</button>`;
  }

  function setupPage() {
    const b = state.body;
    const sexBtn = (v, label) => `<button class="${b.sex === v ? 'on' : ''}" data-n="sex" data-sex="${v}">${label}</button>`;
    return `
      <header class="top"><div class="top-row"><h1>Welcome</h1></div></header>
      <p class="sub n-hint">Before you start, the app needs four details about you. It uses them to work out how many calories your body burns, which your diet targets and workout calorie estimates depend on. They are stored only on this phone.</p>
      <section class="card">
        <h2>About you</h2>
        <div class="seg">${sexBtn('male', 'Male')}${sexBtn('female', 'Female')}</div>
        <div class="n-form">
          <label class="n-target">Date of birth<input type="date" data-n-field="body" data-k="dob" value="${esc(b.dob)}" max="${today()}"></label>
          <label class="n-target">Height (cm)<input data-n-field="body" data-k="height" inputmode="decimal" autocomplete="off" value="${b.height != null ? b.height : ''}"></label>
          <label class="n-target">Weight (kg)<input data-n-field="body" data-k="weight" inputmode="decimal" autocomplete="off" value="${b.weight != null ? b.weight : ''}"></label>
        </div>
      </section>
      <div id="n-setup-status">${setupStatus()}</div>`;
  }

  // A one-screen tour: shown once after setup, and again from Nutrition → Body whenever wanted.
  const GUIDE = [
    ['Workout', 'Pick your split, then choose an exercise in each box. For every set type the weight (kg or plates) and reps, and the minutes the exercise took. The app shows last time’s numbers, flags new records and estimates calories burned.'],
    ['Diet plan', 'Under Nutrition → Body you see your daily calorie burn. Tap “Suggest a diet plan” to get a plan and targets for your goal, or build your own under Diet plan.'],
    ['Today', 'Tick each food as you eat it. Anything outside your plan goes in with “+ Add something else”. The bars show what is left for the day.'],
    ['Check food', 'Before eating something unplanned, look it up: you get its macros and whether it fits your targets.'],
    ['History and Progress', 'History lists every workout. Progress shows your records and charts for both training and eating. On any calendar, tap a past date to see that day.'],
  ];

  function guidePage() {
    return `
      <header class="top"><div class="top-row"><h1>How to use the app</h1></div></header>
      ${GUIDE.map(([title, text], i) => `
        <section class="card guide-step">
          <span class="guide-n">${i + 1}</span>
          <div><h2>${title}</h2><p class="last">${text}</p></div>
        </section>`).join('')}
      <p class="sub n-hint">Everything you enter is saved on this phone only. Always open the app from its Home Screen icon, or your data will not be there.</p>
      <button class="primary-btn" data-n="guide-done">${state.guideSeen ? 'Close' : 'Start'}</button>`;
  }

  function render() {
    const app = $('#app');
    if (ui.setup) {
      app.innerHTML = setupPage();
      return;
    }
    if (ui.guide) {
      app.innerHTML = guidePage();
      return;
    }
    if (ui.suggest) {
      app.innerHTML = suggestPage();
      return;
    }
    if (ui.picker) {
      const titles = { plan: ui.picker.ctx.itemId ? 'Edit food' : 'Add to plan', log: 'Add food' };
      app.innerHTML = `
        <header class="top"><div class="top-row">
          <h1>${titles[ui.picker.ctx.type]}</h1>
          <button class="link-btn" data-n="close-picker">Cancel</button>
        </div></header>
        ${LEGEND}
        <div class="n-picker">${pickerBody(ui.picker)}</div>`;
      return;
    }
    const seg = [['today', 'Today'], ['plan', 'Diet plan'], ['check', 'Check food'], ['body', 'Body']].map(([v, label]) =>
      `<button class="${ui.view === v ? 'on' : ''}" data-n="view" data-view="${v}">${label}</button>`).join('');
    app.innerHTML = `
      <header class="top">
        <div class="top-row"><h1>Nutrition</h1></div>
        <div class="seg">${seg}</div>
      </header>
      ${ui.view === 'body' ? '' : LEGEND}
      ${ui.view === 'plan' ? planView() : ui.view === 'body' ? bodyView() : ui.view === 'check'
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
    sex(el) { state.body.sex = el.dataset.sex; save(); render(); },
    'setup-done'() {
      if (!bodyStats().bmr) return;
      ui.setup = false;
      ui.guide = true;
      window.GymUI.render();
      window.scrollTo(0, 0);
    },
    'guide-open'() { ui.guide = true; window.GymUI.render(); window.scrollTo(0, 0); },
    'guide-done'() {
      ui.guide = false;
      state.guideSeen = true;
      save();
      window.GymUI.render();
      window.scrollTo(0, 0);
    },
    goal(el) {
      state.body.goal = el.dataset.goal;
      save();
      $('#n-body-results').innerHTML = bodyResults();
    },
    'act-switch'() { state.body.activity = 'active'; save(); render(); },
    'act-add'() {
      state.body.activities = [...(state.body.activities || []), { key: 'walk', minutes: null }];
      recalcActivity();
      save(); render();
      const inputs = document.querySelectorAll('[data-n-field="act-min"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    },
    'act-rm'(el) {
      state.body.activities.splice(+el.closest('.n-act').dataset.i, 1);
      recalcActivity();
      save(); render();
    },
    async 'use-targets'() {
      if (hasTargets() && !(await ask('Replace your current daily targets with these?', 'Replace'))) return;
      state.targets = suggestedTargets(bodyStats());
      ui.view = 'plan';
      save(); render();
      window.scrollTo(0, 0);
    },
    'suggest-open'() { ui.suggest = { style: null, variant: 0 }; render(); window.scrollTo(0, 0); },
    'suggest-close'() { ui.suggest = null; render(); },
    'suggest-style'(el) { ui.suggest.style = el.dataset.style; ui.suggest.variant = 0; render(); window.scrollTo(0, 0); },
    'suggest-weigh'(el) { state.body.weigh = el.dataset.weigh; save(); render(); },
    'suggest-other'() {
      ui.suggest.variant = (ui.suggest.variant + 1) % PLANS[ui.suggest.style].length;
      render();
      window.scrollTo(0, 0);
    },
    async 'suggest-use'() {
      if (planItems().length) {
        const ticked = Object.keys(dayLog(today(), false).eaten).length;
        const message = 'Replace your current diet plan with this one?' + (ticked
          ? ` The ${ticked} food${ticked === 1 ? '' : 's'} you already ticked today stay${ticked === 1 ? 's' : ''} in today’s log; you can remove them there.`
          : '');
        if (!(await ask(message, 'Replace'))) return;
      }
      state.meals = ui.suggest.meals.map(m => ({ id: uid(), name: m.name, items: m.items }));
      state.targets = suggestedTargets(bodyStats());
      ui.suggest = null;
      ui.view = 'plan';
      save(); render();
      window.scrollTo(0, 0);
    },
    'cal-toggle'() { ui.calOpen = !ui.calOpen; ui.calCursor = ui.date; render(); },
    'cal-prev'() { moveCalendar(-1); },
    'cal-next'() { moveCalendar(1); },
    'cal-pick'(el) { ui.date = ui.calCursor = el.dataset.date; render(); },
    'go-today'() { ui.date = ui.calCursor = today(); render(); },

    'add-plan'(el) { ui.picker = newPicker({ type: 'plan', mealId: el.closest('[data-meal]').dataset.meal }); openPicker(); },
    'add-log'() { ui.picker = newPicker({ type: 'log' }); openPicker(); },
    'edit-item'(el) {
      const { meal, item } = findItem(el.dataset.id);
      ui.picker = { ...newPicker({ type: 'plan', mealId: meal.id, itemId: item.id }), step: 'qty', food: { ...item.food }, unit: item.unit, qty: item.qty };
      render();
      window.scrollTo(0, 0);
    },
    'close-picker'() { ui.picker = null; render(); },

    online() { runOnline(activePicker()); },
    choose(el) {
      const pk = activePicker();
      const { hay, branded, ...food } = (el.dataset.src === 'online' ? pk.online : pk.local)[+el.dataset.i];
      if (el.dataset.src === 'online' && !state.saved.some(f => f.name === food.name)) {
        state.saved.unshift({ ...food });
        state.saved.length = Math.min(state.saved.length, 100);
        save();
      }
      Object.assign(pk, { step: 'qty', food, unit: 0, qty: defaultQty(food, 0), orig: null });
      render();
      window.scrollTo(0, 0);
      const input = $('#n-qty');
      if (input) { input.focus(); input.select(); }
    },
    manual() {
      const pk = activePicker();
      const typed = pk.query.trim();
      const food = { name: typed.charAt(0).toUpperCase() + typed.slice(1), kcal: 0, p: 0, c: 0, f: 0, fi: 0, units: [['serving', 100]], src: 'Entered by you', custom: true };
      Object.assign(pk, { step: 'qty', food, unit: 0, qty: 1, orig: null });
      render();
      window.scrollTo(0, 0);
      const input = $('[data-n-field="macro"]');
      if (input) { input.focus(); input.select(); }
    },
    'reset-macros'() {
      const pk = activePicker();
      Object.assign(pk.food, pk.orig);
      pk.orig = null;
      render();
    },
    'back-search'() {
      activePicker().step = 'search';
      render();
      const input = $('.n-search');
      if (input) input.focus();
    },
    confirm() {
      const pk = activePicker();
      if (!(pk.qty > 0)) return tell('Enter an amount first.');
      if (pk.food.custom) {
        if (!(pk.food.kcal > 0 || pk.food.p > 0 || pk.food.c > 0 || pk.food.f > 0)) return tell('Type the macros for one serving first.');
        // Keep the user's own food so it shows up in search next time.
        state.saved = [{ ...pk.food }, ...state.saved.filter(f => f.name.toLowerCase() !== pk.food.name.toLowerCase())].slice(0, 100);
      }
      const item = pickerItem(pk);
      if (pk.ctx.type === 'plan') {
        const meal = state.meals.find(m => m.id === pk.ctx.mealId);
        const old = pk.ctx.itemId && meal.items.find(i => i.id === pk.ctx.itemId);
        // A preparation note only holds for the food it was written for.
        if (old && old.food.name !== item.food.name) delete old.note;
        if (old) Object.assign(old, { food: item.food, unit: item.unit, qty: item.qty });
        else meal.items.push(item);
        ui.view = 'plan';
      } else {
        // The checker always logs to today; "add something else" logs to the day being viewed.
        if (pk.ctx.type === 'check') ui.date = ui.calCursor = today();
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
    async 'clear-plan'() {
      if (!(await ask('Remove every food from your diet plan? Your meals and targets stay.', 'Remove all', true))) return;
      for (const meal of state.meals) meal.items = [];
      save(); render();
    },
    'add-meal'() {
      state.meals.push({ id: uid(), name: 'New meal', items: [] });
      save(); render();
    },
    async 'rm-meal'(el) {
      const meal = state.meals.find(m => m.id === el.closest('[data-meal]').dataset.meal);
      if (meal.items.length && !(await ask(`Delete "${meal.name}" and its ${meal.items.length} food${meal.items.length === 1 ? '' : 's'} from your plan?`, 'Delete', true))) return;
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
    'rm-orphans'() {
      const day = dayLog(ui.date, true);
      const planIds = new Set(planItems().map(i => i.id));
      for (const id of Object.keys(day.eaten)) if (!planIds.has(id)) delete day.eaten[id];
      save(); render();
    },
    'rm-logged'(el) {
      const day = dayLog(ui.date, true);
      if (el.dataset.kind === 'eaten') delete day.eaten[el.dataset.id];
      else day.extras = day.extras.filter(i => i.id !== el.dataset.id);
      save(); render();
    },
  };

  // Step the calendar by a week, or by a month when it is expanded.
  function moveCalendar(dir) {
    const cur = toDate(ui.calCursor);
    ui.calCursor = ui.calOpen ? isoDate(new Date(cur.getFullYear(), cur.getMonth() + dir, 1)) : addDays(ui.calCursor, 7 * dir);
    render();
  }

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

  // Re-total the worked-out activities and show the new numbers without redrawing the form.
  function syncActivity() {
    const list = state.body.activities || [];
    if (!list.length) return;
    recalcActivity();
    const total = $('[data-k="activityKcal"]');
    if (total) total.value = state.body.activityKcal;
    document.querySelectorAll('.n-act').forEach((row, i) => {
      const label = $('.n-act-kcal', row);
      if (list[i] && label) label.textContent = `${Math.round(exerciseKcal(list[i]))} kcal`;
    });
  }

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
      $('#n-macros').innerHTML = macroInputs(macrosOf(pickerItem(pk)));
      if (pk.ctx.type === 'check') $('#n-effect').innerHTML = effectHtml(pk);
    } else if (field === 'macro') {
      // A typed macro is stored as the food's per-100 g value, so it still scales with the amount.
      const grams = (pk.qty || 0) * pk.food.units[pk.unit][1];
      const value = parseNum(el.value);
      if (!(grams > 0) || value == null) return;
      const k = el.dataset.k;
      if (!pk.food.custom) {
        if (!pk.orig) pk.orig = { kcal: pk.food.kcal, p: pk.food.p, c: pk.food.c, f: pk.food.f, fi: pk.food.fi, src: pk.food.src };
        pk.food.src = 'Edited by you';
      }
      pk.food[k] = (value / grams) * 100;
      $('#n-per100').innerHTML = per100(pk.food);
      $('#n-macro-note').innerHTML = macroNote(pk);
      if (pk.ctx.type === 'check') $('#n-effect').innerHTML = effectHtml(pk);
    } else if (field === 'target') {
      state.targets[el.dataset.k] = parseNum(el.value);
      save();
      $('#n-plan-total').innerHTML = bars(sum(planItems()));
    } else if (field === 'body') {
      state.body[el.dataset.k] = el.dataset.k === 'dob' ? el.value : parseNum(el.value);
      // The worked-out activity calories depend on body weight.
      if (el.dataset.k === 'weight') syncActivity();
      save();
      if (ui.setup) $('#n-setup-status').innerHTML = setupStatus();
      else $('#n-body-results').innerHTML = bodyResults();
    } else if (field === 'act-min' || field === 'act-kcal' || field === 'act-name') {
      const row = el.closest('[data-i]');
      const a = state.body.activities[+row.dataset.i];
      if (field === 'act-name') a.name = el.value.trim();
      else a[field === 'act-min' ? 'minutes' : 'kcal'] = parseNum(el.value);
      const link = $(`.n-act-own[data-i="${row.dataset.i}"] a`);
      if (link) link.href = ownLink(a);
      syncActivity();
      save();
      $('#n-body-results').innerHTML = bodyResults();
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
    } else if (field === 'act-key') {
      state.body.activities[+el.closest('.n-act').dataset.i].key = el.value;
      recalcActivity();
      save(); render();
    } else if (field === 'activity') {
      state.body.activity = el.value;
      save();
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
    home() { ui.picker = null; ui.suggest = null; ui.view = 'today'; ui.date = ui.calCursor = today(); render(); },
    progressHtml,
    // True while the setup screen or the how-to-use tour covers the app.
    inSetup: () => ui.setup || ui.guide,
    // Used by the Workout tab's calorie estimate; null until it is entered under Body.
    bodyWeight: () => (state.body.weight > 0 ? state.body.weight : null),
  };
})();
