// Neural Trader Dashboard - Frontend Application

const INITIAL_CAPITAL = 100000;
const REFRESH_INTERVAL = 10000; // 10 seconds

let portfolioChart = null;
let pnlChart = null;
let symbolPrices = {}; // Cache symbol prices
let thinkingIntervalId = null;

// Format currency
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

// Format percentage
function formatPercent(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

// Format date
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Format time only
function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Update status indicator
function updateStatus(connected, lastUpdated) {
  const dot = document.getElementById('status-indicator');
  const text = document.getElementById('status-text');
  const updated = document.getElementById('last-updated');

  if (connected) {
    dot.classList.add('connected');
    text.textContent = 'Connected';
  } else {
    dot.classList.remove('connected');
    text.textContent = 'Disconnected';
  }

  if (lastUpdated) {
    updated.textContent = `| Last updated: ${formatDate(lastUpdated)}`;
  }
}

// Fetch portfolio data
async function fetchPortfolio() {
  try {
    const response = await fetch('/api/portfolio');
    const data = await response.json();
    updateStatus(true, data.lastUpdated || new Date().toISOString());
    return data;
  } catch (err) {
    console.error('Failed to fetch portfolio:', err);
    updateStatus(false);
    return null;
  }
}

// Fetch trading signals
async function fetchSignals() {
  try {
    const response = await fetch('/api/signals');
    return await response.json();
  } catch (err) {
    console.error('Failed to fetch signals:', err);
    return [];
  }
}

// Fetch available symbols
async function fetchSymbols() {
  try {
    const response = await fetch('/api/symbols');
    return await response.json();
  } catch (err) {
    console.error('Failed to fetch symbols:', err);
    return [];
  }
}

// Fetch model thinking log
async function fetchThinking() {
  try {
    const response = await fetch('/api/thinking');
    return await response.json();
  } catch (err) {
    console.error('Failed to fetch thinking:', err);
    return [];
  }
}

// Fetch price for a symbol
async function fetchPrice(symbol) {
  try {
    const response = await fetch(`/api/prices/${symbol}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.length > 0) {
      return data[data.length - 1].close;
    }
    return null;
  } catch (err) {
    return null;
  }
}

// Update portfolio summary
function updatePortfolioSummary(data) {
  const positions = data.positions || {};
  const positionsArray = Object.entries(positions);

  let positionsValue = 0;
  positionsArray.forEach(([symbol, pos]) => {
    positionsValue += pos.shares * pos.entryPrice;
  });

  const totalValue = data.cash + positionsValue;
  const totalReturn = ((totalValue - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

  document.getElementById('total-value').textContent = formatCurrency(totalValue);
  document.getElementById('cash').textContent = formatCurrency(data.cash);
  document.getElementById('positions-value').textContent = formatCurrency(positionsValue);

  const returnEl = document.getElementById('total-return');
  returnEl.textContent = formatPercent(totalReturn);
  returnEl.className = `metric-value ${totalReturn >= 0 ? 'positive' : 'negative'}`;

  document.getElementById('position-count').textContent = `${positionsArray.length}/10`;
}

// Update positions table
function updatePositionsTable(data) {
  const tbody = document.getElementById('positions-body');
  const positions = data.positions || {};
  const positionsArray = Object.entries(positions);

  if (positionsArray.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No open positions</td></tr>';
    return;
  }

  tbody.innerHTML = positionsArray.map(([symbol, pos]) => {
    const cleanSymbol = symbol.replace('-5-years', '');
    const currentValue = pos.shares * pos.entryPrice;
    const pnl = 0; // Would need current price for real P&L
    const pnlPercent = 0;

    return `
      <tr>
        <td><strong>${cleanSymbol}</strong></td>
        <td>${pos.shares}</td>
        <td>${formatCurrency(pos.entryPrice)}</td>
        <td>${formatCurrency(currentValue)}</td>
        <td class="${pnl >= 0 ? 'positive' : 'negative'}">${formatCurrency(pnl)}</td>
        <td>${formatCurrency(pos.stopLoss)}</td>
        <td>${formatCurrency(pos.takeProfit)}</td>
        <td>${formatDate(pos.entryDate)}</td>
        <td>
          <button class="btn btn-close" onclick="closePosition('${cleanSymbol}')">Close</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Update signals display
function updateSignals(signals) {
  const container = document.getElementById('signals-container');

  if (!signals || signals.length === 0) {
    container.innerHTML = '<div class="empty-state">No signals available</div>';
    return;
  }

  container.innerHTML = signals.map(signal => {
    const scoreClass = signal.score >= 0.46 ? 'high' : signal.score >= 0.44 ? 'medium' : 'low';
    const cleanSymbol = signal.symbol.replace('-5-years', '');
    return `
      <div class="signal-card" onclick="selectSymbol('${cleanSymbol}')">
        <div class="signal-symbol">${cleanSymbol}</div>
        <div class="signal-score ${scoreClass}">${(signal.score * 100).toFixed(1)}%</div>
        <div class="signal-details">
          <span>RF: ${(signal.rf * 100).toFixed(1)}%</span>
          <span>NN: ${(signal.nn * 100).toFixed(1)}%</span>
        </div>
      </div>
    `;
  }).join('');
}

// Update trade history
function updateTradeHistory(data) {
  const tbody = document.getElementById('history-body');
  const trades = data.tradeHistory || [];

  // Update stats
  const closedTrades = trades.filter(t => t.type === 'SELL');
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winningTrades = closedTrades.filter(t => t.pnl > 0).length;
  const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;

  document.getElementById('total-trades').textContent = `${trades.length} trades`;
  document.getElementById('win-rate').textContent = `Win Rate: ${winRate.toFixed(1)}%`;

  const pnlEl = document.getElementById('total-pnl');
  pnlEl.textContent = `Total P&L: ${formatCurrency(totalPnL)}`;
  pnlEl.style.color = totalPnL >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

  if (trades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No trade history</td></tr>';
    return;
  }

  // Show most recent trades first
  const sortedTrades = [...trades].reverse();

  tbody.innerHTML = sortedTrades.map(trade => {
    const typeClass = trade.type.toLowerCase();
    return `
      <tr>
        <td>${formatDate(trade.timestamp)}</td>
        <td><span class="trade-type ${typeClass}">${trade.type}</span></td>
        <td><strong>${trade.symbol.replace('-5-years', '')}</strong></td>
        <td>${trade.shares}</td>
        <td>${formatCurrency(trade.price)}</td>
        <td>${formatCurrency(trade.value)}</td>
        <td class="${(trade.pnl || 0) >= 0 ? 'positive' : 'negative'}">
          ${trade.type === 'SELL' ? formatCurrency(trade.pnl || 0) : '-'}
        </td>
        <td>${trade.reason || (trade.type === 'BUY' && trade.confidence ? `Conf: ${(trade.confidence * 100).toFixed(1)}%` : '-')}</td>
      </tr>
    `;
  }).join('');
}

// Update model thinking panel
function updateThinking(entries) {
  const container = document.getElementById('thinking-log');

  if (!entries || entries.length === 0) {
    container.innerHTML = '<div class="empty-state">Waiting for model analysis...</div>';
    return;
  }

  // Reverse so newest is at bottom (column-reverse makes bottom visible)
  const reversed = [...entries].reverse();

  container.innerHTML = reversed.map(entry => {
    const dataStr = Object.keys(entry.data).length > 0
      ? Object.entries(entry.data).map(([k, v]) => {
          if (typeof v === 'number') {
            return `${k}: ${v.toFixed ? v.toFixed(2) : v}`;
          }
          return `${k}: ${v}`;
        }).join(' | ')
      : '';

    return `
      <div class="thinking-entry ${entry.type}">
        <div class="thinking-time">${formatTime(entry.timestamp)}</div>
        <div class="thinking-message">${entry.message}</div>
        ${dataStr ? `<div class="thinking-data">${dataStr}</div>` : ''}
      </div>
    `;
  }).join('');
}

// Set thinking refresh rate
function setThinkingRefreshRate(ms) {
  if (thinkingIntervalId) {
    clearInterval(thinkingIntervalId);
  }
  thinkingIntervalId = setInterval(refreshThinking, ms);
}

// Initialize portfolio chart
function initPortfolioChart(data) {
  const ctx = document.getElementById('portfolio-chart').getContext('2d');
  const trades = data.tradeHistory || [];

  // Build portfolio value over time from trades
  let cash = INITIAL_CAPITAL;
  const values = [{ x: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), y: INITIAL_CAPITAL }];

  trades.forEach(trade => {
    if (trade.type === 'BUY') {
      cash -= trade.value;
    } else {
      cash += trade.value;
    }
    values.push({ x: new Date(trade.timestamp), y: cash });
  });

  // Add current value
  let positionsValue = 0;
  Object.values(data.positions || {}).forEach(pos => {
    positionsValue += pos.shares * pos.entryPrice;
  });
  values.push({ x: new Date(), y: data.cash + positionsValue });

  if (portfolioChart) {
    portfolioChart.destroy();
  }

  portfolioChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Portfolio Value',
        data: values,
        borderColor: '#4a9eff',
        backgroundColor: 'rgba(74, 158, 255, 0.1)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day' },
          grid: { color: '#2d3548' },
          ticks: { color: '#8b9ab5' }
        },
        y: {
          grid: { color: '#2d3548' },
          ticks: {
            color: '#8b9ab5',
            callback: value => formatCurrency(value)
          }
        }
      }
    }
  });
}

