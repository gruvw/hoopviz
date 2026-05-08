import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as Utils from "./utils.js";
import * as Data from "./data.js";
import { RadarChart } from "../radar_chart/radarChart.js";

// TODO set all attributes

export const TEAM_ATTRIBUTES = [
  // [display name, row to value function]
  ["Wins", (r) => parseFloat(r["win"])],
  ["Points", (r) => parseFloat(r["teamScore"])],
  ["Three points %", (r) => parseFloat(r["threePointersPercentage"])],
  ["Assists", (r) => parseFloat(r["assists"])],
  ["Rebounds", (r) => parseFloat(r["rebounds"])],
  ["Blocks", (r) => parseFloat(r["blocks"])],
  ["Steals", (r) => parseFloat(r["steals"])],
  ["Turnovers", (r) => parseFloat(r["turnovers"])],
  ["Fouls", (r) => parseFloat(r["foulsPersonal"])],
  ["Salaries (M)", (r) => parseFloat(r["salary"]) / 1e6],
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
  ["Turnovers", (r) => parseFloat(r["turnovers"])],
  ["Fouls", (r) => parseFloat(r["foulsPersonal"])],
  ["Salaries (M)", (r) => parseFloat(r["salary"]) / 1e6],
];

function getMetaValue(metadataLoader, id, getter, year) {
  if (typeof metadataLoader.getValueForSeason === "function") {
    return metadataLoader.getValueForSeason(id, getter, year);
  }
  return metadataLoader.getValue(id, getter);
}

function formatValue(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "N/A";
}

export const TRANSITION_TIME = 500;
const RADAR_AXES = 6;
const EVOLUTION_COLOR_A = "#2e7d32";
const EVOLUTION_COLOR_B = "#1e40af";
const EVOLUTION_TOOLTIP_PADDING = 12;
const EVOLUTION_DATA_URLS = [
  "./data/team_games.csv",
];
const TEAM_SEASON_URLS = [
  "./data/team_seasons.csv",
];

let evolutionDataPromise = null;
let teamSeasonDataPromise = null;

function getAttributeByLabel(label) {
  return TEAM_ATTRIBUTES.find((attribute) => attribute[0] === label);
}

function coerceNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function isColorTooLight(color) {
  if (!color) return false;
  const hex = color.trim();
  if (!hex.startsWith("#")) return false;
  const full = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.85;
}

function resolveColor(color, fallback) {
  return (color && !isColorTooLight(color)) ? color : fallback;
}

function averageArrays(arrays) {
  if (!arrays || arrays.length === 0) return [];
  const length = arrays[0].length;
  const sums = new Array(length).fill(0);
  const counts = new Array(length).fill(0);
  arrays.forEach((arr) => {
    arr.forEach((value, index) => {
      if (Number.isFinite(value)) {
        sums[index] += value;
        counts[index] += 1;
      }
    });
  });
  return sums.map((sum, index) => counts[index] ? sum / counts[index] : 0);
}

function getRankMap(rows, year, gameType) {
  const teams = rows
    .filter((row) => row.season === String(year) && row.gameType === gameType)
    .map((row) => {
      const wins = parseFloat(row.win) || 0;
      const losses = parseFloat(row.losses) || Math.max(0, (parseFloat(row.gamesPlayed) || 0) - wins);
      const games = wins + losses;
      const winPct = games ? wins / games : 0;
      return { teamId: row.teamId, wins, losses, winPct };
    });

  teams.sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);
  const rankById = new Map();
  teams.forEach((team, index) => {
    rankById.set(team.teamId, { rank: index + 1, wins: team.wins, losses: team.losses });
  });
  return rankById;
}

function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return "N/A";
  return value.toFixed(decimals);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getTeamLogoUrl(metadataLoader, teamId, year) {
  const teamSlug = getMetaValue(metadataLoader, teamId, (row) => row["teamSlug"], year);
  if (!teamSlug) return null;
  const activeTill = getMetaValue(metadataLoader, teamId, (row) => row["seasonActiveTill"], year);
  const activeTillYear = parseInt(activeTill, 10);
  const logoYear = Number.isNaN(activeTillYear) ? year : activeTillYear;
  const logoYearSegment = logoYear > 2024 ? "current" : logoYear;
  return `https://i.logocdn.com/nba/${logoYearSegment}/${teamSlug}.svg`;
}

