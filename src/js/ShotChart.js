import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const toSvgX = locX => 218.6 + locX * 0.8684;
const toSvgY = locY => 89.8 + locY * 0.761;

let _shotRequestId = 0;

export function drawShotChart(svgEl, shots) {
  const svg = d3.select(svgEl);
  svg.selectAll("*").remove();

  svg.attr("viewBox", "0 0 601 444")
     .attr("preserveAspectRatio", "xMidYMid meet");

  svg.append("image")
    .attr("href", "data/nba-court.svg")
    .attr("width", 601)
    .attr("height", 444);

  if (shots.length === 0) {
    svg.append("text")
      .attr("x", 300).attr("y", 222)
      .attr("text-anchor", "middle")
      .attr("fill", "#ffffff").attr("font-size", 16)
      .text("No shot data available");
    return;
  }

  const filtered = shots.filter(d => isFinite(+d.locX) && isFinite(+d.locY) && +d.locY <= 470);
  const made = filtered.filter(d => +d.shotMade === 1);
  const missed = filtered.filter(d => +d.shotMade === 0);

  svg.selectAll("circle")
    .data(made)
    .join("circle")
    .attr("cx", d => toSvgX(+d.locX))
    .attr("cy", d => toSvgY(+d.locY))
    .attr("r", 7)
    .attr("fill", "none")
    .attr("stroke", "#46a47a")
    .attr("stroke-width", 1.5)
    .attr("opacity", 0.7);

  svg.selectAll(".cross")
    .data(missed)
    .join("text")
    .attr("class", "cross")
    .attr("x", d => toSvgX(+d.locX))
    .attr("y", d => toSvgY(+d.locY))
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "central")
    .attr("font-size", 20)
    .attr("font-weight", 300)
    .attr("fill", "#c7645c")
    .attr("opacity", 0.7)
    .text("✕");
}

function getShotFile(season) {
  const s = +season;
  if (s <= 2006) return "data/shot_events_1996_2006.csv";
  if (s <= 2015) return "data/shot_events_2007_2015.csv";
  return "data/shot_events_2016_2024.csv";
}

export async function loadShots(personId, season, gameType = "Regular Season") {
  const requestId = ++_shotRequestId;
  let rows;
  try {
    rows = await d3.csv(getShotFile(season));
  } catch (e) {
    throw new Error(`Failed to load shot data: ${e.message}`);
  }
  if (requestId !== _shotRequestId) return null;
  const isPlayoffs = gameType === "Playoffs" ? 1 : 0;
  return rows.filter(d => +d.personId === +personId && +d.season === +season && +d.playoffs === isPlayoffs);
}