// Initialize P&L chart
function initPnLChart(data) {
  const ctx = document.getElementById('pnl-chart').getContext('2d');
  const trades = (data.tradeHistory || []).filter(t => t.type === 'SELL');

  if (trades.length === 0) {
    if (pnlChart) pnlChart.destroy();
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#8b9ab5';
    ctx.textAlign = 'center';
    ctx.fillText('No closed trades yet', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  const labels = trades.map(t => t.symbol.replace('-5-years', ''));
  const pnlData = trades.map(t => t.pnl || 0);
  const colors = pnlData.map(v => v >= 0 ? '#00d26a' : '#ff4757');

  if (pnlChart) {
    pnlChart.destroy();
  }

  pnlChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'P&L',
        data: pnlData,
        backgroundColor: colors
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: '#2d3548' },
          ticks: { color: '#8b9ab5' }
        },
        y: {
          grid: { color: '#2d3548' },
          ticks: {
            color: '#8b9ab5',
            callback: value => formatCurrency(value)
          }
        }
      }
    }
  });
}

// Load Chart.js date adapter
async function loadDateAdapter() {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

// Populate symbol dropdown
async function populateSymbols() {
  const select = document.getElementById('trade-symbol');
  const symbols = await fetchSymbols();

  // Add signals first (they have scores)
  const signals = await fetchSignals();
  const signalSymbols = signals.map(s => s.symbol.replace('-5-years', ''));

  // Clear and add options
  select.innerHTML = '<option value="">Select symbol...</option>';

  // Add signal symbols first with scores
  signals.forEach(signal => {
    const sym = signal.symbol.replace('-5-years', '');
    const opt = document.createElement('option');
    opt.value = sym;
    opt.textContent = `${sym} (${(signal.score * 100).toFixed(1)}%)`;
    select.appendChild(opt);
  });

  // Add other symbols
  symbols.filter(s => !signalSymbols.includes(s)).forEach(sym => {
    const opt = document.createElement('option');
    opt.value = sym;
    opt.textContent = sym;
    select.appendChild(opt);
  });
}

// Select symbol (from signal card click)
function selectSymbol(symbol) {
  const select = document.getElementById('trade-symbol');
  select.value = symbol;
  updateEstCost();
}

// Update estimated cost
async function updateEstCost() {
  const symbol = document.getElementById('trade-symbol').value;
  const shares = parseInt(document.getElementById('trade-shares').value) || 0;
  const estCostEl = document.getElementById('est-cost');

  if (!symbol || shares <= 0) {
    estCostEl.textContent = '$0.00';
    return;
  }

  // Fetch price if not cached
  if (!symbolPrices[symbol]) {
    symbolPrices[symbol] = await fetchPrice(symbol);
  }

  const price = symbolPrices[symbol];
  if (price) {
    estCostEl.textContent = formatCurrency(price * shares);
  } else {
    estCostEl.textContent = 'N/A';
  }
}

// Show trade message
function showTradeMessage(message, isError = false) {
  const el = document.getElementById('trade-message');
  el.textContent = message;
  el.className = `trade-message ${isError ? 'error' : 'success'}`;
  setTimeout(() => {
    el.textContent = '';
    el.className = 'trade-message';
  }, 3000);
}

// Execute buy
async function executeBuy() {
  const symbol = document.getElementById('trade-symbol').value;
  const shares = parseInt(document.getElementById('trade-shares').value);

  if (!symbol) {
    showTradeMessage('Please select a symbol', true);
    return;
  }

  if (!shares || shares <= 0) {
    showTradeMessage('Please enter valid shares', true);
    return;
  }

  try {
    const response = await fetch('/api/trade/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, shares })
    });

    const result = await response.json();

    if (response.ok) {
      showTradeMessage(`Bought ${shares} ${symbol} @ ${formatCurrency(result.trade.price)}`);
      await refresh();
    } else {
      showTradeMessage(result.error || 'Buy failed', true);
    }
  } catch (err) {
    showTradeMessage('Network error', true);
  }
}

