import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as Data from "./data.js";
import { drawShotChart, loadShots } from "./ShotChart.js";

export const TEAM_ATTRIBUTES = [
  // [display name, row to value function]
  ["Wins", (r) => parseFloat(r["win"])],
  ["Average points", (r) => parseFloat(r["teamScore"])],
  ["Three points %", (r) => parseFloat(r["threePointersPercentage"])],
  ["Assists", (r) => parseFloat(r["assists"])],
  ["Rebounds", (r) => parseFloat(r["rebounds"])],
  ["Blocks", (r) => parseFloat(r["blocks"])],
  ["Steals", (r) => parseFloat(r["steals"])],
  // ["Win %", (r) => parseFloat(r["win"]) / parseFloat(r["gamesPlayed"])],
];

export const PLAYER_ATTRIBUTES = [
  // [display name, row to value function]
  ["Wins", (r) => parseFloat(r["win"])],
  ["Average points", (r) => parseFloat(r["points"])],
  ["Three points %", (r) => parseFloat(r["threePointersPercentage"])],
  ["Free throws %", (r) => parseFloat(r["freeThrowsPercentage"])],
  ["Assists", (r) => parseFloat(r["assists"])],
  ["Rebounds", (r) => parseFloat(r["rebounds"])],
  ["Blocks", (r) => parseFloat(r["blocks"])],
  ["Steals", (r) => parseFloat(r["steals"])],
];

export function updateTeamStats(container, seasonsLoader, metadataLoader, currentYear, teamId) {
  const name = container.querySelector(".name");
  const year = container.querySelector(".year");
  const content = container.querySelector(".content");

  name.innerText = metadataLoader.getValue(teamId, (row) => row["teamAbbrev"]);
  year.innerText = currentYear;

  let attributes = [TEAM_ATTRIBUTES[0], TEAM_ATTRIBUTES[1]];
  let attributesParse = attributes.map((a) => a[1]);
  let attributesDisplay = attributes.map((a) => a[0]);
  let seasonData = Data.filter_error_values(seasonsLoader.getData(currentYear, ...attributesParse));

  let teamData = seasonData.get(teamId);
  content.innerText = attributesDisplay.map((display, index) => display + ": " + teamData[index]).join("\n");
}

const _gamesCache = new Map();
let playerStatsReqId = 0;
let calInstance = null;
let gamesByDate = new Map();

async function loadPlayerGames(personId) {
  if (_gamesCache.has(personId)) return _gamesCache.get(personId);
  const rows = await d3.csv(`data/games_by_player/${personId}.csv`);
  _gamesCache.set(personId, rows);
  return rows;
}

