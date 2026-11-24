/* 아이들 식단표 — 앱 로직 (외부 라이브러리 없음) */
(() => {
  'use strict';

  const DATA_URL = 'data/menus.json';
  const CACHE_KEY = 'mealplan.data.v1';
  const CHECK_KEY = 'mealplan.checks.v1';
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const SLOT_ORDER = { breakfast1: 0, breakfast2: 1, dinner1: 2, dinner2: 3 };

  const el = {
    heroBadge: document.getElementById('heroBadge'),
    heroMeta: document.getElementById('heroMeta'),
    heroDate: document.getElementById('heroDate'),
    heroNote: document.getElementById('heroNote'),
    dateBar: document.getElementById('dateBar'),
    content: document.getElementById('content'),
    allBtn: document.getElementById('allBtn'),
    updatedAt: document.getElementById('updatedAt'),
    search: document.getElementById('searchInput'),
    searchClear: document.getElementById('searchClear'),
    installBtn: document.getElementById('installBtn'),
    installHint: document.getElementById('installHint'),
    installHintClose: document.getElementById('installHintClose'),
    sheet: document.getElementById('sheet'),
    sheetCrumb: document.getElementById('sheetCrumb'),
    sheetTitle: document.getElementById('sheetTitle'),
    sheetBody: document.getElementById('sheetBody')
  };

  const state = {
    data: null,
    selected: null,
    all: false,
    month: null,          // 달력에 보여 줄 달 { y, m } (m은 1~12)
    query: '',
    checks: loadChecks(),
    offline: false
  };

  /* ---------------- 저장소 ---------------- */
  function loadChecks() {
    try { return JSON.parse(localStorage.getItem(CHECK_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveChecks() {
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(state.checks)); } catch (e) { /* private mode */ }
  }

  /* ---------------- 날짜 ---------------- */
  function todayISO() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function parseISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return { y, m, d };
  }
  function shortLabel(iso) {
    const { m, d } = parseISO(iso);
    return `${m}/${d}`;
  }
  function longLabel(iso, weekday) {
    const { m, d } = parseISO(iso);
    return `${m}월 ${d}일 ${weekday}요일`;
  }
  const pad2 = (n) => String(n).padStart(2, '0');
  function monthPrefix(y, m) {
    return `${y}-${pad2(m)}`;
  }
  function addMonths(y, m, delta) {
    const d = new Date(y, m - 1 + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }

  /* ---------------- 유틸 ---------------- */
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function highlight(text, q) {
    const safe = esc(text);
    if (!q) return safe;
    const needle = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(needle, 'gi'), (m) => `<mark class="hit">${m}</mark>`);
  }

  function tagClass(i) {
    return 'tag--' + ['a', 'b', 'c', 'd', 'e'][i % 5];
  }

  function mealsOf(day) {
    return [...day.meals].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  }

  function findMeal(id) {
    for (const day of state.data.days) {
      const meal = day.meals.find((m) => m.id === id);
      if (meal) return { day, meal };
    }
    return null;
  }

  /* ---------------- 데이터 불러오기 ---------------- */
  async function load() {
    let data = null;
    try {
      const res = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* quota */ }
      state.offline = false;
    } catch (err) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try { data = JSON.parse(cached); state.offline = true; } catch (e) { data = null; }
      }
      if (!data) {
        el.content.innerHTML = `<div class="empty"><strong>식단을 불러오지 못했어요</strong>
          인터넷 연결을 확인한 뒤 아래로 당겨 새로고침해 주세요.</div>`;
        return;
      }
    }
    state.data = data;
    state.data.days.sort((a, b) => (a.date < b.date ? 1 : -1));

    const today = todayISO();
    const found = state.data.days.some((d) => d.date === today);
    state.selected = found ? today : (state.data.days[0] ? state.data.days[0].date : null);
    render();
  }

  /* ---------------- 렌더 ---------------- */
  function render() {
    if (!state.data) return;
    renderHero();
    renderDates();
    renderContent();
    renderUpdated();

    el.allBtn.setAttribute('aria-pressed', String(state.all));
    el.allBtn.textContent = state.all ? '달력 닫기' : '지난 식단 전체';
    el.searchClear.hidden = !state.query;
  }

  function renderHero() {
    const day = state.data.days.find((d) => d.date === state.selected) || state.data.days[0];
    if (!day) return;
    const isToday = day.date === todayISO();
    el.heroBadge.textContent = isToday ? '오늘' : '지난 식단';
    el.heroMeta.textContent = isToday
      ? '오늘의 아이들 식단'
      : (day === state.data.days[0] ? '오늘 식단은 아침 7:51에 올라와요' : '지난 식단 다시 보기');
    el.heroDate.textContent = longLabel(day.date, day.weekday);
    el.heroNote.textContent = day.note || '';
  }

  function renderDates() {
    el.dateBar.innerHTML = state.data.days.map((day) => {
      const isToday = day.date === todayISO();
      const label = isToday ? '오늘' : shortLabel(day.date);
      return `<button class="datepill" type="button" data-date="${day.date}"
        aria-current="${day.date === state.selected}">
        ${isToday ? '🌟 ' : ''}${label}<span class="datepill__dow">${day.weekday}</span>
      </button>`;
    }).join('');
  }

  function mealCard(day, meal) {
    const q = state.query;
    const kind = meal.slot.startsWith('breakfast') ? 'breakfast' : 'dinner';
    // 제목·소개에는 없고 재료에서만 걸린 경우, 어떤 재료로 찾았는지 한 줄 보여 준다.
    let ingHint = '';
    if (q) {
      const inTitle = (meal.name + ' ' + meal.summary + ' ' + meal.tags.join(' ')).toLowerCase().includes(q.toLowerCase());
      const hit = (meal.ingredients || []).find((i) => i.name.toLowerCase().includes(q.toLowerCase()));
      if (!inTitle && hit) ingHint = `<span class="meal__hit">재료 · ${highlight(hit.name, q)}</span>`;
    }
    return `<button class="meal meal--${kind}" type="button" data-meal="${meal.id}">
      <span class="meal__emoji" aria-hidden="true">${meal.emoji || '🍽'}</span>
      <span class="meal__body">
        <span class="meal__slot">${esc(meal.slotLabel)}</span>
        <span class="meal__name">${highlight(meal.name, q)}</span>
        <span class="meal__sub">${highlight(meal.summary, q)}</span>
        ${ingHint}
        <span class="meal__tags">${meal.tags.map((t, i) =>
          `<span class="tag ${tagClass(i)}">${highlight(t, q)}</span>`).join('')}</span>
        <span class="meal__foot">
          <span class="meal__time">${meal.minutes}분</span>
          <span>${esc(meal.servings)}</span>
        </span>
      </span>
      <span class="meal__chev" aria-hidden="true">›</span>
    </button>`;
  }

  function dayGroup(day, meals, showHead = true) {
    const head = showHead ? `<div class="daygroup__head">
        <span class="daygroup__date">${longLabel(day.date, day.weekday)}</span>
        ${day.note ? `<span class="daygroup__note">${esc(day.note)}</span>` : ''}
      </div>` : '';
    return `<div class="daygroup">
      ${head}
      ${meals.map((m) => mealCard(day, m)).join('')}
    </div>`;
  }

  function match(meal, q) {
    if (!q) return true;
    const hay = [
      meal.name, meal.summary, meal.nutrients, meal.slotLabel,
      ...(meal.tags || []),
      ...(meal.keywords || []),
      ...(meal.ingredients || []).map((i) => i.name)
    ].join(' ').toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function renderContent() {
    const q = state.query.trim();

    if (q) {
      const hits = [];
      for (const day of state.data.days) {
        const meals = mealsOf(day).filter((m) => match(m, q));
        if (meals.length) hits.push({ day, meals });
      }
      const total = hits.reduce((n, h) => n + h.meals.length, 0);
      if (!total) {
        el.content.innerHTML = `<div class="empty"><strong>“${esc(q)}” 결과가 없어요</strong>
          다른 재료나 메뉴 이름으로 찾아보세요. (예: 닭, 새우, 국수, 두부)</div>`;
        return;
      }
      el.content.innerHTML = `<p class="section-title">검색 결과 <span class="count">${total}개</span></p>` +
        hits.map((h) => dayGroup(h.day, h.meals)).join('');
      return;
    }

    if (state.all) {
      el.content.innerHTML = calendarHTML();
      return;
    }

    const day = state.data.days.find((d) => d.date === state.selected) || state.data.days[0];
    if (!day) {
      el.content.innerHTML = `<div class="empty"><strong>아직 식단이 없어요</strong>내일 아침 브리핑부터 채워집니다.</div>`;
      return;
    }
    el.content.innerHTML = dayGroup(day, mealsOf(day), false);
  }

  /* ---------------- 달력 (지난 식단 전체) ---------------- */
  function calendarHTML() {
    if (!state.month) {
      const base = state.selected ? parseISO(state.selected) : parseISO(todayISO());
      state.month = { y: base.y, m: base.m };
    }
    const { y, m } = state.month;
    const prefix = monthPrefix(y, m) + '-';
    const byDate = new Map(state.data.days.map((day) => [day.date, day]));
    const today = todayISO();
    const startDow = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();

    const dows = DOW.map((label, i) =>
      `<span class="${i === 0 ? 'is-sun' : (i === 6 ? 'is-sat' : '')}">${label}</span>`).join('');

    let cells = '';
    for (let i = 0; i < startDow; i++) cells += '<div class="cal__cell cal__cell--blank" aria-hidden="true"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = prefix + pad2(d);
      const day = byDate.get(iso);
      const dow = (startDow + d - 1) % 7;
      const cls = ['cal__cell'];
      if (dow === 0) cls.push('is-sun');
      if (dow === 6) cls.push('is-sat');
      cls.push(day ? 'cal__cell--has' : 'cal__cell--off');
      if (iso === today) cls.push('is-today');
      if (iso === state.selected) cls.push('is-selected');

      const meals = day ? mealsOf(day) : [];
      const dots = meals.map((meal) =>
        `<i class="dot dot--${meal.slot.startsWith('breakfast') ? 'am' : 'pm'}"></i>`).join('');
      const label = `${m}월 ${d}일 ${DOW[dow]}요일` +
        (day ? `, ${meals.length}개 식단` : ', 기록된 식단 없음') +
        (iso === today ? ' (오늘)' : '');

      cells += `<button class="${cls.join(' ')}" type="button" data-caldate="${iso}"
        aria-label="${esc(label)}" ${iso === state.selected ? 'aria-current="true"' : ''}
        ${day ? '' : 'disabled'}>
        <span class="cal__num">${d}</span>
        <span class="cal__dots" aria-hidden="true">${dots}</span>
      </button>`;
    }
    const rem = (startDow + daysInMonth) % 7;
    if (rem) {
      for (let i = 0; i < 7 - rem; i++) cells += '<div class="cal__cell cal__cell--blank" aria-hidden="true"></div>';
    }

    const selectedDay = state.selected && state.selected.startsWith(prefix)
      ? byDate.get(state.selected) : null;
    let panel;
    if (selectedDay) {
      panel = dayGroup(selectedDay, mealsOf(selectedDay));
    } else if (state.data.days.some((day) => day.date.startsWith(prefix))) {
      panel = `<div class="empty"><strong>날짜를 골라 주세요</strong>식단이 있는 날은 색으로 표시돼요.</div>`;
    } else {
      panel = `<div class="empty"><strong>${y}년 ${m}월에는 기록된 식단이 없어요</strong>
        식단이 쌓이면 이 달력에 표시돼요.</div>`;
    }

    return `<div class="calendar">
      <div class="cal__head">
        <button class="cal__nav" type="button" data-month="-1" aria-label="이전 달">‹</button>
        <p class="cal__title" aria-live="polite">${y}년 ${m}월</p>
        <button class="cal__nav" type="button" data-month="1" aria-label="다음 달">›</button>
      </div>
      <div class="cal__dow" aria-hidden="true">${dows}</div>
      <div class="cal__grid">${cells}</div>
      <p class="cal__legend">
        <span><i class="dot dot--am"></i>아침</span>
        <span><i class="dot dot--pm"></i>저녁</span>
        <span>날짜를 누르면 식단이 보여요</span>
      </p>
    </div>
    <div class="calday" id="calDay">${panel}</div>`;
  }

  function shiftMonth(delta) {
    if (!state.month) return;
    const next = addMonths(state.month.y, state.month.m, delta);
    state.month = next;
    const prefix = monthPrefix(next.y, next.m) + '-';
    if (!(state.selected && state.selected.startsWith(prefix))) {
      const inMonth = state.data.days.filter((day) => day.date.startsWith(prefix));
      if (inMonth.length) state.selected = inMonth[0].date; // days는 최신순 정렬
    }
    render();
    const head = el.content.querySelector('.calendar');
    if (head) head.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function selectCalDate(iso) {
    state.selected = iso;
    render();
  }

  function revealCalDay() {
    const node = el.content.querySelector('.calday');
    if (!node) return;
    if (node.getBoundingClientRect().top > window.innerHeight - 140) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function renderUpdated() {
    const iso = state.data.app && state.data.app.updatedAt;
    if (!iso) { el.updatedAt.textContent = ''; return; }
    const { m, d } = parseISO(iso.slice(0, 10));
    el.updatedAt.textContent = `최근 업데이트 ${m}/${d}${state.offline ? ' · 저장본' : ''}`;
  }

  /* ---------------- 상세 시트 ---------------- */
  let lastFocus = null;

  function openMeal(id) {
    const found = findMeal(id);
    if (!found) return;
    const { day, meal } = found;
    lastFocus = document.activeElement;

    el.sheetCrumb.textContent = `${longLabel(day.date, day.weekday)} · ${meal.slotLabel}`;
    el.sheetTitle.textContent = meal.name;
    el.sheetBody.innerHTML = detailHTML(day, meal);
    el.sheet.hidden = false;
    document.body.style.overflow = 'hidden';
    el.sheet.querySelector('.sheet__panel').scrollTop = 0;
    el.sheetBody.scrollTop = 0;
    const closeBtn = el.sheet.querySelector('.sheet__close');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
    history.pushState({ sheet: meal.id }, '');
  }

  function detailHTML(day, meal) {
    const checked = state.checks[meal.id] || [];
    const total = meal.ingredients.length;
    let lastGroup = null;
    const ingRows = meal.ingredients.map((ing, i) => {
      let head = '';
      if (ing.group && ing.group !== lastGroup) {
        head = `<div class="ing__group">${esc(ing.group)}</div>`;
        lastGroup = ing.group;
      }
      const done = checked.includes(i);
      return head + `<label class="ing__row ${done ? 'is-done' : ''}" data-ing="${i}">
        <input class="ing__check" type="checkbox" data-ing-check="${i}" ${done ? 'checked' : ''}
          aria-label="${esc(ing.name)} ${esc(ing.amount)}">
        <span class="ing__name">${esc(ing.name)}</span>
        <span class="ing__amount">${esc(ing.amount)}</span>
      </label>`;
    }).join('');

    const srcs = (meal.sources || []).map((s) => {
      const kind = s.type === '참고' ? 'ref' : (s.type === '대안' ? 'alt' : '');
      const sub = [s.author, s.rating, s.note].filter(Boolean).map(esc).join(' · ');
      return `<a class="src" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">
        <span class="src__badge src__badge--${kind}">${esc(s.type || '원문')}</span>
        <span class="src__text">
          <span class="src__title">${esc(s.title)}</span>
          ${sub ? `<span class="src__sub">${sub}</span>` : ''}
        </span>
        <span class="src__go" aria-hidden="true">↗</span>
      </a>`;
    }).join('');

    return `<div class="detail">
      <div class="detail__meta">
        ${meal.tags.map((t, i) => `<span class="tag ${tagClass(i)}">${esc(t)}</span>`).join('')}
        <span class="tag">⏱ ${meal.minutes}분</span>
        <span class="tag">${esc(meal.servings)}</span>
        ${meal.difficulty ? `<span class="tag">${esc(meal.difficulty)}</span>` : ''}
      </div>
      <p class="detail__summary">${esc(meal.summary)}</p>
      <p class="detail__nutrients"><b>영양 포인트</b> · ${esc(meal.nutrients)}</p>

      <h4>🧺 재료 <span class="count">터치하면 장보기 체크</span></h4>
      <div class="ing" id="ingList">${ingRows}</div>
      <div class="ing__bar">
        <span id="ingCount">장보기 ${checked.length} / ${total}</span>
        <button type="button" id="ingReset">체크 초기화</button>
      </div>

      <h4>👩‍🍳 조리 순서</h4>
      <ol class="steps">${meal.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>

      ${meal.kidTip ? `<h4>🧒 아이용 팁</h4><div class="tip">${esc(meal.kidTip)}</div>` : ''}

      ${srcs ? `<h4>🔗 레시피 출처</h4><div class="srcs">${srcs}</div>` : ''}
      ${(meal.sources || []).some((s) => s.type === '참고')
        ? '<p class="detail__note">출처의 ‘참고’는 같은 메뉴를 공개 레시피로 확인한 링크예요. 집에 있는 재료에 맞춰 양을 조절해 주세요.</p>'
        : ''}
    </div>`;
  }

  function closeSheet(fromPop) {
    if (el.sheet.hidden) return;
    el.sheet.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus({ preventScroll: true });
    }
    if (!fromPop && history.state && history.state.sheet) history.back();
  }

  function updateIngCount(mealId) {
    const found = findMeal(mealId);
    if (!found) return;
    const meal = found.meal;
    const checked = state.checks[mealId] || [];
    const node = document.getElementById('ingCount');
    if (node) node.textContent = `장보기 ${checked.length} / ${meal.ingredients.length}`;
  }

  function onSheetBodyChange(e) {
    const box = e.target.closest('[data-ing-check]');
    if (!box) return;
    const mealId = history.state && history.state.sheet;
    if (!mealId) return;
    const idx = Number(box.getAttribute('data-ing-check'));
    const arr = new Set(state.checks[mealId] || []);
    if (box.checked) arr.add(idx); else arr.delete(idx);
    state.checks[mealId] = [...arr].sort((a, b) => a - b);
    saveChecks();
    box.closest('.ing__row').classList.toggle('is-done', box.checked);
    updateIngCount(mealId);
  }

  /* ---------------- 이벤트 ---------------- */
  el.dateBar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-date]');
    if (!btn) return;
    state.selected = btn.getAttribute('data-date');
    state.all = false;
    state.query = '';
    el.search.value = '';
    el.allBtn.disabled = false;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  el.content.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-month]');
    if (nav) { shiftMonth(Number(nav.getAttribute('data-month'))); return; }

    const cell = e.target.closest('[data-caldate]');
    if (cell && !cell.disabled) {
      selectCalDate(cell.getAttribute('data-caldate'));
      revealCalDay();
      return;
    }

    const btn = e.target.closest('[data-meal]');
    if (!btn) return;
    openMeal(btn.getAttribute('data-meal'));
  });

  el.allBtn.addEventListener('click', () => {
    state.all = !state.all;
    if (state.all) {
      state.query = '';
      el.search.value = '';
      el.allBtn.disabled = false;
      // 열 때는 지금 보고 있던 날짜(없으면 오늘)가 속한 달부터 보여 준다.
      const base = state.selected ? parseISO(state.selected) : parseISO(todayISO());
      state.month = { y: base.y, m: base.m };
    }
    render();
  });

  let searchTimer = null;
  el.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const value = el.search.value;
    searchTimer = setTimeout(() => {
      state.query = value;
      el.allBtn.disabled = !!value.trim();
      render();
    }, 90);
  });

  el.searchClear.addEventListener('click', () => {
    el.search.value = '';
    state.query = '';
    el.allBtn.disabled = false;
    el.search.focus();
    render();
  });

  el.sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { closeSheet(false); return; }
    if (e.target.id === 'ingReset') {
      const mealId = history.state && history.state.sheet;
      if (!mealId) return;
      state.checks[mealId] = [];
      saveChecks();
      el.sheetBody.querySelectorAll('[data-ing-check]').forEach((b) => {
        b.checked = false;
        b.closest('.ing__row').classList.remove('is-done');
      });
      updateIngCount(mealId);
    }
  });
  el.sheetBody.addEventListener('change', onSheetBodyChange);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.sheet.hidden) closeSheet(false);
  });

  window.addEventListener('popstate', () => {
    if (!el.sheet.hidden) closeSheet(true);
  });

  /* ---------------- 홈 화면 추가 ---------------- */
  let installEvent = null;
  const standalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    if (!standalone) el.installBtn.hidden = false;
  });

  el.installBtn.addEventListener('click', async () => {
    if (!installEvent) return;
    installEvent.prompt();
    try {
      const choice = await installEvent.userChoice;
      if (choice && choice.outcome === 'accepted') el.installBtn.hidden = true;
    } catch (e) { /* ignore */ }
    installEvent = null;
  });

  window.addEventListener('appinstalled', () => { el.installBtn.hidden = true; });

  /* 홈 화면 추가 안내(설치 배너를 지원하지 않는 환경에서도 보이도록) */
  const HINT_KEY = 'mealplan.installHintDismissed';
  function updateHint() {
    const dismissed = localStorage.getItem(HINT_KEY) === '1';
    el.installHint.hidden = standalone || dismissed;
  }
  el.installHintClose.addEventListener('click', () => {
    try { localStorage.setItem(HINT_KEY, '1'); } catch (e) { /* private mode */ }
    updateHint();
  });
  updateHint();

  /* ---------------- 서비스 워커 ---------------- */
  if ('serviceWorker' in navigator) {
    // 새 버전 서비스워커가 제어를 가져오면(설치된 앱을 다시 열었을 때 등) 한 번만 새로 고쳐
    // 최신 화면이 바로 보이게 한다. 처음 설치할 때는 새로 고치지 않는다.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 미지원 환경 */ });
    });
  }

  load();
})();