async function updateMatchups(container, currentYear, teamId, metadataLoader) {
  const winSlots = container.querySelectorAll(".matchup-card.win .matchup-slot");
  const loseSlots = container.querySelectorAll(".matchup-card.lose .matchup-slot");

  const clearSlots = (slots) => {
    slots.forEach((slot) => {
      slot.innerHTML = "";
    });
  };

  let rows = [];
  try {
    rows = await loadEvolutionData();
  } catch (error) {
    clearSlots(winSlots);
    clearSlots(loseSlots);
    return;
  }

  const teamRows = rows.filter((row) => {
    return row.season === String(currentYear)
      && row.teamId === String(teamId)
      && row.gameType === "Regular Season";
  });

  const winCounts = new Map();
  const lossCounts = new Map();
  const totalCounts = new Map();
  const opponentNames = new Map();
  const opponentPointsFor = new Map();
  const opponentPointsAgainst = new Map();
  const opponentGames = new Map();

  teamRows.forEach((row) => {
    const opponentId = row.opponentTeamId;
    if (!opponentId) return;
    const isWin = Number(row.win) === 1;
    const target = isWin ? winCounts : lossCounts;
    target.set(opponentId, (target.get(opponentId) || 0) + 1);
    totalCounts.set(opponentId, (totalCounts.get(opponentId) || 0) + 1);
    const teamScore = coerceNumber(row.teamScore);
    const opponentScore = coerceNumber(row.opponentScore);
    if (Number.isFinite(teamScore)) {
      opponentPointsFor.set(opponentId, (opponentPointsFor.get(opponentId) || 0) + teamScore);
    }
    if (Number.isFinite(opponentScore)) {
      opponentPointsAgainst.set(opponentId, (opponentPointsAgainst.get(opponentId) || 0) + opponentScore);
    }
    if (!opponentNames.has(opponentId)) {
      const name = [row.opponentTeamCity, row.opponentTeamName].filter(Boolean).join(" ");
      opponentNames.set(opponentId, name || "Opponent");
    }
    if (!opponentGames.has(opponentId)) {
      opponentGames.set(opponentId, []);
    }
    opponentGames.get(opponentId).push(row);
  });

  const getTopOpponentsByRate = (counts) => {
    return [...counts.entries()]
      .map(([opponentId, count]) => {
        const total = totalCounts.get(opponentId) || 0;
        const rate = total ? count / total : 0;
        return { opponentId, count, total, rate };
      })
      .sort((a, b) => {
        if (b.rate !== a.rate) return b.rate - a.rate;
        if (b.total !== a.total) return b.total - a.total;
        return b.count - a.count;
      })
      .slice(0, 4)
      .map((entry) => entry.opponentId);
  };

  const topWins = getTopOpponentsByRate(winCounts);
  const topLosses = getTopOpponentsByRate(lossCounts);

  const clampTooltip = (tooltip, clientX, clientY) => {
    const tooltipRect = tooltip.getBoundingClientRect();
    const padding = 12;
    let left = clientX + padding;
    let top = clientY - tooltipRect.height - padding;
    if (left + tooltipRect.width > window.innerWidth) {
      left = clientX - tooltipRect.width - padding;
    }
    if (top < padding) {
      top = clientY + padding;
    }
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));
    tooltip.style.transform = `translate(${left}px, ${top}px)`;
  };

  const fillSlots = (slots, teamIds, mode) => {
    slots.forEach((slot, index) => {
      slot.innerHTML = "";
      const opponentId = teamIds[index];
      if (!opponentId) return;
      const logoUrl = getTeamLogoUrl(metadataLoader, opponentId, currentYear);
      if (!logoUrl) return;
      const total = totalCounts.get(opponentId) || 0;
      const wins = winCounts.get(opponentId) || 0;
      const losses = lossCounts.get(opponentId) || 0;
      const pointsFor = opponentPointsFor.get(opponentId) || 0;
      const pointsAgainst = opponentPointsAgainst.get(opponentId) || 0;
      const avgFor = total ? pointsFor / total : 0;
      const avgAgainst = total ? pointsAgainst / total : 0;
      const label = opponentNames.get(opponentId) || "Opponent";
      const recordLabel = `${wins}-${losses}`;
      const avgScoreLabel = total
        ? `Avg score ${formatNumber(avgFor, 1)} - ${formatNumber(avgAgainst, 1)}`
        : "Avg score N/A";
      const recentGames = (opponentGames.get(opponentId) || [])
        .slice()
        .sort((a, b) => new Date(a.gameDateTimeEst || 0) - new Date(b.gameDateTimeEst || 0))
        .slice(-3)
        .reverse();
      const recentMarkup = recentGames.map((game) => {
        const date = formatDate(game.gameDateTimeEst);
        const teamScore = formatNumber(coerceNumber(game.teamScore), 0);
        const opponentScore = formatNumber(coerceNumber(game.opponentScore), 0);
        const result = Number(game.win) === 1 ? "W" : "L";
        return `<div class="matchup-tooltip-row">${date} · ${result} ${teamScore}-${opponentScore}</div>`;
      }).join("");
      const img = document.createElement("img");
      img.src = logoUrl;
      img.alt = label;
      img.decoding = "async";
      img.loading = "lazy";
      const logoWrapper = document.createElement("div");
      logoWrapper.className = "matchup-logo";
      logoWrapper.appendChild(img);
      const tooltip = document.createElement("div");
      tooltip.className = "matchup-tooltip";
      tooltip.innerHTML = `
        <div class="matchup-tooltip-title">${label}</div>
        <div class="matchup-tooltip-row">Record: ${recordLabel}</div>
        <div class="matchup-tooltip-row">Games: ${total}</div>
        <div class="matchup-tooltip-row">${avgScoreLabel}</div>
        <div class="matchup-tooltip-subtitle">Last games</div>
        ${recentMarkup || "<div class=\"matchup-tooltip-row\">No recent games</div>"}
      `;
      slot.appendChild(logoWrapper);
      slot.appendChild(tooltip);

      slot.addEventListener("mouseenter", (event) => {
        tooltip.style.opacity = "1";
        clampTooltip(tooltip, event.clientX, event.clientY);
      });
      slot.addEventListener("mousemove", (event) => {
        clampTooltip(tooltip, event.clientX, event.clientY);
      });
      slot.addEventListener("mouseleave", () => {
        tooltip.style.opacity = "0";
        tooltip.style.transform = "translate(-9999px, -9999px)";
      });
    });
  };

  fillSlots(winSlots, topWins, "win");
  fillSlots(loseSlots, topLosses, "lose");
}