// Execute sell
async function executeSell() {
  const symbol = document.getElementById('trade-symbol').value;
  const shares = parseInt(document.getElementById('trade-shares').value);

  if (!symbol) {
    showTradeMessage('Please select a symbol', true);
    return;
  }

  if (!shares || shares <= 0) {
    showTradeMessage('Please enter valid shares', true);
    return;
  }

  try {
    const response = await fetch('/api/trade/sell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, shares })
    });

    const result = await response.json();

    if (response.ok) {
      const pnlStr = result.trade.pnl >= 0 ? `+${formatCurrency(result.trade.pnl)}` : formatCurrency(result.trade.pnl);
      showTradeMessage(`Sold ${shares} ${symbol} (${pnlStr})`);
      await refresh();
    } else {
      showTradeMessage(result.error || 'Sell failed', true);
    }
  } catch (err) {
    showTradeMessage('Network error', true);
  }
}

// Close entire position
async function closePosition(symbol) {
  if (!confirm(`Close entire position in ${symbol}?`)) {
    return;
  }

  try {
    const response = await fetch('/api/trade/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol })
    });

    const result = await response.json();

    if (response.ok) {
      showTradeMessage(`Closed ${symbol} position`);
      await refresh();
    } else {
      showTradeMessage(result.error || 'Close failed', true);
    }
  } catch (err) {
    showTradeMessage('Network error', true);
  }
}

