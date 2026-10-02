import { DASHBOARD_DEMO_DATA } from './demo-data.js?v=20260925-2';
import { signedPercent } from './formatters.js?v=20260925-2';
import {
  PRIVACY_MASK,
  displaySensitiveValue,
  redactCurrencyText,
  tokenizeCurrencyText,
} from './privacy.js?v=20260925-2';

(function () {
  'use strict';

  const data = DASHBOARD_DEMO_DATA;
  if (!data) {
    document.body.innerHTML = '<main class="fatal-state"><h1>Demo data could not be loaded</h1><p>Reload the local preview. No financial data was read.</p></main>';
    return;
  }

  const state = {
    view: 'overview',
    range: '1Y',
    privacy: false,
    holdingFilter: '',
  };
  const mobileNavQuery = window.matchMedia('(max-width: 900px)');
  let navReturnFocus = null;

  const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: data.meta.currency || 'USD',
    maximumFractionDigits: 0,
  });
  const preciseCurrency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: data.meta.currency || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const compactCurrency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: data.meta.currency || 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  });
  const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const longDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  const viewTitles = {
    overview: 'Overview',
    portfolio: 'Portfolio',
    accounts: 'Accounts',
    activity: 'Activity',
    goals: 'Goals',
    watchlist: 'Watchlist',
  };

  const icons = {
    assets: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 15 5-5 4 4 7-8"/><path d="M15 6h5v5"/></svg>',
    cash: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 12h.01M17 12h.01"/><circle cx="12" cy="12" r="2.5"/></svg>',
    debt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v18M18 3v18M3 7h18M3 17h18"/><path d="m9 14 6-4"/></svg>',
    flow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h12m0 0-3-3m3 3-3 3M20 16H8m0 0 3-3m-3 3 3 3"/></svg>',
  };

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function dateFromIso(value) {
    return new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  }

  function sensitive(value, className = '') {
    return `<span class="sensitive ${className}" data-sensitive-value="${escapeHtml(value)}">${escapeHtml(value)}</span>`;
  }

  function sensitiveNarrative(value) {
    return tokenizeCurrencyText(value).map((token) => token.sensitive
      ? sensitive(token.value)
      : escapeHtml(token.value)).join('');
  }

  function setSensitiveText(element, value) {
    if (!element) return;
    element.dataset.sensitiveValue = value;
    element.textContent = displaySensitiveValue(value, state.privacy);
  }

  function applyPrivacy(shouldAnnounce = true) {
    document.body.classList.toggle('privacy-on', state.privacy);
    document.querySelectorAll('[data-sensitive-value]').forEach((element) => {
      element.textContent = displaySensitiveValue(element.dataset.sensitiveValue, state.privacy);
    });
    const button = document.querySelector('[data-action="toggle-privacy"]');
    if (button) {
      button.setAttribute('aria-pressed', String(state.privacy));
      button.title = state.privacy ? 'Show financial amounts' : 'Hide financial amounts';
      button.setAttribute('aria-label', state.privacy ? 'Show financial amounts' : 'Hide financial amounts');
      button.querySelector('span').textContent = state.privacy ? 'Show' : 'Privacy';
    }
    if (shouldAnnounce) {
      announce(state.privacy ? 'Privacy mode enabled. Financial amounts are hidden.' : 'Privacy mode disabled. Financial amounts are visible.');
    }
  }

  /* Direction of a move. Zero is flat, not up: a 0.00% badge painted in the
     bullish color would claim a gain that did not happen. */
  function tone(change) {
    return change < 0 ? 'negative' : change > 0 ? 'positive' : 'neutral';
  }

  function sparkline(values, change, label = 'Recent trend') {
    const width = 96;
    const height = 34;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(0.0001, max - min);
    const points = values.map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - 3 - ((value - min) / spread) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const lineTone = tone(change);
    return `<svg class="sparkline" data-tone="${lineTone}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(label)}"><polyline points="${points}"/></svg>`;
  }

  function assetMark(symbol) {
    const palette = ['violet', 'coral', 'teal', 'gold', 'blue'];
    const index = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
    return `<span class="asset-mark asset-mark--${palette[index]}" aria-hidden="true">${escapeHtml(symbol.slice(0, 2))}</span>`;
  }

  function renderMeta() {
    document.title = `${data.meta.title} — Dashboard`;
    document.getElementById('demo-disclosure').textContent = data.meta.disclosure;
    const asOf = new Date(data.meta.asOf);
    document.getElementById('freshness-time').textContent = new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(asOf);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    document.querySelector('#overview-heading').textContent = `${greeting}, Pierson.`;
  }

  function renderChart(range = state.range) {
    const rows = data.ranges[range] || [];
    const svg = document.getElementById('net-worth-chart');
    if (!svg || !rows.length) return;

    const width = 760;
    const height = 265;
    const pad = { top: 22, right: 14, bottom: 12, left: 8 };
    const minValue = Math.min(...rows.map((row) => row.value));
    const maxValue = Math.max(...rows.map((row) => row.value));
    const spread = Math.max(1, maxValue - minValue);
    const low = minValue - spread * 0.2;
    const high = maxValue + spread * 0.12;
    const x = (index) => pad.left + (index / Math.max(1, rows.length - 1)) * (width - pad.left - pad.right);
    const y = (value) => pad.top + ((high - value) / (high - low)) * (height - pad.top - pad.bottom);
    const points = rows.map((row, index) => `${x(index).toFixed(1)},${y(row.value).toFixed(1)}`).join(' ');
    const area = `M ${x(0)} ${height - pad.bottom} L ${points.replaceAll(',', ' ')} L ${x(rows.length - 1)} ${height - pad.bottom} Z`;
    const grid = Array.from({ length: 4 }, (_, index) => {
      const gridY = pad.top + index * ((height - pad.top - pad.bottom) / 3);
      return `<line class="chart-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${gridY}" y2="${gridY}"/>`;
    }).join('');
    const pointNodes = rows.map((row, index) => `
      <g class="chart-point" data-chart-index="${index}" tabindex="0" role="img" aria-label="${longDate.format(dateFromIso(row.date))}: ${displaySensitiveValue(currency.format(row.value), state.privacy)} net worth">
        <circle class="chart-dot-halo" cx="${x(index)}" cy="${y(row.value)}" r="12"/>
        <circle class="chart-dot" cx="${x(index)}" cy="${y(row.value)}" r="4"/>
      </g>`).join('');

    const rising = rows.at(-1).value >= rows[0].value;
    svg.dataset.trend = rising ? 'up' : 'down';
    const chartNarrative = `Fictional net worth ${rising ? 'increased' : 'decreased'} from ${currency.format(rows[0].value)} to ${currency.format(rows.at(-1).value)}.`;
    svg.innerHTML = `
      <title id="chart-title">Net worth over ${range}</title>
      <desc id="chart-description">${redactCurrencyText(chartNarrative, state.privacy)}</desc>
      <defs><linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1"><stop class="chart-fill-top" offset="0%"/><stop class="chart-fill-bottom" offset="100%"/></linearGradient></defs>
      ${grid}
      <path class="chart-area" d="${area}"/>
      <polyline class="chart-line" points="${points}"/>
      ${pointNodes}`;

    const first = rows[0].value;
    const last = rows.at(-1).value;
    const percent = ((last - first) / first) * 100;
    setSensitiveText(document.getElementById('net-worth-value'), currency.format(last));
    const changeElement = document.getElementById('net-worth-change');
    changeElement.classList.remove('negative', 'positive', 'neutral');
    changeElement.classList.add(tone(percent));
    changeElement.innerHTML = `<span aria-hidden="true">${percent >= 0 ? '↗' : '↘'}</span> ${signedPercent(percent)} <small>for ${range}</small>`;

    const axis = document.getElementById('chart-axis');
    const labelRows = rows.length <= 6 ? rows : [rows[0], rows[Math.floor((rows.length - 1) / 2)], rows.at(-1)];
    axis.innerHTML = labelRows.map((row) => `<span>${shortDate.format(dateFromIso(row.date))}${range === '1Y' ? ` '${String(row.date).slice(2, 4)}` : ''}</span>`).join('');

    svg.querySelectorAll('[data-chart-index]').forEach((point) => {
      const show = () => showChartTooltip(rows[Number(point.dataset.chartIndex)], point);
      point.addEventListener('pointerenter', show);
      point.addEventListener('focus', show);
      point.addEventListener('pointerleave', hideChartTooltip);
      point.addEventListener('blur', hideChartTooltip);
    });
  }

  function showChartTooltip(row, point) {
    const tooltip = document.getElementById('chart-tooltip');
    const pointCircle = point.querySelector('.chart-dot');
    tooltip.innerHTML = `<time>${longDate.format(dateFromIso(row.date))}</time><strong>${displaySensitiveValue(currency.format(row.value), state.privacy)}</strong><span>Assets ${displaySensitiveValue(compactCurrency.format(row.assets), state.privacy)}</span><span>Liabilities ${displaySensitiveValue(compactCurrency.format(row.liabilities), state.privacy)}</span>`;
    tooltip.style.left = `${(Number(pointCircle.getAttribute('cx')) / 760) * 100}%`;
    tooltip.style.top = `${(Number(pointCircle.getAttribute('cy')) / 265) * 100}%`;
    tooltip.hidden = false;
  }

  function hideChartTooltip() {
    document.getElementById('chart-tooltip').hidden = true;
  }

  function renderSummary() {
    const summary = data.summary;
    const metrics = [
      { label: 'Total assets', value: currency.format(summary.assets), detail: 'Across cash and investments', icon: icons.assets, tone: 'violet' },
      { label: 'Liquid cash', value: currency.format(summary.cash), detail: `${summary.liquidityMonths.toFixed(1)} months of spending`, icon: icons.cash, tone: 'teal' },
      { label: 'Total liabilities', value: currency.format(summary.liabilities), detail: 'Credit and student loan', icon: icons.debt, tone: 'gold' },
      { label: 'Monthly cash flow', value: currency.format(summary.monthlyCashFlow), detail: `${summary.savingsRate.toFixed(1)}% savings rate`, icon: icons.flow, tone: 'coral' },
    ];
    document.getElementById('metric-grid').innerHTML = metrics.map((metric) => `
      <article class="metric-card">
        <span class="metric-icon metric-icon--${metric.tone}">${metric.icon}</span>
        <div><p>${escapeHtml(metric.label)}</p><strong>${sensitive(metric.value)}</strong><small>${escapeHtml(metric.detail)}</small></div>
      </article>`).join('');

    document.getElementById('health-score').textContent = summary.healthScore;
    document.getElementById('health-ring').style.setProperty('--score', `${summary.healthScore * 3.6}deg`);
    document.getElementById('health-ring').setAttribute('aria-label', `Financial health score ${summary.healthScore} out of 100, based on fictional data`);
    document.getElementById('savings-rate').textContent = `${summary.savingsRate.toFixed(1)}%`;
    document.getElementById('liquidity-months').textContent = `${summary.liquidityMonths.toFixed(1)} months`;
    document.getElementById('debt-load').textContent = `${((summary.liabilities / summary.assets) * 100).toFixed(1)}%`;
  }

  function renderAllocation() {
    const total = data.allocation.reduce((sum, item) => sum + item.value, 0);
    let cursor = 0;
    const segments = data.allocation.map((item) => {
      const start = cursor;
      cursor += (item.value / total) * 100;
      return `${item.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    const donut = document.getElementById('allocation-donut');
    donut.style.background = `conic-gradient(${segments.join(', ')})`;
    donut.setAttribute('aria-label', data.allocation.map((item) => `${item.label} ${((item.value / total) * 100).toFixed(0)} percent`).join(', '));
    setSensitiveText(document.getElementById('invested-total'), compactCurrency.format(data.summary.invested));
    document.getElementById('allocation-legend').innerHTML = data.allocation.map((item) => {
      const percent = (item.value / total) * 100;
      return `<div class="legend-row"><span class="legend-dot" style="--legend-color:${escapeHtml(item.color)}"></span><span>${escapeHtml(item.label)}</span><strong>${percent.toFixed(1)}%</strong></div>`;
    }).join('');
  }

  function renderCashFlow() {
    const max = Math.max(data.summary.monthlyIncome, data.summary.monthlySpending);
    setSensitiveText(document.getElementById('cashflow-net'), `+${currency.format(data.summary.monthlyCashFlow)}`);
    const rows = [
      { label: 'Income', value: data.summary.monthlyIncome, className: 'income' },
      { label: 'Spending', value: data.summary.monthlySpending, className: 'spending' },
    ];
    document.getElementById('cashflow-bars').innerHTML = rows.map((row) => `
      <div class="cashflow-row"><div><span>${row.label}</span>${sensitive(currency.format(row.value), 'cashflow-value')}</div><div class="bar-track"><span class="bar-fill bar-fill--${row.className}" style="width:${(row.value / max) * 100}%"></span></div></div>`).join('');
  }

  function holdingRow(holding, compact = false) {
    if (compact) {
      return `<tr><td><div class="asset-cell">${assetMark(holding.symbol)}<span><strong>${escapeHtml(holding.symbol)}</strong><small>${escapeHtml(holding.name)}</small></span></div></td><td>${sparkline(holding.sparkline, holding.dayChange, `${holding.symbol} seven-point demo trend`)}</td><td><span class="change-badge ${tone(holding.dayChange)}">${signedPercent(holding.dayChange)}</span></td><td class="numeric">${sensitive(currency.format(holding.value))}</td></tr>`;
    }
    return `<tr><td><div class="asset-cell">${assetMark(holding.symbol)}<span><strong>${escapeHtml(holding.symbol)}</strong><small>${escapeHtml(holding.name)}</small></span></div></td><td>${escapeHtml(holding.account)}</td><td class="numeric">${sensitive(number.format(holding.shares))}</td><td class="numeric">${sensitive(preciseCurrency.format(holding.price))}</td><td class="numeric">${holding.portfolioWeight.toFixed(1)}%</td><td><span class="change-badge ${tone(holding.dayChange)}">${signedPercent(holding.dayChange)}</span></td><td class="numeric">${sensitive(currency.format(holding.value))}</td></tr>`;
  }

  function renderHoldings() {
    document.getElementById('overview-holdings').innerHTML = data.holdings.slice(0, 4).map((holding) => holdingRow(holding, true)).join('');
    const filtered = data.holdings.filter((holding) => `${holding.symbol} ${holding.name} ${holding.account}`.toLowerCase().includes(state.holdingFilter.toLowerCase()));
    document.getElementById('portfolio-table').innerHTML = filtered.length
      ? filtered.map((holding) => holdingRow(holding)).join('')
      : '<tr><td colspan="7"><div class="table-empty"><strong>No matching holdings</strong><span>Try a symbol, fund name, or account.</span></div></td></tr>';

    const summaries = [
      ['Invested value', currency.format(data.summary.invested), 'Across 7 synthetic positions'],
      ['Largest position', `${data.holdings[0].portfolioWeight.toFixed(1)}%`, `${data.holdings[0].symbol} · fictional weight`],
      ['Asset mix', `${data.allocation.length} groups`, 'Diversified demo allocation'],
    ];
    document.getElementById('portfolio-summary').innerHTML = summaries.map(([label, value, detail], index) => `<article class="summary-tile"><p>${label}</p><strong>${index === 0 ? sensitive(value) : escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`).join('');
  }

  function renderAttention() {
    document.getElementById('attention-count').textContent = data.attention.length;
    document.getElementById('attention-list').innerHTML = data.attention.map((item) => `
      <button class="attention-item" type="button" data-action="attention" data-tone="${escapeHtml(item.tone)}">
        <span class="attention-dot" aria-hidden="true"></span>
        <span><strong>${escapeHtml(item.title)}</strong><small>${sensitiveNarrative(item.detail)}</small></span>
        <span class="attention-arrow" aria-hidden="true">→</span>
      </button>`).join('');
  }

  function goalMarkup(goal, featured = false) {
    const percent = Math.min(100, (goal.current / goal.target) * 100);
    return `<article class="${featured ? 'featured-goal-inner' : 'card goal-card'}">
      <div class="goal-top"><span class="goal-icon" aria-hidden="true">${featured ? '↗' : '◎'}</span><span class="goal-status">${goal.status === 'on-track' ? 'On track' : 'Watch'}</span></div>
      <h3>${escapeHtml(goal.name)}</h3>
      <div class="goal-values"><span>${sensitive(currency.format(goal.current))}</span><small>of ${sensitive(currency.format(goal.target))}</small><strong>${percent.toFixed(0)}%</strong></div>
      <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent.toFixed(0)}" aria-label="${escapeHtml(goal.name)} progress"><span style="width:${percent}%"></span></div>
      <p>Target ${longDate.format(dateFromIso(goal.due))}</p>
    </article>`;
  }

  function renderGoals() {
    document.getElementById('featured-goal').innerHTML = goalMarkup(data.goals[0], true);
    document.getElementById('goal-grid').innerHTML = data.goals.map((goal) => goalMarkup(goal)).join('');
  }

  function renderAccounts() {
    document.getElementById('account-grid').innerHTML = data.accounts.map((account) => {
      const isDebt = account.balance < 0;
      const label = { cash: 'Cash', investment: 'Brokerage', retirement: 'Retirement', credit: 'Credit', loan: 'Loan' }[account.type] || account.type;
      return `<article class="card account-card"><div class="account-card-top"><span class="account-icon account-icon--${escapeHtml(account.type)}" aria-hidden="true">${isDebt ? '−' : '↗'}</span><span class="status-pill status-pill--neutral">${escapeHtml(label)}</span></div><p>${escapeHtml(account.institution)}</p><h3>${escapeHtml(account.name)}</h3><strong>${sensitive(currency.format(Math.abs(account.balance)))}</strong><small>${isDebt ? 'Amount owed' : 'Current balance'} · updated ${shortDate.format(new Date(account.lastUpdated))}</small></article>`;
    }).join('');
  }

  function renderActivity() {
    document.getElementById('activity-list').innerHTML = data.activity.map((item) => {
      const incoming = item.amount >= 0;
      return `<div class="activity-row"><span class="activity-icon" data-incoming="${incoming}" aria-hidden="true">${incoming ? '↓' : '↑'}</span><span class="activity-main"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.account)} · ${escapeHtml(item.category)}</small></span><time datetime="${escapeHtml(item.date)}">${shortDate.format(dateFromIso(item.date))}</time><strong class="activity-amount ${incoming ? 'positive' : ''}">${sensitive(`${incoming ? '+' : '−'}${preciseCurrency.format(Math.abs(item.amount))}`)}</strong></div>`;
    }).join('');
  }

  function renderWatchlist() {
    document.getElementById('watch-grid').innerHTML = data.watchlist.map((item) => {
      return `<article class="card watch-card"><div class="watch-card-top">${assetMark(item.symbol)}<span class="change-badge ${tone(item.dayChange)}">${signedPercent(item.dayChange)}</span></div><div><p>${escapeHtml(item.name)}</p><h3>${escapeHtml(item.symbol)}</h3></div><strong class="watch-price">${sensitive(preciseCurrency.format(item.price))}</strong>${sparkline(item.sparkline, item.dayChange, `${item.symbol} fictional seven-point trend`)}<p class="watch-note">${escapeHtml(item.note)}</p><button type="button" class="text-button" data-action="prototype-only">Open research <span aria-hidden="true">→</span></button></article>`;
    }).join('');
  }

  function syncMobileNavigation(open = document.querySelector('.app-shell').dataset.navOpen === 'true') {
    const mobile = mobileNavQuery.matches;
    const sidebar = document.getElementById('primary-sidebar');
    const main = document.getElementById('main-content');
    const menuButton = document.querySelector('[data-action="open-nav"]');
    sidebar.inert = mobile && !open;
    main.inert = mobile && open;
    if (mobile && !open) sidebar.setAttribute('aria-hidden', 'true');
    else sidebar.removeAttribute('aria-hidden');
    if (mobile && open) main.setAttribute('aria-hidden', 'true');
    else main.removeAttribute('aria-hidden');
    menuButton.setAttribute('aria-expanded', String(mobile && open));
  }

  function setMobileNavigation(open, { restoreFocus = false } = {}) {
    const shell = document.querySelector('.app-shell');
    if (open) navReturnFocus = document.activeElement;
    shell.dataset.navOpen = String(Boolean(open));
    document.body.classList.toggle('nav-open', Boolean(open));
    syncMobileNavigation(Boolean(open));
    if (open) {
      requestAnimationFrame(() => document.querySelector('[data-action="close-nav"]')?.focus());
    } else if (restoreFocus && navReturnFocus instanceof HTMLElement) {
      requestAnimationFrame(() => navReturnFocus.focus());
    }
  }

  function changeView(nextView, { updateHash = true, focus = true } = {}) {
    if (!viewTitles[nextView]) return;
    state.view = nextView;
    document.querySelectorAll('[data-view-panel]').forEach((panel) => {
      const active = panel.dataset.viewPanel === nextView;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
    document.querySelectorAll('[data-view]').forEach((button) => {
      const active = button.dataset.view === nextView;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    document.getElementById('page-title').textContent = viewTitles[nextView];
    setMobileNavigation(false);
    if (updateHash) history.replaceState(null, '', `#${nextView}`);
    if (focus) document.querySelector(`[data-view-panel="${nextView}"] h2`)?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function openCommand() {
    const dialog = document.getElementById('command-dialog');
    document.getElementById('command-input').value = '';
    renderCommandResults('');
    dialog.showModal();
    requestAnimationFrame(() => document.getElementById('command-input').focus());
  }

  function renderCommandResults(query) {
    const matches = Object.entries(viewTitles).filter(([, title]) => title.toLowerCase().includes(query.trim().toLowerCase()));
    document.getElementById('command-results').innerHTML = matches.length
      ? matches.map(([view, title], index) => `<button type="button" data-command-view="${view}" ${index === 0 ? 'data-first-result="true"' : ''}><span><strong>${title}</strong><small>Open ${title.toLowerCase()}</small></span><kbd>↵</kbd></button>`).join('')
      : '<p>No matching dashboard section.</p>';
  }

  function announce(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => { toast.hidden = true; }, 2800);
  }

  /* ---------------------------------------------------- market colors */

  const palette = window.DashboardPalette;

  function swatch(color) {
    return `<span class="swatch" style="--swatch:${color.hex}" aria-hidden="true"></span>`;
  }

  /* A tiny stand-in for the real thing: two candles and a badge each way,
     drawn in the palette's own colors, so the choice is made by looking. */
  function palettePreview(p) {
    return `<span class="palette-preview" aria-hidden="true" style="--p-bull:${p.bull.hex};--p-bear:${p.bear.hex}">
      <svg viewBox="0 0 120 44"><polyline class="pv-line" points="2,34 18,30 32,33 48,22 62,25 78,14 94,17 118,6"/>
      <g class="pv-up"><line x1="100" y1="10" x2="100" y2="38"/><rect x="95" y="16" width="10" height="16" rx="1.5"/></g>
      <g class="pv-down"><line x1="112" y1="8" x2="112" y2="36"/><rect x="107" y="12" width="10" height="18" rx="1.5"/></g></svg>
      <span class="pv-badges"><b class="pv-badge pv-badge--up">+2.41%</b><b class="pv-badge pv-badge--down">−1.18%</b></span>
    </span>`;
  }

  function renderPaletteOptions() {
    const current = palette.load();
    document.getElementById('palette-options').innerHTML = palette.PALETTES.map((p) => `
      <label class="palette-option">
        <input type="radio" name="market-palette" value="${p.id}" ${p.id === current ? 'checked' : ''}>
        <span class="palette-card">
          <span class="palette-head">
            <strong>${escapeHtml(p.name)}</strong>
            <span class="palette-pair">${swatch(p.bull)}<small>${escapeHtml(p.bull.label)} up</small>${swatch(p.bear)}<small>${escapeHtml(p.bear.label)} down</small></span>
          </span>
          ${palettePreview(p)}
          <span class="palette-note">${escapeHtml(p.note)}</span>
        </span>
      </label>`).join('');
  }

  function openSettings() {
    renderPaletteOptions();
    const dialog = document.getElementById('settings-dialog');
    dialog.showModal();
    dialog.querySelector('input[name="market-palette"]:checked')?.focus();
  }

  function bindEvents() {
    document.getElementById('palette-options').addEventListener('change', (event) => {
      if (event.target.name !== 'market-palette') return;
      const chosen = palette.apply(event.target.value);
      const saved = palette.save(chosen.id);
      announce(`Market colors: ${chosen.bull.label.toLowerCase()} up, ${chosen.bear.label.toLowerCase()} down${saved ? '' : ' (this browser will not remember it)'}.`);
    });

    document.addEventListener('click', (event) => {
      const viewButton = event.target.closest('[data-view]');
      if (viewButton) return changeView(viewButton.dataset.view);
      const jump = event.target.closest('[data-view-jump]');
      if (jump) return changeView(jump.dataset.viewJump);
      const command = event.target.closest('[data-command-view]');
      if (command) {
        document.getElementById('command-dialog').close();
        return changeView(command.dataset.commandView);
      }
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'open-nav') {
        setMobileNavigation(true);
      } else if (action === 'close-nav') {
        setMobileNavigation(false, { restoreFocus: true });
      } else if (action === 'toggle-privacy') {
        state.privacy = !state.privacy;
        applyPrivacy();
        renderChart();
      } else if (action === 'search') {
        openCommand();
      } else if (action === 'about-demo') {
        document.getElementById('info-dialog').showModal();
      } else if (action === 'show-settings') {
        openSettings();
      } else if (action === 'prototype-only') {
        announce('This action is intentionally disabled in the data-safe prototype.');
      } else if (action === 'attention') {
        announce('This review workflow will connect to the matching account or goal.');
      }
    });

    document.querySelectorAll('[data-range]').forEach((button) => {
      button.addEventListener('click', () => {
        state.range = button.dataset.range;
        document.querySelectorAll('[data-range]').forEach((candidate) => {
          const active = candidate === button;
          candidate.classList.toggle('is-active', active);
          candidate.setAttribute('aria-pressed', String(active));
        });
        renderChart(state.range);
      });
    });

    document.getElementById('holding-filter').addEventListener('input', (event) => {
      state.holdingFilter = event.target.value;
      renderHoldings();
      applyPrivacy(false);
    });

    document.getElementById('command-input').addEventListener('input', (event) => renderCommandResults(event.target.value));
    document.getElementById('command-input').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        document.querySelector('[data-first-result]')?.click();
      }
    });
    document.addEventListener('keydown', (event) => {
      const navOpen = document.querySelector('.app-shell').dataset.navOpen === 'true';
      if (event.key === 'Escape' && mobileNavQuery.matches && navOpen) {
        event.preventDefault();
        setMobileNavigation(false, { restoreFocus: true });
        return;
      }
      if (event.key === 'Tab' && mobileNavQuery.matches && navOpen) {
        const focusable = [...document.querySelectorAll('#primary-sidebar a[href], #primary-sidebar button:not([disabled])')]
          .filter((element) => element.offsetParent !== null);
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openCommand();
      }
    });
    mobileNavQuery.addEventListener('change', () => {
      setMobileNavigation(false);
      syncMobileNavigation(false);
    });
    window.addEventListener('hashchange', () => changeView(location.hash.slice(1), { updateHash: false, focus: false }));
  }

  function init() {
    renderMeta();
    renderSummary();
    renderAllocation();
    renderCashFlow();
    renderHoldings();
    renderAttention();
    renderGoals();
    renderAccounts();
    renderActivity();
    renderWatchlist();
    renderChart();
    bindEvents();
    syncMobileNavigation(false);
    const initialView = location.hash.slice(1);
    if (viewTitles[initialView]) changeView(initialView, { updateHash: false, focus: false });
    applyPrivacy(false);
  }

  init();
})();