function colAvg(rows, field) {
  const vals = rows.map(r => +r[field]).filter(v => isFinite(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function fmt(v, d = 1) {
  return isFinite(+v) ? (+v).toFixed(d) : '--';
}

function fmtPM(v) {
  const n = +v;
  return !isFinite(n) ? '--' : (n >= 0 ? '+' : '') + n.toFixed(1);
}

function fmtDate(str) {
  if (!str) return '--';
  const d = new Date(str);
  return isNaN(d) ? str.slice(0, 10) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderAverages(el, games) {
  el.innerHTML = '';
  if (!games.length) return;
  const wins = games.filter(r => +r.win === 1).length;
  const defs = [
    ['GP', games.length, null],
    ['W–L', `${wins}–${games.length - wins}`, null],
    ['PPG', colAvg(games, 'points'), 1],
    ['RPG', colAvg(games, 'reboundsTotal'), 1],
    ['APG', colAvg(games, 'assists'), 1],
    ['SPG', colAvg(games, 'steals'), 1],
    ['BPG', colAvg(games, 'blocks'), 1],
    ['FG%', colAvg(games, 'fieldGoalsPercentage') * 100, 1],
    ['3P%', colAvg(games, 'threePointersPercentage') * 100, 1],
    ['+/-', fmtPM(colAvg(games, 'plusMinusPoints')), null],
  ];
  defs.forEach(([label, val, dec]) => {
    const item = document.createElement('div');
    item.className = 'avg-item';
    const num = document.createElement('span');
    num.className = 'avg-num';
    num.textContent = dec !== null ? fmt(val, dec) : val;
    const lbl = document.createElement('span');
    lbl.className = 'avg-label';
    lbl.textContent = label;
    item.append(num, lbl);
    el.append(item);
  });
}

function renderCalendarHeatmap(games, currentYear, statsAreaEl) {
  if (calInstance) {
    try { calInstance.destroy(); } catch (e) {}
    calInstance = null;
  }

  gamesByDate = new Map();
  const source = [];
  games.forEach(r => {
    const dateStr = r.gameDateTimeEst ? r.gameDateTimeEst.slice(0, 10) : null;
    if (!dateStr) return;
    gamesByDate.set(dateStr, r);
    source.push({ date: dateStr, value: +r.points });
  });

  const maxPts = d3.max(games, d => +d.points) || 40;

  try {
    calInstance = new window.CalHeatmap();

    calInstance.on('click', (event, timestamp, value) => {
      event.stopPropagation();
      if (value == null) return;
      const d = new Date(timestamp);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const game = gamesByDate.get(dateStr);
      if (game) showGamePopup(event, game, statsAreaEl);
    });

    calInstance.paint({
      itemSelector: '#player-calendar',
      data: {
        source,
        x: 'date',
        y: 'value',
        defaultValue: null,
      },
      date: { start: new Date(currentYear, 9, 1) },
      range: 9,
      domain: {
        type: 'month',
        gutter: 6,
        label: { text: 'MMM', position: 'top' },
      },
      subDomain: {
        type: 'ghDay',
        radius: 2,
        width: 10,
        height: 10,
        gutter: 2,
      },
      scale: {
        color: {
          range: ['#0c2050', '#ffffff'],
          type: 'linear',
          domain: [0, maxPts],
        },
      },
      theme: 'dark',
    });
  } catch (e) {
    console.error('CalHeatmap error:', e);
  }
}

function showGamePopup(event, game, statsAreaEl) {
  let popup = statsAreaEl.querySelector('.game-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.className = 'game-popup';
    statsAreaEl.appendChild(popup);
  }

  const opp = [game.opponentteamCity, game.opponentteamName].filter(Boolean).join(' ') || '--';
  const won = +game.win === 1;
  const wl = won ? 'Win' : 'Loss';
  const ha = +game.home === 1 ? 'vs' : '@';
  const score = (game.homeScore && game.awayScore) ? `${game.homeScore}–${game.awayScore}` : '';

  popup.innerHTML = `
    <button class="popup-close">×</button>
    <div class="popup-matchup">
      <span class="popup-wl ${won ? 'popup-win' : 'popup-loss'}">${wl}</span>
      <span class="popup-opp">${ha} ${opp}</span>
      ${score ? `<span class="popup-score">${score}</span>` : ''}
    </div>
    <div class="popup-date">${fmtDate(game.gameDateTimeEst)}</div>
    <div class="popup-stats-grid">
      ${[
        ['MIN', isFinite(+game.numMinutes) ? Math.round(+game.numMinutes) : '--'],
        ['PTS', game.points],
        ['REB', game.reboundsTotal],
        ['AST', game.assists],
        ['STL', game.steals],
        ['BLK', game.blocks],
        ['+/-', fmtPM(+game.plusMinusPoints)],
        ['FG%', (+game.fieldGoalsPercentage * 100).toFixed(1)],
        ['3P%', (+game.threePointersPercentage * 100).toFixed(1)],
        ['FT%', (+game.freeThrowsPercentage * 100).toFixed(1)],
      ].map(([l, v]) => `<div class="popup-stat"><span class="popup-stat-num">${v}</span><span class="popup-stat-lbl">${l}</span></div>`).join('')}
    </div>
  `;

  const areaRect = statsAreaEl.getBoundingClientRect();
  let left = event.clientX - areaRect.left + 12;
  let top  = event.clientY - areaRect.top  + 12;
  if (left + 264 > areaRect.width  - 8) left = event.clientX - areaRect.left - 276;
  if (top  + 200 > areaRect.height - 8) top  = event.clientY - areaRect.top  - 212;

  popup.style.cssText = `display:block; left:${Math.max(8, left)}px; top:${Math.max(8, top)}px; transform:none;`;

  popup.querySelector('.popup-close').onclick = e => {
    e.stopPropagation();
    popup.style.display = 'none';
  };
}

function renderGamesChart(svgEl, games) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();
  if (!games.length) return;

  const rect = svgEl.getBoundingClientRect();
  const W = rect.width  || 380;
  const H = rect.height || 160;
  const m = { top: 16, right: 12, bottom: 22, left: 30 };
  const iW = W - m.left - m.right;
  const iH = H - m.top  - m.bottom;

  svg.attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');
  const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`);

  const maxPts = d3.max(games, d => +d.points) || 1;
  const x = d3.scaleBand().domain(d3.range(games.length)).range([0, iW]).padding(0.1);
  const y = d3.scaleLinear().domain([0, maxPts]).range([iH, 0]);

  g.selectAll('rect')
    .data(games)
    .join('rect')
    .attr('x', (_, i) => x(i))
    .attr('y', d => y(+d.points))
    .attr('width', x.bandwidth())
    .attr('height', d => iH - y(+d.points))
    .attr('fill', d => +d.win === 1 ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.2)');

  g.append('line')
    .attr('x1', 0).attr('y1', iH).attr('x2', iW).attr('y2', iH)
    .attr('stroke', 'rgba(255,255,255,0.12)').attr('stroke-width', 1);

  [0, maxPts].forEach(v => {
    g.append('text')
      .attr('x', -4).attr('y', y(v) + (v === 0 ? 0 : 4))
      .attr('text-anchor', 'end').attr('font-size', 9)
      .attr('fill', 'rgba(255,255,255,0.35)')
      .text(v);
  });

  g.append('text')
    .attr('x', iW / 2).attr('y', iH + 16)
    .attr('text-anchor', 'middle').attr('font-size', 9)
    .attr('fill', 'rgba(255,255,255,0.3)')
    .text('PTS per game');
}

export function updatePlayerStats(container, seasonsLoader, metadataLoader, currentYear, playerId) {
  container.querySelector('.name').innerText =
    metadataLoader.getValue(playerId, r => r['firstName'] + ' ' + r['lastName']);

  const statsArea = container.querySelector('.stats-area');

  if (!statsArea.dataset.popupListener) {
    statsArea.dataset.popupListener = '1';
    statsArea.addEventListener('click', e => {
      const popup = statsArea.querySelector('.game-popup');
      if (popup && popup.style.display !== 'none' && !popup.contains(e.target)) {
        popup.style.display = 'none';
      }
    });
  }

  const chartEl = document.getElementById("player-chart");
  const loadingSvg = d3.select(chartEl);
  loadingSvg.selectAll("*").remove();
  loadingSvg.attr("viewBox", "0 0 601 444").attr("preserveAspectRatio", "xMidYMid meet");
  loadingSvg.append("image").attr("href", "data/nba-court.svg").attr("width", 601).attr("height", 444);
  loadingSvg.append("text")
    .attr("x", 300).attr("y", 222)
    .attr("text-anchor", "middle")
    .attr("fill", "#ffffff").attr("font-size", 16)
    .text("Loading...");

  const reqId = ++playerStatsReqId;

  Promise.all([
    loadPlayerGames(playerId),
    loadShots(playerId, currentYear),
  ]).then(([allGames, shots]) => {
    if (reqId !== playerStatsReqId) return;

    const games = allGames
      .filter(r => +r.season === +currentYear && !r.gameType.toLowerCase().includes('pre'))
      .sort((a, b) => new Date(a.gameDateTimeEst || 0) - new Date(b.gameDateTimeEst || 0));

    renderAverages(container.querySelector('.player-averages'), games);
    renderCalendarHeatmap(games, currentYear, statsArea);
    renderGamesChart(document.getElementById('player-games-chart'), games);

    if (shots !== null) drawShotChart(chartEl, shots);
  }).catch(() => {
    if (reqId !== playerStatsReqId) return;
    d3.select(chartEl).selectAll('*').remove();
    d3.select(chartEl)
      .attr("viewBox", "0 0 601 444").attr("preserveAspectRatio", "xMidYMid meet")
      .append("text")
        .attr("x", 300).attr("y", 222)
        .attr("text-anchor", "middle")
        .attr("fill", "#ffffff").attr("font-size", 16)
        .text("Failed to load shot data");
  });
}