// Main refresh function
async function refresh() {
  const [portfolio, signals] = await Promise.all([
    fetchPortfolio(),
    fetchSignals()
  ]);

  if (portfolio) {
    updatePortfolioSummary(portfolio);
    updatePositionsTable(portfolio);
    updateTradeHistory(portfolio);
    initPortfolioChart(portfolio);
    initPnLChart(portfolio);
  }

  updateSignals(signals);
}

// Refresh thinking panel
async function refreshThinking() {
  const thinking = await fetchThinking();
  updateThinking(thinking);
}

// Initialize
async function init() {
  await loadDateAdapter();
  await populateSymbols();
  await refresh();
  await refreshThinking();

  // Set up event listeners
  document.getElementById('trade-symbol').addEventListener('change', updateEstCost);
  document.getElementById('trade-shares').addEventListener('input', updateEstCost);
  document.getElementById('btn-buy').addEventListener('click', executeBuy);
  document.getElementById('btn-sell').addEventListener('click', executeSell);

  // Refresh rate control
  const refreshRateSelect = document.getElementById('refresh-rate');
  refreshRateSelect.addEventListener('change', (e) => {
    setThinkingRefreshRate(parseInt(e.target.value));
  });

  // Auto-refresh
  setInterval(refresh, REFRESH_INTERVAL);
  setThinkingRefreshRate(parseInt(refreshRateSelect.value));
}

// Start app
init();
