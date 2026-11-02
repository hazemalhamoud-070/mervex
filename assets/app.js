/* Mervex shop. Views render from window.CATALOG plus fabrics added in the admin page.
   GSAP drives the homepage motion; everything still works if it fails to load. */
(function () {
  const WHATSAPP = '31684647141';
  const MIN_M = 1, STEP_M = .5, SAMPLE = 4.5;
  const MODELS = ['zeemeermin', 'prinses', 'kaftan'];
  // Example delivery prices until the shop sets its own.
  const SHIP = { NL: 6.95, BE: 9.95, DE: 9.95, LU: 9.95, FR: 14.95, AT: 14.95, IT: 14.95, ES: 14.95, PT: 14.95, PL: 14.95, DK: 14.95, SE: 14.95, IE: 14.95 };
  const WAREHOUSES = [['winkel', 'المحل بيفرفيك'], ['magazijn', 'المخزن التاني']];
  const COLLECTIONS = [['kant', 'col-kant', '#kleur-paars'], ['3d', 'col-3d', '#p-3d-bloemen'], ['pailletten', 'col-pailletten', '#p-bladkant-parel'], ['tule', 'col-tule', '#p-luxe-tule'], ['kristal', 'col-kristal', '#p-madelief-couture'], ['bruid', 'col-bruid', '#gebruik-trouwen']];
  const ATELIER = ['3d-bloemen', 'bladkant-parel', 'franse-kant', 'luxe-tule', 'fluweelblad'];
  const RING = '<svg class="ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="56"/><circle cx="60" cy="60" r="49"/><text x="60" y="71">MX</text></svg>';
  const LOCALE = { nl: 'nl-NL', en: 'en-IE', ar: 'ar-AE-u-nu-latn', tr: 'tr-TR' };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  for (const p of CATALOG) {
    const f = I18N_FABRICS[p.slug];
    if (f) { p.ar = f[0]; p.textAr = f[1]; p.tr = f[2]; p.textTr = f[3]; }
    for (const c of p.colours) {
      const n = I18N_COLOURS[c.nl];
      if (n) { c.ar = n[0]; c.tr = n[1]; }
    }
  }

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* preview frames can block storage */ } }
  };
  const guess = (navigator.language || 'nl').slice(0, 2);
  const state = { lang: store.get('mx-lang', LANGS[guess] ? guess : 'nl'), cart: store.get('mx-cart', []), colour: null, type: null, use: null, country: store.get('mx-country', 'NL'), order: '', atelier: ATELIER[0] };
  const t = () => TEXT[state.lang];
  const rtl = () => state.lang === 'ar';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Added fabrics, stock per warehouse and orders: shared when the page runs on claude.ai, otherwise kept in this browser.
  const Live = { db: null, assets: null, admin: /^(localhost|127\.0\.0\.1)$/.test(location.hostname), fabrics: store.get('mx-fabrics', []), stock: store.get('mx-stock', {}), orders: store.get('mx-orders', []) };
  const keep = () => { if (!Live.db) { store.set('mx-fabrics', Live.fabrics); store.set('mx-stock', Live.stock); store.set('mx-orders', Live.orders); } };
  function put(coll, id, doc) {
    if (coll === 'stock') Live.stock[id] = doc;
    else { Live[coll] = Live[coll].filter(x => x.id !== id); Live[coll].unshift({ ...doc, id }); }
    keep();
    if (Live.db) Live.db.doc(coll + '/' + id).set(doc).catch(() => toast(t().saveFail));
  }
  function drop(coll, id) {
    Live[coll] = Live[coll].filter(x => x.id !== id); keep();
    if (Live.db) Live.db.doc(coll + '/' + id).delete();
  }
  async function connect() {
    if (!window.claude || !window.claude.use) return;
    const [db, assets, user] = await Promise.all(['db', 'assets', 'user'].map(n => window.claude.use(n)));
    Live.assets = assets;
    if (user && await user.canEdit()) Live.admin = true;
    if (db) {
      Live.db = db;
      const watch = (coll, apply) => db.collection(coll).onSnapshot(s => { apply(s.docs.map(d => ({ ...d.data(), id: d.id }))); refresh(); });
      watch('fabrics', r => { Live.fabrics = r; });
      watch('orders', r => { Live.orders = r.sort((x, y) => y.created - x.created); });
      watch('stock', r => { Live.stock = Object.fromEntries(r.map(x => [x.id, x])); });
    }
    chrome(); refresh();
  }
  const fabrics = () => [...Live.fabrics, ...CATALOG];
  const stockSplit = c => Live.stock[c.id] || { winkel: c.stock || 0, magazijn: 0 };
  const stockOf = c => { const s = stockSplit(c); return (+s.winkel || 0) + (+s.magazijn || 0); };

  const eur = n => new Intl.NumberFormat(LOCALE[state.lang], { style: 'currency', currency: 'EUR' }).format(n);
  const m = n => String(n).replace('.', state.lang === 'nl' || state.lang === 'tr' ? ',' : '.');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const name = (p, lang = state.lang) => p[lang] || p.en || p.nl;
  const cn = (c, lang = state.lang) => c[lang] || c.en || c.nl;
  const desc = p => ({ nl: p.textNl, en: p.textEn, ar: p.textAr, tr: p.textTr })[state.lang] || p.textEn || p.textNl;
  const famName = f => { const a = FAMILIES[f], b = I18N_FAMILIES[f]; return { nl: a[0], en: a[1], ar: b[0], tr: b[1] }[state.lang]; };
  const img = (id, small) => { for (const p of Live.fabrics) for (const c of p.colours) if (c.id === id && c.url) return c.url; return 'img/' + id + (small ? '-s' : '') + '.webp'; };
  const modelImg = (slug, k) => 'img/model/' + slug + '-' + k + '.webp';
  const brand = n => 'img/brand/' + n + '.webp';
  const find = slug => fabrics().find(p => p.slug === slug);
  const wa = text => 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text);
  const ROUTE = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Montageweg 35, 1948 PH Beverwijk');
  const sat = rgb => { const c = [1, 3, 5].map(i => parseInt(rgb.slice(i, i + 2), 16)); return (Math.max(...c) - Math.min(...c)) / (Math.max(...c) || 1); };

  function card(p) {
    const c = p.colours[0];
    return `<a class="card" href="#p-${p.slug}">
      <div class="shot"><img src="${img(c.id, true)}" alt="${esc(name(p))}, ${esc(cn(c))}" loading="lazy" decoding="async" width="440" height="550">${p.models === false ? '' : `<img class="alt" src="${modelImg(p.slug, 'prinses')}" alt="" loading="lazy" decoding="async" width="720" height="960">`}</div>
      <h3>${esc(name(p))}</h3>
      <div class="meta"><span>${t().from} ${eur(p.price)} ${t().perM}</span><span>${t().colours(p.colours.length)}</span></div>
      <div class="dots">${p.colours.slice(0, 8).map(x => `<i style="background:${x.rgb}"></i>`).join('')}</div>
    </a>`;
  }

  function atelierRow() {
    const slug = state.atelier;
    return MODELS.map(k => `<a href="#p-${slug}"><div class="pic"><img src="${modelImg(slug, k)}" alt="${esc(name(find(slug)))}, ${t().models[k]}" decoding="async" width="720" height="960"></div><span>${t().models[k]}</span></a>`).join('');
  }

  function home() {
    const T = t();
    const pic = (n, i) => `<div class="layer"><picture><source media="(max-width: 760px)" srcset="${brand(n + '-m')}"><img src="${brand(n)}" alt=""${i ? ' loading="lazy"' : ' fetchpriority="high"'}></picture></div>`;
    const fams = Object.keys(FAMILIES).map(f => ({ f, c: fabrics().flatMap(p => p.colours).filter(c => c.family === f && c.id !== 'DOr-4MmCG3v').sort((a, b) => sat(b.rgb) - sat(a.rgb))[0] })).filter(x => x.c);
    const words = T.ticker.concat(T.ticker).map(w => `<span>${esc(w)}</span>`).join('');
    return `
    <section class="hero">
      ${pic('hero-1', 0)}${pic('hero-2', 1)}${pic('hero-3', 2)}
      <div class="hero-in">
        ${RING}
        <h1 class="hero-word" aria-label="Mervex">${[...'MERVEX'].map(l => `<span>${l}</span>`).join('')}</h1>
        <div class="hero-sub">TEXTILE</div>
        <p class="hero-kick">${T.heroKicker}</p>
        <a class="btn line" href="#collectie">${T.heroCta}</a>
      </div>
      <div class="cue"><span>${T.scroll}</span><i></i></div>
    </section>
    <div class="ticker" aria-hidden="true"><div>${words}</div></div>
    <section class="wrap band manifest">
      <figure data-clip><img src="${brand('brand-poster')}" alt="Mervex Textile" loading="lazy" data-parallax></figure>
      <div>
        <p class="big" data-words>${esc(T.manifest)}</p>
        <p class="small" data-rise>${T.manifestP}</p>
        <div class="act" data-rise><a class="btn line" href="#winkel">${T.story}</a></div>
      </div>
    </section>
    <section class="hz"><div class="hz-track">
      <div class="hz-head"><h2>${T.colH}</h2><p>${T.colP}</p></div>
      ${COLLECTIONS.map(([k, n, href]) => `<a class="panel" href="${href}"><img src="${brand(n)}" alt="" loading="lazy" decoding="async"><span>${esc(T.cols[k])}</span></a>`).join('')}
    </div></section>
    <section class="motion">
      <video data-src="video/DXbjoczjQIU.mp4" poster="img/DXbjoczjQIU.webp" muted loop playsinline preload="none"></video>
      <video data-src="video/DRMf3AuDH7K.mp4" poster="img/DRMf3AuDH7K.webp" muted loop playsinline preload="none"></video>
      <video data-src="video/DPqqpYcjC3K.mp4" poster="img/DPqqpYcjC3K.webp" muted loop playsinline preload="none"></video>
      <div class="motion-cap"><h2>${T.motionH}</h2><p>${T.motionP}</p></div>
    </section>
    <section class="wrap band atelier">
      <div class="gown" data-clip><img src="${brand('gown-gold')}" alt="Mervex" loading="lazy" data-parallax></div>
      <div class="copy" data-rise>
        <h2>${T.toDress}</h2><p>${T.toDressP}</p>
        <div class="fabs" role="group" aria-label="${T.all}">${ATELIER.map(s => { const p = find(s); return `<button class="fab" data-atelier="${s}" aria-pressed="${s === state.atelier}" aria-label="${esc(name(p))}"><img src="${img(p.colours[0].id, true)}" alt="" loading="lazy"></button>`; }).join('')}</div>
        <div class="dress-row" id="dress-row">${atelierRow()}</div>
      </div>
    </section>
    <section class="wrap" style="padding-bottom:clamp(72px,11vw,160px)">
      <div class="head" data-rise><h2>${T.byColour}</h2><a href="#collectie">${T.all}</a></div>
      <div class="palette">${fams.map(({ f, c }) => `<a class="tone" href="#kleur-${f}" data-tone><i><img src="${img(c.id, true)}" alt="" loading="lazy"></i>${esc(famName(f))}</a>`).join('')}</div>
    </section>
    <section class="coal"><div class="wrap band"><h2 data-rise>${T.how}</h2><ol class="steps">${T.steps.map(s => `<li data-rise><b>${s[0]}</b><span>${s[1]}</span></li>`).join('')}</ol></div></section>
    <section class="shop"><img src="${brand('shop-wall')}" alt="" loading="lazy" data-drift>
      <div class="txt" data-rise><h2>${T.shopH}</h2><p>${T.shopP}</p><a class="btn" href="${ROUTE}" target="_blank" rel="noopener">${T.route}</a></div>
    </section>`;
  }

  function collection() {
    const T = t();
    const list = fabrics().filter(p => (!state.colour || p.colours.some(c => c.family === state.colour)) && (!state.type || p.type === state.type) && (!state.use || p.uses.includes(state.use)));
    const chip = (k, v, label) => `<button class="chip" data-filter="${k}" data-value="${v || ''}" aria-pressed="${(state[k] || '') === (v || '')}">${esc(label)}</button>`;
    return `<section class="wrap page-top">
      <div class="head"><h1 style="font-size:var(--step3)">${state.use ? T.uses[state.use][0] : T.all}</h1>${Live.admin ? '<a class="btn line" href="#beheer" lang="ar">إضافة قماش</a>' : ''}</div>
      <div class="filters" role="group" aria-label="${T.filterType}">${chip('type', null, T.everything)}${Object.entries(T.types).map(([k, v]) => chip('type', k, v)).join('')}</div>
      <div class="filters" role="group" aria-label="${T.filterColour}">${chip('colour', null, T.everything)}${Object.keys(FAMILIES).map(f => chip('colour', f, famName(f))).join('')}</div>
      ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : `<p class="empty">${T.none}</p>`}
      <div class="uses">${Object.entries(T.uses).map(([k, v]) => `<a class="use" href="#gebruik-${k}"><h3>${v[0]}</h3><p>${v[1]}</p></a>`).join('')}</div>
    </section>`;
  }

  let pick = null;
  function product(slug, colourId, keepLen) {
    const p = find(slug), T = t();
    if (!p) return collection();
    const c = p.colours.find(x => x.id === colourId) || p.colours[0];
    const max = Math.floor(stockOf(c) * 2) / 2;
    const out = max < MIN_M;
    const models = p.models === false ? [] : MODELS;
    pick = { p, c, len: Math.max(MIN_M, Math.min(keepLen || 2, max)), out };
    return `<div class="wrap crumb"><a href="#collectie">${T.all}</a> / ${esc(T.types[p.type])}</div>
    <section class="wrap pdp">
      <div class="stage">
        <div class="main" id="stage"><img src="${img(c.id)}" alt="${esc(name(p))}, ${esc(cn(c))}" fetchpriority="high"></div>
        <p class="stage-note" id="stage-note" hidden></p>
        <div class="thumbs"><button aria-current="true" data-stage="img" aria-label="${esc(cn(c))}"><img src="${img(c.id, true)}" alt=""></button>${c.video ? `<button class="play" data-stage="video">${T.video}</button>` : ''}${models.map(k => `<button data-stage="model" data-model="${k}" aria-label="${T.models[k]}"><img src="${modelImg(p.slug, k)}" alt="" loading="lazy"></button>`).join('')}</div>
      </div>
      <div class="buy">
        <div><h1>${esc(name(p))}</h1><p class="sub">${esc(desc(p))}</p></div>
        <p class="price">${eur(p.price)} <small>${T.perM}</small></p>
        <div>
          <div class="label"><span>${T.colour}: ${esc(cn(c))}</span><em>${out ? T.soldOut : (max <= 6.5 ? T.low : T.inStock)(m(max))}</em></div>
          <div class="swatches">${p.colours.map(x => `<button class="swatch" data-colour="${x.id}" aria-pressed="${x.id === c.id}" aria-label="${esc(cn(x))}"><img src="${img(x.id, true)}" alt="" loading="lazy"></button>`).join('')}</div>
        </div>
        <div>
          <div class="label"><label for="len">${T.length}</label></div>
          <div class="tape" style="--marks:${Math.max(1, max - MIN_M)}">
            <input id="len" type="range" min="${MIN_M}" max="${Math.max(max, MIN_M + STEP_M)}" step="${STEP_M}" value="${pick.len}"${out ? ' disabled' : ''}>
            <div class="ends"><span>${m(MIN_M)} m</span><span>${m(Math.max(max, MIN_M))} m</span></div>
          </div>
          <div class="length"><output id="len-out" for="len"></output>
            <div class="stepper"><button data-step="-1" aria-label="-0.5 m">−</button><button data-step="1" aria-label="+0.5 m">+</button></div></div>
        </div>
        <div class="total"><span>${T.total}</span><b id="total"></b></div>
        <div class="stack">
          <button class="btn full" id="add"${out ? ' disabled' : ''}>${out ? T.soldOut : T.add}</button>
          ${models.length ? `<button class="btn line full" id="as-dress">${T.asDress}</button>` : ''}
          <button class="btn line full" id="sample">${T.sample} (${eur(SAMPLE)})</button>
          <a class="btn line full" href="${wa(T.waText(name(p), cn(c)))}" target="_blank" rel="noopener">${T.waThis}</a>
        </div>
        <div class="notes"><span>${T.inc}</span><span>${T.cut}</span><span>${T.ship}</span></div>
      </div>
    </section>
    <section class="wrap" style="padding-bottom:clamp(56px,8vw,110px)"><h2>${T.related}</h2><div class="grid">${fabrics().filter(x => x.slug !== slug && x.type === p.type).slice(0, 4).map(card).join('')}</div></section>`;
  }
  function syncLength() {
    if (!pick) return;
    $('#len-out').textContent = m(pick.len) + ' m';
    $('#total').textContent = eur(pick.len * pick.p.price);
  }

  const countryName = code => new Intl.DisplayNames([state.lang], { type: 'region' }).of(code);
  const shipCost = () => state.cart.length ? SHIP[state.country] : 0;
  const checkout = () => {
    const T = t();
    return `<section class="wrap"><div class="check"><h1>${T.checkH}</h1><p>${T.checkP}</p>
      <div class="sum">${state.cart.map(l => `<div class="row"><span>${esc(nameIn(l, state.lang))}</span><span>${eur(lineTotal(l))}</span></div>`).join('') || `<span>${T.emptyBag}</span>`}
      <div class="row"><span>${T.shipCost}</span><span>${eur(shipCost())}</span></div>
      <div class="row"><b>${T.total}</b><b>${eur(subtotal() + shipCost())}</b></div></div>
      <div><label class="label" for="country">${T.country}</label>
      <select class="field" id="country">${Object.keys(SHIP).map(c => `<option value="${c}"${c === state.country ? ' selected' : ''}>${esc(countryName(c))}</option>`).join('')}</select></div>
      <p>${T.payWith}:</p><div class="pay"><span>iDEAL</span><span>Bancontact</span><span>Creditcard</span><span>Apple Pay</span></div>
      <button class="btn" id="place"${state.cart.length ? '' : ' disabled'}>${T.pay}</button>
      <a href="#collectie">${T.back}</a></div></section>`;
  };
  function takeStock(l) {
    const c = find(l.slug).colours.find(x => x.id === l.colour);
    const s = stockSplit(c), fromShop = Math.min(+s.winkel || 0, l.len);
    put('stock', c.id, { winkel: (+s.winkel || 0) - fromShop, magazijn: Math.max(0, (+s.magazijn || 0) - (l.len - fromShop)) });
  }
  function nameIn(l, lang) {
    const p = find(l.slug), c = p.colours.find(x => x.id === l.colour);
    const len = String(l.len).replace('.', lang === 'nl' || lang === 'tr' ? ',' : '.');
    return name(p, lang) + ', ' + cn(c, lang) + (l.sample ? ' (' + TEXT[lang].sampleLine + ')' : ', ' + len + ' m');
  }
  function placeOrder() {
    const id = 'MX-' + String(Date.now()).slice(-6);
    const lines = state.cart.map(l => ({ slug: l.slug, colour: l.colour, len: l.len || 0, sample: !!l.sample, nl: nameIn(l, 'nl'), en: nameIn(l, 'en'), ar: nameIn(l, 'ar'), tr: nameIn(l, 'tr'), total: lineTotal(l) }));
    put('orders', id, { created: Date.now(), country: state.country, lines, sub: subtotal(), ship: shipCost(), status: 0 });
    state.cart.filter(l => !l.sample).forEach(takeStock);
    state.cart = []; saveCart(); state.order = id; state.justPlaced = true;
    location.hash = 'bestelling';
  }
  function tracking() {
    const T = t(), o = Live.orders.find(x => x.id === state.order.trim().toUpperCase());
    return `<section class="wrap"><div class="check"><h1>${T.track}</h1>
      ${state.justPlaced && o ? `<p class="ok">${T.orderDone(o.id)}</p>` : `<p>${T.trackP}</p>`}
      <form id="track" class="trackform"><div><label class="label" for="track-no">${T.trackNo}</label><input id="track-no" value="${esc(state.order)}" placeholder="MX-123456" autocomplete="off"></div><button class="btn">${T.trackGo}</button></form>
      ${o ? `<div class="sum"><b>${T.orderOf} ${esc(o.id)}</b>${o.lines.map(l => `<div class="row"><span>${esc(l[state.lang] || l.en)}</span><span>${eur(l.total)}</span></div>`).join('')}<div class="row"><span>${T.shipCost}: ${esc(countryName(o.country))}</span><span>${eur(o.ship)}</span></div><div class="row"><b>${T.total}</b><b>${eur(o.sub + o.ship)}</b></div></div>
      <ol class="timeline">${T.statuses.map((s, i) => `<li class="${i <= o.status ? 'done' : ''}${i === o.status ? ' now' : ''}"${i === o.status ? ' aria-current="step"' : ''}>${s}</li>`).join('')}</ol>` : state.order ? `<p class="bad">${T.trackNone}</p>` : ''}
      </div></section>`;
  }

  /* Admin screens stay in Arabic for the family. */
  const AR_STATUS = ['وصل الطلب', 'مدفوع', 'انقصّ القماش', 'انشحن', 'وصل للزبون'];
  const colourRow = i => `<fieldset class="colour-row" data-row="${i}"><legend>لون ${i + 1}</legend>
    <div class="f2"><div><label for="c-nl-${i}">اسم اللون بالهولندي</label><input id="c-nl-${i}" data-f="nl" required></div>
    <div><label for="c-en-${i}">اسم اللون بالإنجليزي</label><input id="c-en-${i}" data-f="en"></div>
    <div><label for="c-fam-${i}">عيلة اللون</label><select id="c-fam-${i}" data-f="family">${Object.keys(FAMILIES).map(f => `<option value="${f}">${esc(I18N_FAMILIES[f][0])}</option>`).join('')}</select></div>
    <div><label for="c-img-${i}">صورة القماش</label><input id="c-img-${i}" data-f="file" type="file" accept="image/*" required></div>
    ${WAREHOUSES.map(w => `<div><label for="c-${w[0]}-${i}">الكمية: ${w[1]} (متر)</label><input id="c-${w[0]}-${i}" data-f="${w[0]}" type="number" min="0" step="0.5" value="0"></div>`).join('')}</div></fieldset>`;
  function admin() {
    if (!Live.admin) return `<section class="wrap page"><h1>${t().admin}</h1><p>${t().onlyShop}</p></section>`;
    const all = fabrics();
    return `<section class="wrap adm" dir="rtl" lang="ar">
      <h1>إدارة المتجر</h1>
      <h2>إضافة قماش جديد</h2>
      <form id="add-fabric" class="adm-form">
        <div class="f2"><div><label for="f-nl">اسم القماش بالهولندي</label><input id="f-nl" required></div>
        <div><label for="f-en">اسم القماش بالإنجليزي</label><input id="f-en"></div>
        <div><label for="f-type">النوع</label><select id="f-type">${Object.entries(TEXT.ar.types).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div><label for="f-price">سعر المتر (يورو)</label><input id="f-price" type="number" min="0" step="0.5" required></div></div>
        <div><label for="f-text">الوصف بالهولندي</label><textarea id="f-text" rows="2"></textarea></div>
        <div id="colour-rows">${colourRow(0)}</div>
        <div class="adm-act"><button type="button" class="btn line" id="more-colour">لون كمان</button><button class="btn" id="save-fabric">حفظ القماش</button></div>
        <p class="hint">النماذج الثلاثة للقماش الجديد بتنعمل مرة وحدة عن طريق Claude وبتنحفظ بالموقع، فما بتكلف شي وقت يفتحها الزبون.</p>
      </form>
      ${Live.fabrics.length ? `<h2>الأقمشة اللي انضافت</h2><div class="scroll"><table>${Live.fabrics.map(p => `<tr><td><a href="#p-${p.slug}">${esc(p.nl)}</a></td><td>${p.colours.length} لون</td><td class="n">${eur(p.price)}</td><td><button class="link" data-del-fabric="${esc(p.id)}">حذف</button></td></tr>`).join('')}</table></div>` : ''}
      <h2>الطلبات</h2>
      ${Live.orders.length ? `<div class="scroll"><table><tr><th>الرقم</th><th>البلد</th><th>المجموع</th><th>الحالة</th></tr>${Live.orders.map(o => `<tr><td class="n">${esc(o.id)}</td><td>${esc(o.country)}</td><td class="n">${eur(o.sub + o.ship)}</td><td><select data-order="${esc(o.id)}" aria-label="حالة ${esc(o.id)}">${AR_STATUS.map((s, i) => `<option value="${i}"${i === o.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('')}</table></div>` : '<p class="hint">لسا ما في طلبات.</p>'}
      <h2>الكميات بالمخزنين</h2>
      <p class="hint">الزبون بيشوف المجموع بس. كل تغيير بينحفظ لحاله. الأرقام هون أمثلة لحد ما نربط الإكسيل.</p>
      <div class="scroll"><table><tr><th>القماش</th><th>اللون</th>${WAREHOUSES.map(w => `<th>${w[1]}</th>`).join('')}<th>المجموع</th></tr>
      ${all.flatMap(p => p.colours.map(c => { const s = stockSplit(c); return `<tr><td>${esc(p.nl)}</td><td>${esc(c.nl)}</td>${WAREHOUSES.map(w => `<td><input class="qty" type="number" min="0" step="0.5" value="${+s[w[0]] || 0}" data-stock="${c.id}" data-w="${w[0]}" aria-label="${esc(p.nl)}, ${esc(c.nl)}, ${w[1]}"></td>`).join('')}<td class="n">${stockOf(c)} م</td></tr>`; })).join('')}</table></div>
    </section>`;
  }
  async function shrink(file) {
    const bmp = await createImageBitmap(file), k = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const px = document.createElement('canvas'); px.width = px.height = 1; const g = px.getContext('2d'); g.drawImage(cv, 0, 0, 1, 1);
    const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
    const blob = await new Promise(ok => cv.toBlob(ok, 'image/webp', .76));
    return { blob, rgb: '#' + [r, gr, b].map(v => v.toString(16).padStart(2, '0')).join('') };
  }
  async function storeImage(blob) {
    if (Live.assets) return (await Live.assets.upload(blob)).url;
    return new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(blob); });
  }
  async function saveFabric(form) {
    const btn = $('#save-fabric'); btn.disabled = true; btn.textContent = 'عم بنحفظ…';
    try {
      const stamp = Date.now(), nl = $('#f-nl').value.trim(), en = $('#f-en').value.trim() || nl;
      const colours = [];
      for (const [i, row] of $$('.colour-row', form).entries()) {
        const f = k => $('[data-f="' + k + '"]', row), cnl = f('nl').value.trim();
        const { blob, rgb } = await shrink(f('file').files[0]);
        const id = 'u' + stamp + '-' + i;
        colours.push({ id, nl: cnl, en: f('en').value.trim() || cnl, family: f('family').value, rgb, url: await storeImage(blob), video: null, stock: 0 });
        put('stock', id, { winkel: +f('winkel').value || 0, magazijn: +f('magazijn').value || 0 });
      }
      const slug = 'stof-' + stamp, text = $('#f-text').value.trim();
      put('fabrics', slug, { slug, nl, en, type: $('#f-type').value, uses: ['avond'], price: +$('#f-price').value, textNl: text, textEn: text, colours, models: false });
      toast('انحفظ القماش'); location.hash = 'p-' + slug;
    } catch (e) {
      btn.disabled = false; btn.textContent = 'حفظ القماش'; toast('ما انحفظ القماش. جرّب صورة تانية أو أصغر.');
    }
  }
  const about = () => {
    const T = t();
    return `<section class="wrap page"><h1>${T.aboutH}</h1>${T.aboutP.map(x => `<p>${x}</p>`).join('')}<h2>${T.visit}</h2><address><bdi>Montageweg 35</bdi><br><bdi>1948 PH Beverwijk</bdi></address><p>${T.hours}</p><a class="btn line" href="${ROUTE}" target="_blank" rel="noopener" style="justify-self:start">${T.route}</a><h2>${T.returns}</h2><p>${T.returnsP}</p><h2>${T.samples}</h2><p>${T.samplesP(eur(SAMPLE))}</p><h2>${T.shipping}</h2><div class="rates">${Object.keys(SHIP).map(c => `<div class="row"><span>${esc(countryName(c))}</span><span>${eur(SHIP[c])}</span></div>`).join('')}</div></section>`;
  };

  function lineTotal(l) { return l.sample ? SAMPLE : l.len * find(l.slug).price; }
  function subtotal() { return state.cart.reduce((s, l) => s + lineTotal(l), 0); }
  function saveCart() { store.set('mx-cart', state.cart); chrome(); }

  function cartView() {
    const T = t();
    $('#cart').setAttribute('aria-label', T.bagTitle);
    $('#cart').innerHTML = `<div class="c-head"><h2>${T.bagTitle}</h2><button id="cart-close">${T.close}</button></div>
      <div class="c-list">${state.cart.length ? state.cart.map((l, i) => { const p = find(l.slug), c = p.colours.find(x => x.id === l.colour); return `<div class="cline"><img src="${img(l.colour, true)}" alt=""><div>${esc(name(p))}<small>${esc(cn(c))}${l.sample ? ', ' + T.sampleLine : ', ' + m(l.len) + ' m'}</small><button data-remove="${i}">${T.remove}</button></div><span>${eur(lineTotal(l))}</span></div>`; }).join('') : `<p class="empty">${T.emptyBag}</p>`}</div>
      <div class="c-foot"><div class="total"><span>${T.sub}</span><b>${eur(subtotal())}</b></div><small>${T.shipLater}</small><a class="btn full" href="#afrekenen" id="to-checkout">${T.checkout}</a></div>`;
  }
  function openCart(on) {
    $('#cart').hidden = !on; $('#scrim').hidden = !on;
    if (on) { cartView(); $('#cart-close').focus(); }
  }
  const langSelect = id => `<select class="lang" id="${id}" aria-label="Language">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}"${k === state.lang ? ' selected' : ''}>${v}</option>`).join('')}</select>`;

  function chrome() {
    const T = t();
    document.documentElement.lang = state.lang;
    document.documentElement.dir = rtl() ? 'rtl' : 'ltr';
    document.title = T.title;
    $('#top').innerHTML = `<div id="demo-bar">${T.demo}</div><div class="wrap bar">
      <div class="side start"><button class="nav burger" id="burger">${T.menu}</button><a class="nav" href="#collectie">${T.all}</a><a class="nav" href="#winkel">${T.about}</a><a class="nav" href="#bestelling">${T.track}</a></div>
      <a class="mark" href="#home" aria-label="Mervex Textile" dir="ltr">MERVEX</a>
      <div class="side end">${Live.admin ? `<a class="nav hide-s" href="#beheer">${T.admin}</a>` : ''}${langSelect('lang')}<button class="nav" id="bag">${T.bag} (${state.cart.length})</button></div></div>`;
    $('#drawer').innerHTML = `<button class="x" id="drawer-close">${T.close}</button><a href="#collectie">${T.all}</a><a href="#winkel">${T.about}</a><a href="#bestelling">${T.track}</a>${Live.admin ? `<a href="#beheer">${T.admin}</a>` : ''}${langSelect('lang-m')}`;
    $('#foot').innerHTML = `<div class="wrap"><div class="foot-top">${RING}<b dir="ltr">MERVEX</b></div><div class="foot">
      <div><h3>Mervex Textile</h3><address><bdi>Montageweg 35</bdi><br><bdi>1948 PH Beverwijk</bdi></address></div>
      <div><h3>${T.contact}</h3><a href="${wa(T.waText('Mervex', ''))}" target="_blank" rel="noopener" dir="ltr">WhatsApp +31 6 84647141</a><a href="https://www.instagram.com/mervex_textile/" target="_blank" rel="noopener" dir="ltr">Instagram @mervex_textile</a></div>
      <div><h3>${T.service}</h3><a href="#bestelling">${T.track}</a><a href="#winkel">${T.shipping}</a><a href="#winkel">${T.returns}</a><a href="#winkel">${T.samples}</a></div>
      <div><h3>${T.about}</h3><span>${T.legal}</span></div></div></div>`;
    paintHeader();
  }
  const isHome = () => (location.hash.slice(1) || 'home') === 'home';
  function paintHeader() { $('#top').classList.toggle('solid', !isHome() || window.scrollY > 60); }

  /* Motion */
  if (window.gsap) gsap.ticker.lagSmoothing(0); // follow real time, so slow phones never hold content back
  let ctx = null;
  const videoSeen = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    videoSeen.unobserve(e.target); e.target.src = e.target.dataset.src;
    if (!reduced) e.target.play().catch(() => {});
  }), { rootMargin: '200px' }) : null;
  function wakeVideos() { if (videoSeen) $$('video[data-src]').forEach(v => videoSeen.observe(v)); }

  function heroIn(delay) {
    if (!window.gsap || reduced) return;
    gsap.from('.hero-word span', { yPercent: 70, autoAlpha: 0, duration: 1.2, stagger: .07, ease: 'power4.out', delay });
    gsap.from('.hero .ring, .hero-sub, .hero-kick, .hero .btn, .cue', { y: 20, autoAlpha: 0, duration: 1, stagger: .12, ease: 'power3.out', delay: delay + .5 });
  }
  function intro() {
    let seen = true;
    try { seen = !!sessionStorage.getItem('mx-intro'); sessionStorage.setItem('mx-intro', '1'); } catch (e) { seen = false; }
    if (seen || !window.gsap || reduced || document.hidden) return heroIn(.1);
    const el = document.createElement('div');
    el.id = 'intro';
    el.innerHTML = `<div class="cur l"></div><div class="cur r"></div><div class="seal">${RING}<div class="word gold-text" dir="ltr">MERVEX</div></div>`;
    document.body.append(el);
    setTimeout(() => el.remove(), 7000); // never leave the curtain up if animation stalls
    const rings = $$('circle', el);
    rings.forEach(c => gsap.set(c, { attr: { 'stroke-dasharray': 360, 'stroke-dashoffset': 360 } }));
    const tl = gsap.timeline({ onComplete: () => el.remove() });
    tl.to(rings, { attr: { 'stroke-dashoffset': 0 }, duration: 1, stagger: .12, ease: 'power2.inOut' })
      .from($('text', el), { autoAlpha: 0, duration: .5 }, '-=.35')
      .from($('.word', el), { autoAlpha: 0, y: 14, duration: .6, ease: 'power3.out' }, '-=.2')
      .to($('.seal', el), { autoAlpha: 0, duration: .4 }, '+=.35')
      .to($('.cur.l', el), { xPercent: -101, duration: 1, ease: 'power4.inOut' }, '-=.1')
      .to($('.cur.r', el), { xPercent: 101, duration: 1, ease: 'power4.inOut' }, '<')
      .add(() => heroIn(0), '-=.6');
  }
  function homeMotion() {
    if (!window.gsap || !window.ScrollTrigger || reduced) return;
    gsap.registerPlugin(ScrollTrigger);
    ctx = gsap.context(() => {
      $$('[data-words]').forEach(p => {
        p.innerHTML = p.textContent.split(' ').map(w => `<span class="w"><span>${esc(w)}</span></span>`).join(' ');
        gsap.from($$('.w > span', p), { yPercent: 110, duration: 1, stagger: .05, ease: 'power4.out', scrollTrigger: { trigger: p, start: 'top 80%', once: true } });
      });
      gsap.utils.toArray('[data-rise]').forEach(el => gsap.from(el, { y: 36, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
      gsap.utils.toArray('[data-clip]').forEach(el => gsap.from(el, { clipPath: 'inset(100% 0 0 0)', duration: 1.4, ease: 'power4.inOut', scrollTrigger: { trigger: el, start: 'top 82%', once: true } }));
      gsap.utils.toArray('[data-parallax]').forEach(im => gsap.to(im, { yPercent: -14, ease: 'none', scrollTrigger: { trigger: im.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
      gsap.utils.toArray('[data-drift]').forEach(im => gsap.fromTo(im, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: im.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
      gsap.from('.tone', { y: 30, autoAlpha: 0, duration: .8, stagger: .06, ease: 'power3.out', scrollTrigger: { trigger: '.palette', start: 'top 85%', once: true } });
      gsap.matchMedia().add('(min-width: 900px)', () => {
        const track = $('.hz-track');
        const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
        gsap.to(track, { x: () => (rtl() ? dist() : -dist()), ease: 'none', scrollTrigger: { trigger: '.hz', pin: true, scrub: .6, end: () => '+=' + dist(), invalidateOnRefresh: true, anticipatePin: 1 } });
      });
    }, $('#view'));
    window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  }

  let wanted = null, firstPaint = true;
  function render(keepScroll) {
    const h = location.hash.slice(1) || 'home', view = $('#view');
    if (ctx) { ctx.revert(); ctx = null; }
    pick = null;
    view.classList.remove('enter');
    if (h === 'home') view.innerHTML = home();
    else if (h === 'collectie') view.innerHTML = collection();
    else if (h.startsWith('kleur-')) { state.colour = h.slice(6); state.type = state.use = null; view.innerHTML = collection(); }
    else if (h.startsWith('gebruik-')) { state.use = h.slice(8); state.type = state.colour = null; view.innerHTML = collection(); }
    else if (h.startsWith('p-')) { view.innerHTML = product(h.slice(2), wanted); if (pick) syncLength(); }
    else if (h === 'afrekenen') view.innerHTML = checkout();
    else if (h === 'winkel') view.innerHTML = about();
    else if (h === 'bestelling') { view.innerHTML = tracking(); state.justPlaced = false; }
    else if (h === 'beheer') view.innerHTML = admin();
    else view.innerHTML = home();
    wanted = null;
    if (!keepScroll) window.scrollTo(0, 0);
    wakeVideos(); paintHeader();
    if ($('.hero')) {
      homeMotion();
      if (firstPaint) intro(); else heroIn(.1);
    } else {
      void view.offsetWidth; view.classList.add('enter');
    }
    firstPaint = false;
  }
  function refresh() {
    const h = location.hash.slice(1) || 'home', e = document.activeElement;
    if (h === 'home') return;
    if (h === 'beheer' && e && /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) return;
    if (h === 'beheer' && $('#f-nl') && $('#f-nl').value) return;
    const y = window.scrollY; render(true); window.scrollTo(0, y);
  }
  function showStage(kind, modelKey) {
    const stage = $('#stage'), note = $('#stage-note');
    stage.classList.toggle('model', kind === 'model');
    note.hidden = kind !== 'model';
    if (kind === 'video') stage.innerHTML = `<video src="video/${pick.c.video}.mp4" muted loop playsinline autoplay controls></video>`;
    else if (kind === 'model') { stage.innerHTML = `<img src="${modelImg(pick.p.slug, modelKey)}" alt="${esc(name(pick.p))}">`; note.textContent = t().modelNote(cn(pick.p.colours[0])); }
    else stage.innerHTML = `<img src="${img(pick.c.id)}" alt="${esc(name(pick.p))}">`;
    $$('.thumbs button').forEach(x => x.setAttribute('aria-current', x.dataset.stage === kind && (kind !== 'model' || x.dataset.model === modelKey)));
  }

  document.addEventListener('click', e => {
    const q = s => e.target.closest(s);
    let b;
    if (q('#burger')) { $('#drawer').hidden = false; return; }
    if (q('#drawer-close') || q('#drawer a')) { $('#drawer').hidden = true; return; }
    if (q('#bag')) return openCart(true);
    if (q('#cart-close') || e.target.id === 'scrim') return openCart(false);
    if (q('#to-checkout')) return openCart(false);
    if ((b = q('[data-remove]'))) { state.cart.splice(+b.dataset.remove, 1); saveCart(); cartView(); return; }
    if ((b = q('[data-filter]'))) { state[b.dataset.filter] = b.dataset.value || null; history.replaceState(null, '', '#collectie'); render(true); return; }
    if ((b = q('[data-atelier]'))) {
      state.atelier = b.dataset.atelier;
      $$('[data-atelier]').forEach(x => x.setAttribute('aria-pressed', x === b));
      $('#dress-row').innerHTML = atelierRow();
      if (window.gsap && !reduced) gsap.from('#dress-row .pic', { autoAlpha: 0, y: 16, duration: .6, stagger: .08, ease: 'power3.out' });
      return;
    }
    if ((b = q('.swatch'))) { $('#view').innerHTML = product(pick.p.slug, b.dataset.colour, pick.len); syncLength(); return; }
    if ((b = q('[data-step]'))) { const r = $('#len'); const v = Math.min(+r.max, Math.max(+r.min, pick.len + b.dataset.step * STEP_M)); pick.len = v; r.value = v; syncLength(); return; }
    if ((b = q('[data-stage]'))) { showStage(b.dataset.stage, b.dataset.model); return; }
    if (q('#as-dress')) { showStage('model', MODELS[0]); $('#stage').scrollIntoView({ block: 'center' }); return; }
    if (q('#place')) return placeOrder();
    if (q('#more-colour')) { $('#colour-rows').insertAdjacentHTML('beforeend', colourRow($$('.colour-row').length)); return; }
    if ((b = q('[data-del-fabric]'))) { drop('fabrics', b.dataset.delFabric); render(true); return; }
    if (q('#add')) { state.cart.push({ slug: pick.p.slug, colour: pick.c.id, len: pick.len }); saveCart(); toast(t().added); return openCart(true); }
    if (q('#sample')) { state.cart.push({ slug: pick.p.slug, colour: pick.c.id, sample: true }); saveCart(); toast(t().added); return; }
  });
  document.addEventListener('input', e => { if (e.target.id === 'len') { pick.len = +e.target.value; syncLength(); } });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'lang' || el.id === 'lang-m') {
      $('#drawer').hidden = true; state.lang = el.value; store.set('mx-lang', state.lang); chrome(); render(true);
    }
    if (el.id === 'country') { state.country = el.value; store.set('mx-country', el.value); render(true); }
    if (el.dataset.order) { const { id, ...doc } = Live.orders.find(x => x.id === el.dataset.order); put('orders', id, { ...doc, status: +el.value }); toast('انحفظت الحالة'); }
    if (el.dataset.stock) {
      const c = fabrics().flatMap(p => p.colours).find(x => x.id === el.dataset.stock);
      const row = { ...stockSplit(c), [el.dataset.w]: Math.max(0, +el.value || 0) };
      put('stock', c.id, { winkel: +row.winkel || 0, magazijn: +row.magazijn || 0 }); el.blur(); render(true); toast('انحفظت الكمية');
    }
  });
  document.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.id === 'track') { state.order = $('#track-no').value.trim().toUpperCase(); render(true); }
    if (e.target.id === 'add-fabric') saveFabric(e.target);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('#cart').hidden) openCart(false);
    $('#drawer').hidden = true;
  });
  window.addEventListener('hashchange', () => render());
  window.addEventListener('scroll', paintHeader, { passive: true });

  let toastTimer;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 1800); }

  chrome(); render(); connect();
})();