async function loadEvolutionData() {
  if (!evolutionDataPromise) {
    evolutionDataPromise = (async () => {
      let lastError = null;
      for (const url of EVOLUTION_DATA_URLS) {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            lastError = new Error(`Failed to load ${url}: ${response.status}`);
            continue;
          }
          const text = await response.text();
          const lines = text.trim().split("\n");
          const headers = lines[0].split(",").map((header) => header.trim());
          const rows = [];

          for (let i = 1; i < lines.length; i++) {
            const values = parseCsvLine(lines[i]);
            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index]?.trim() ?? "";
            });
            rows.push(row);
          }

          return rows;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error("Failed to load evolution data");
    })();
  }
  return evolutionDataPromise;
}

async function loadTeamSeasonData() {
  if (!teamSeasonDataPromise) {
    teamSeasonDataPromise = (async () => {
      let lastError = null;
      for (const url of TEAM_SEASON_URLS) {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            lastError = new Error(`Failed to load ${url}: ${response.status}`);
            continue;
          }
          const text = await response.text();
          const lines = text.trim().split("\n");
          const headers = lines[0].split(",").map((header) => header.trim());
          const rows = [];

          for (let i = 1; i < lines.length; i++) {
            const values = parseCsvLine(lines[i]);
            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index]?.trim() ?? "";
            });
            rows.push(row);
          }

          return rows;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error("Failed to load team season data");
    })();
  }
  return teamSeasonDataPromise;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function getEvolutionDefaults() {
  const primary = TEAM_ATTRIBUTES[1] || TEAM_ATTRIBUTES[0];
  const secondary = TEAM_ATTRIBUTES[3] || TEAM_ATTRIBUTES[2] || TEAM_ATTRIBUTES[0];
  return [primary[0], secondary[0]];
}

function buildEvolutionOptions(select, selectedLabel) {
  select.innerHTML = "";
  TEAM_ATTRIBUTES.forEach(([label]) => {
    if (label === "Wins" || label === "Salaries (M)") return;
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    if (label === selectedLabel) {
      option.selected = true;
    }
    select.appendChild(option);
  });
}

function selectEvolutionValue(row, attribute) {
  if (!attribute) return null;
  return attribute[1](row);
}

async function updateEvolutionChart(container, currentYear, teamId, built) {
  const chart = container.querySelector("#team-evolution-chart");
  const selectA = container.querySelector(".evolution-select-a");
  const selectB = container.querySelector(".evolution-select-b");

  if (!chart || !selectA || !selectB) return;

  if (!built.evolution) {
    const [defaultA, defaultB] = getEvolutionDefaults();
    built.evolution = {
      selectedA: defaultA,
      selectedB: defaultB,
      resizeObserver: null,
      observeTarget: null,
      resizeScheduled: false,
      tooltipEl: null,
    };

    buildEvolutionOptions(selectA, built.evolution.selectedA);
    buildEvolutionOptions(selectB, built.evolution.selectedB);

    selectA.addEventListener("change", () => {
      built.evolution.selectedA = selectA.value;
      updateEvolutionChart(container, currentYear, teamId, built);
    });

    selectB.addEventListener("change", () => {
      built.evolution.selectedB = selectB.value;
      updateEvolutionChart(container, currentYear, teamId, built);
    });
  } else {
    buildEvolutionOptions(selectA, built.evolution.selectedA);
    buildEvolutionOptions(selectB, built.evolution.selectedB);
  }

  if (!built.evolution.resizeObserver) {
    built.evolution.resizeObserver = new ResizeObserver(() => {
      if (built.evolution.resizeScheduled) return;
      built.evolution.resizeScheduled = true;
      requestAnimationFrame(() => {
        built.evolution.resizeScheduled = false;
        updateEvolutionChart(container, currentYear, teamId, built);
      });
    });
  }

  const attributeA = getAttributeByLabel(built.evolution.selectedA);
  const attributeB = getAttributeByLabel(built.evolution.selectedB);
  const colorA = built.evolutionTheme?.colorA || EVOLUTION_COLOR_A;
  const colorB = built.evolutionTheme?.colorB || EVOLUTION_COLOR_B;

  let rows = [];
  try {
    rows = await loadEvolutionData();
  } catch (error) {
    const svg = d3.select(chart);
    svg.selectAll("*").remove();
    const width = parseFloat(chart.getAttribute("width")) || 560;
    const height = parseFloat(chart.getAttribute("height")) || 220;
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#666")
      .attr("font-size", 12)
      .text("Season evolution data unavailable");
    return;
  }

  const teamRows = rows.filter((row) => {
    return row.season === String(currentYear)
      && row.teamId === String(teamId)
      && row.gameType === "Regular Season";
  });

  teamRows.sort((a, b) => {
    const dateA = new Date(a.gameDateTimeEst || 0).getTime();
    const dateB = new Date(b.gameDateTimeEst || 0).getTime();
    return dateA - dateB;
  });

  const values = teamRows.map((row, index) => {
    return {
      index,
      date: row.gameDateTimeEst,
      valueA: coerceNumber(selectEvolutionValue(row, attributeA)),
      valueB: coerceNumber(selectEvolutionValue(row, attributeB)),
      row,
    };
  }).filter((row) => row.valueA != null && row.valueB != null);

  const evolutionContainer = chart.closest(".evolution") || chart.parentElement;
  if (evolutionContainer && built.evolution.observeTarget !== evolutionContainer) {
    if (built.evolution.observeTarget) {
      built.evolution.resizeObserver.unobserve(built.evolution.observeTarget);
    }
    built.evolution.resizeObserver.observe(evolutionContainer);
    built.evolution.observeTarget = evolutionContainer;
  }

  const { width, height } = chart.getBoundingClientRect();
  if (width < 10 || height < 10) {
    return;
  }
  const margin = { top: 18, right: 70, bottom: 40, left: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const svg = d3.select(chart);
  svg.attr("width", width).attr("height", height);
  svg.selectAll("*").remove();

  const root = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  if (values.length === 0) {
    root.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#666")
      .attr("font-size", 12)
      .text("No game data for this season");
    return;
  }

  const xScale = d3.scaleLinear()
    .domain([0, values.length - 1])
    .range([0, innerWidth]);

  const yScaleA = d3.scaleLinear()
    .domain(d3.extent(values, (d) => d.valueA))
    .nice()
    .range([innerHeight, 0]);

  const yScaleB = d3.scaleLinear()
    .domain(d3.extent(values, (d) => d.valueB))
    .nice()
    .range([innerHeight, 0]);

  root.append("g")
    .attr("class", "evolution-grid")
    .call(d3.axisLeft(yScaleA).ticks(4).tickSize(-innerWidth).tickFormat(""));

  root.append("g")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat((d) => `G${d + 1}`))
    .call((g) => g.select(".domain").remove());

  root.append("g")
    .call(d3.axisLeft(yScaleA).ticks(4))
    .call((g) => g.selectAll("text").attr("fill", colorA))
    .call((g) => g.selectAll("path, line").attr("stroke", colorA));

  root.append("g")
    .attr("transform", `translate(${innerWidth}, 0)`)
    .call(d3.axisRight(yScaleB).ticks(4))
    .call((g) => g.selectAll("text").attr("fill", colorB))
    .call((g) => g.selectAll("path, line").attr("stroke", colorB));

  const lineA = d3.line()
    .x((d) => xScale(d.index))
    .y((d) => yScaleA(d.valueA));

  const lineB = d3.line()
    .x((d) => xScale(d.index))
    .y((d) => yScaleB(d.valueB));

  root.append("path")
    .datum(values)
    .attr("fill", "none")
    .attr("stroke", colorA)
    .attr("stroke-width", 2)
    .attr("d", lineA);

  root.append("path")
    .datum(values)
    .attr("fill", "none")
    .attr("stroke", colorB)
    .attr("stroke-width", 2)
    .attr("d", lineB);

  root.append("g")
    .attr("class", "evolution-win-dots")
    .selectAll("circle")
    .data(values)
    .enter()
    .append("circle")
    .attr("cx", (d) => xScale(d.index))
    .attr("cy", innerHeight)
    .attr("r", 3)
    .attr("fill", (d) => Number(d.row.win) === 1 ? "#2e7d32" : "#c62828")
    .attr("opacity", 0.85);

  root.append("text")
    .attr("x", 0)
    .attr("y", -6)
    .attr("fill", colorA)
    .attr("font-size", 12)
    .text(built.evolution.selectedA);

  root.append("text")
    .attr("x", innerWidth)
    .attr("y", -6)
    .attr("text-anchor", "end")
    .attr("fill", colorB)
    .attr("font-size", 12)
    .text(built.evolution.selectedB);

  const focusGroup = root.append("g")
    .attr("class", "evolution-focus")
    .style("display", "none");

  focusGroup.append("line")
    .attr("class", "evolution-focus-line")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .attr("stroke", "#9aa0a6")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "3 3");

  const focusCircleA = focusGroup.append("circle")
    .attr("r", 4)
    .attr("fill", "#fff")
    .attr("stroke", colorA)
    .attr("stroke-width", 2);

  const focusCircleB = focusGroup.append("circle")
    .attr("r", 4)
    .attr("fill", "#fff")
    .attr("stroke", colorB)
    .attr("stroke-width", 2);

  if (!built.evolution.tooltipEl) {
    const tooltip = document.createElement("div");
    tooltip.className = "evolution-tooltip";
    tooltip.style.opacity = "0";
    const evolutionContainer = chart.closest(".evolution") || chart.parentElement;
    if (evolutionContainer) {
      evolutionContainer.appendChild(tooltip);
    }
    built.evolution.tooltipEl = tooltip;
  }

  const tooltip = built.evolution.tooltipEl;
  if (tooltip) {
    tooltip.style.setProperty("--color-a", colorA);
    tooltip.style.setProperty("--color-b", colorB);
  }

  const overlay = root.append("rect")
    .attr("class", "evolution-overlay")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .style("cursor", "crosshair");

  const bisect = d3.bisector((d) => d.index).left;

  function showTooltip(d) {
    if (!tooltip) return;
    const row = d.row || {};
    const opponent = [row.opponentTeamCity, row.opponentTeamName].filter(Boolean).join(" ");
    const teamScore = coerceNumber(row.teamScore);
    const opponentScore = coerceNumber(row.opponentScore);
    const scoreLine = Number.isFinite(teamScore) && Number.isFinite(opponentScore)
      ? `${teamScore} - ${opponentScore}`
      : "N/A";
    const homeLabel = row.home === "1" || row.home === 1 ? "Home" : "Away";

    const statsRows = [
      { label: "Assists", value: formatNumber(coerceNumber(row.assists), 1) },
      { label: "Rebounds", value: formatNumber(coerceNumber(row.rebounds), 1) },
      { label: "Blocks", value: formatNumber(coerceNumber(row.blocks), 1) },
      { label: "Steals", value: formatNumber(coerceNumber(row.steals), 1) },
      { label: "Turnovers", value: formatNumber(coerceNumber(row.turnovers), 1) },
      { label: "Fouls", value: formatNumber(coerceNumber(row.foulsPersonal), 1) },
      {
        label: "FG",
        value: `${formatNumber(coerceNumber(row.fieldGoalsMade), 0)} / ${formatNumber(coerceNumber(row.fieldGoalsAttempted), 0)} (${formatPercent(coerceNumber(row.fieldGoalsPercentage))})`,
      },
      {
        label: "3PT",
        value: `${formatNumber(coerceNumber(row.threePointersMade), 0)} / ${formatNumber(coerceNumber(row.threePointersAttempted), 0)} (${formatPercent(coerceNumber(row.threePointersPercentage))})`,
      },
      {
        label: "FT",
        value: `${formatNumber(coerceNumber(row.freeThrowsMade), 0)} / ${formatNumber(coerceNumber(row.freeThrowsAttempted), 0)} (${formatPercent(coerceNumber(row.freeThrowsPercentage))})`,
      },
    ];

    tooltip.innerHTML = `
      <div class="evolution-tooltip-header">
        <div class="evolution-tooltip-title">G${d.index + 1} ${formatDate(d.date)}</div>
        <div class="evolution-tooltip-sub">${homeLabel}${opponent ? ` vs ${opponent}` : ""}</div>
        <div class="evolution-tooltip-score">${scoreLine}</div>
      </div>
      <div class="evolution-tooltip-metrics">
        <div class="metric">
          <span class="label">${built.evolution.selectedA}</span>
          <span class="value" style="color: ${colorA}">${formatNumber(d.valueA, 2)}</span>
        </div>
        <div class="metric">
          <span class="label">${built.evolution.selectedB}</span>
          <span class="value" style="color: ${colorB}">${formatNumber(d.valueB, 2)}</span>
        </div>
      </div>
      <div class="evolution-tooltip-grid">
        ${statsRows.map((row) => `
          <div class="row">
            <span class="label">${row.label}</span>
            <span class="value">${row.value}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function positionTooltip(x, y) {
    if (!tooltip) return;
    const evolutionContainer = chart.closest(".evolution") || chart.parentElement;
    if (!evolutionContainer) return;
    const containerRect = evolutionContainer.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let left = margin.left + x + EVOLUTION_TOOLTIP_PADDING;
    let top = margin.top + y - tooltipRect.height - EVOLUTION_TOOLTIP_PADDING;

    if (left + tooltipRect.width > containerRect.width) {
      left = margin.left + x - tooltipRect.width - EVOLUTION_TOOLTIP_PADDING;
    }
    if (top < 0) {
      top = margin.top + y + EVOLUTION_TOOLTIP_PADDING;
    }

    left = Math.max(0, Math.min(left, containerRect.width - tooltipRect.width - EVOLUTION_TOOLTIP_PADDING));
    top = Math.max(0, Math.min(top, containerRect.height - tooltipRect.height - EVOLUTION_TOOLTIP_PADDING));

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function handleMove(event) {
    if (values.length === 0) return;
    const [mx] = d3.pointer(event, this);
    const xValue = xScale.invert(mx);
    const index = Math.max(0, Math.min(values.length - 1, Math.round(xValue)));
    const d = values[index];
    const x = xScale(d.index);

    focusGroup.style("display", null);
    focusGroup.select(".evolution-focus-line")
      .attr("x1", x)
      .attr("x2", x);
    focusCircleA.attr("cx", x).attr("cy", yScaleA(d.valueA));
    focusCircleB.attr("cx", x).attr("cy", yScaleB(d.valueB));

    if (tooltip) {
      tooltip.style.opacity = "1";
      showTooltip(d);
      positionTooltip(x, (yScaleA(d.valueA) + yScaleB(d.valueB)) / 2);
    }
  }

  function handleLeave() {
    focusGroup.style("display", "none");
    if (tooltip) {
      tooltip.style.opacity = "0";
    }
  }

  overlay.on("mousemove", handleMove).on("mouseenter", handleMove).on("mouseleave", handleLeave);
}

export function makeRadarBuild(radarId, options = {}) {
  return (bubbleMapAttributes, allAttributes, statsUpdate) => {
    const size = options.size || 200;
    const marginSize = options.margin || 80;
    const width = size;
    const height = size;
    const margin = { top: marginSize, right: marginSize, bottom: marginSize, left: marginSize };

    const color = options.color || ["#CC333F"];
    const scaleRatio = Math.min(width, height) / 200;

    const radarInitialAttributes = Utils.pickItemsWithout(allAttributes, bubbleMapAttributes, RADAR_AXES - bubbleMapAttributes.length);

    const radarChartOptions = {
      w: width, h: height, margin: margin,
      maxValue: 1, levels: 4, roundStrokes: true, color: color,
      axisLabelFontSize: Math.round((options.axisLabelFontSize || 9) * scaleRatio),
      labelFontSize: Math.round((options.labelFontSize || 12) * scaleRatio),
      tooltipFontSize: Math.round((options.tooltipFontSize || 11) * scaleRatio),
      dotRadius: (options.dotRadius || 3) * scaleRatio,
      strokeWidth: (options.strokeWidth || 2) * scaleRatio,
      allAttributes: allAttributes,
      bubbleMapAttributes: bubbleMapAttributes,
      radarAttributes: radarInitialAttributes,
      axisContent: function(options, index) {
        const { allAttributes, bubbleMapAttributes, radarAttributes } = options;

        const fullRadar = Utils.makeList(bubbleMapAttributes, radarAttributes);
        const radarAvailable = Utils.listWithout(allAttributes, bubbleMapAttributes);

        const labelContainer = document.createElement("div");

        if (index === 0 || index === 1 || index == RADAR_AXES - 1) {
          labelContainer.classList.add("radar-naked-label");
          labelContainer.innerText = fullRadar[index][0];
        } else {
          labelContainer.classList.add("radar-labels");

          const label = document.createElement("div");
          label.classList.add("radar-label");
          label.innerText = fullRadar[index][0];
          labelContainer.appendChild(label)

          const selector = document.createElement("div");
          selector.classList.add("radar-selector");
          radarAvailable.forEach(attribute => {
            const span = document.createElement("span");
            span.innerText = attribute[0];
            selector.appendChild(span);

            if (attribute === fullRadar[index]) {
              span.classList.add("selected");
            }

            span.addEventListener("click", (_) => {
              const previous = fullRadar[index];
              const next = radarAttributes.map((a) => a == previous ? attribute : a);
              options.radarAttributes = radarAttributes.map((a) => a == previous ? attribute : a == attribute ? Utils.pickItemsWithout(radarAvailable, next.concat([previous]), 1)[0] : a);
              statsUpdate();
            });
          });

          selector.style.display = "none";
          labelContainer.addEventListener("click", (e) => {
            e.stopPropagation();
            if (selector.style.display === "none") {
              document.querySelectorAll(".radar-selector").forEach(e => e.style.display = "none");
              selector.style.display = "flex";
            } else {
              selector.style.display = "none";
            }
          });

          labelContainer.appendChild(selector);
        }

        return labelContainer;
      }
    };

    const radarFullAttributes = Utils.makeList(bubbleMapAttributes, radarInitialAttributes);
    const start = [
      radarFullAttributes.map((_, i) => { return { axis: i, value: 0 }; })
    ];

    const radar = RadarChart(radarId, start, radarChartOptions);

    return {
      radar: radar,
      allAttributes: allAttributes,
      bubbleMapAttributes: bubbleMapAttributes,
      radarAttributes: radarInitialAttributes,
    };
  }
}

export function updateTeamStats(container, built, seasonsLoader, metadataLoader, currentYear, teamId) {
  // example use of the system
  const name = container.querySelector(".name");
  const year = container.querySelector(".year");
  const content = container.querySelector(".content");
  const logo = container.querySelector(".stats-logo");

  const teamAbbrev = getMetaValue(metadataLoader, teamId, (row) => row["teamAbbrev"], currentYear);
  const teamSlug = getMetaValue(metadataLoader, teamId, (row) => row["teamSlug"], currentYear);
  const teamCity = seasonsLoader.getData(currentYear, (row) => row["teamCity"]).get(teamId);
  const teamName = seasonsLoader.getData(currentYear, (row) => row["teamName"]).get(teamId);
  const displayName = [teamCity, teamName].filter(Boolean).join(" ");

  // name.innerText = displayName || teamAbbrev || teamId;
  // year.innerText = currentYear;

  if (logo) {
    if (teamSlug) {
      const activeTill = getMetaValue(metadataLoader, teamId, (row) => row["seasonActiveTill"], currentYear);
      const activeTillYear = parseInt(activeTill, 10);
      const logoYear = Number.isNaN(activeTillYear) ? currentYear : activeTillYear;
      const logoYearSegment = logoYear > 2024 ? "current" : logoYear;
      logo.src = `https://i.logocdn.com/nba/${logoYearSegment}/${teamSlug}.svg`;
      logo.alt = displayName || teamAbbrev || teamId;
      logo.hidden = false;
    } else {
      logo.hidden = true;
      logo.removeAttribute("src");
    }
  }

  const rankRegularEl = container.querySelector(".summary-rank-regular");
  const rankPlayoffsEl = container.querySelector(".summary-rank-playoffs");
  const cityEl = container.querySelector(".summary-city");
  const teamEl = container.querySelector(".summary-team");

  if (cityEl) cityEl.textContent = teamCity || "--";
  if (teamEl) teamEl.textContent = teamName || "--";

  const summaryTargetId = String(teamId);
  const summaryTargetYear = String(currentYear);
  loadTeamSeasonData().then((rows) => {
    if (summaryTargetId !== String(teamId) || summaryTargetYear !== String(currentYear)) return;
    const regularRanks = getRankMap(rows, currentYear, "Regular Season");
    const playoffRanks = getRankMap(rows, currentYear, "Playoffs");
    const regularSummary = regularRanks.get(summaryTargetId);
    const playoffSummary = playoffRanks.get(summaryTargetId);

    if (rankRegularEl) {
      rankRegularEl.textContent = regularSummary
        ? `#${regularSummary.rank} (${regularSummary.wins}-${regularSummary.losses})`
        : "--";
    }
    if (rankPlayoffsEl) {
      rankPlayoffsEl.textContent = playoffSummary
        ? `#${playoffSummary.rank} (${playoffSummary.wins}-${playoffSummary.losses})`
        : "--";
    }
  }).catch(() => {
    if (rankRegularEl) rankRegularEl.textContent = "--";
    if (rankPlayoffsEl) rankPlayoffsEl.textContent = "--";
  });

  const legendTeam = container.querySelector(".radar-legend .legend-item.team");
  const legendAverage = container.querySelector(".radar-legend .legend-item.average");

  const rawColorA = getMetaValue(metadataLoader, teamId, (row) => row["Color1"], currentYear);
  const rawColorB = getMetaValue(metadataLoader, teamId, (row) => row["Color2"], currentYear);
  const color3 = getMetaValue(metadataLoader, teamId, (row) => row["Color3"], currentYear);
  const colorA = resolveColor(rawColorA, resolveColor(color3, "#CC333F"));
  const colorB = resolveColor(rawColorB, resolveColor(color3, "rgba(80, 80, 80, 0.7)"));
  if (legendTeam) {
    legendTeam.style.color = colorA;
  }
  if (legendAverage) {
    legendAverage.style.color = colorB;
  }
  built.evolutionTheme = { colorA, colorB };

  const attributes = TEAM_ATTRIBUTES;
  const attributesParse = attributes.map((a) => a[1]);
  const attributesDisplay = attributes.map((a) => a[0]);
  const seasonData = Data.filter_error_values(seasonsLoader.getData(currentYear, ...attributesParse));

  const teamData = seasonData.get(teamId) || [];
  content.innerText = "";

  // radar chart
  let radarFullAttributes = Utils.makeList(built.bubbleMapAttributes, built.radarAttributes);
  let data = Data.filter_error_values(seasonsLoader.getData(currentYear, ...radarFullAttributes.map((a) => a[1])));
  data = Data.applyData(data, radarFullAttributes.map((_) => Data.min_max_norm_shaper), null);
  const teamRadarData = data.get(teamId) || [];
  const allTeamData = Array.from(data.values());
  const averageRadarData = averageArrays(allTeamData);

  const dataPoints = [
    radarFullAttributes.map((_, i) => ({ axis: i, value: teamRadarData[i] })),
    radarFullAttributes.map((_, i) => ({ axis: i, value: averageRadarData[i] })),
  ];

  built.colors = [colorA, colorB];
  built.radar.update(dataPoints, TRANSITION_TIME, built);

  updateEvolutionChart(container, currentYear, teamId, built);
  updateMatchups(container, currentYear, teamId, metadataLoader);
}

export function updatePlayerStats(container, built, seasonsLoader, metadataLoader, currentYear, playerId) {
  // example use of the system
  const name = container.querySelector(".name");
  const year = container.querySelector(".year");
  const content = container.querySelector(".content");

  name.innerText = getMetaValue(metadataLoader, playerId, (row) => row["firstName"] + " " + row["lastName"], currentYear);
  year.innerText = currentYear;

  const attributes = PLAYER_ATTRIBUTES;
  const attributesParse = attributes.map((a) => a[1]);
  const attributesDisplay = attributes.map((a) => a[0]);
  const seasonData = Data.filter_error_values(seasonsLoader.getData(currentYear, ...attributesParse));

  const playerData = seasonData.get(playerId) || [];
  content.innerText = attributesDisplay
    .map((display, index) => `${display}: ${formatValue(playerData[index])}`)
    .join("\n");

  // radar chart
  let radarFullAttributes = Utils.makeList(built.bubbleMapAttributes, built.radarAttributes);
  let data = Data.filter_error_values(seasonsLoader.getData(currentYear, ...radarFullAttributes.map((a) => a[1])));
  data = Data.applyData(data, radarFullAttributes.map((_) => Data.min_max_norm_shaper), null);
  let playerRadarData = data.get(playerId)
  let dataPoints = [radarFullAttributes.map((_, i) => {
    return { axis: i, value: playerRadarData[i] };
  })];
  built.radar.update(dataPoints, TRANSITION_TIME, built)
}
