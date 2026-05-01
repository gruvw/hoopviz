import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export function drawShotChart(svgEl, shots) {
  const svg = d3.select(svgEl);
  svg.selectAll("*").remove();

  svg.attr("viewBox", "0 0 601 444")
     .attr("preserveAspectRatio", "xMidYMid meet");

  svg.append("image")
    .attr("href", "data/nba-court.svg")
    .attr("width", 601)
    .attr("height", 444);
}

export async function loadShots(personId, season) {
  const parts = [
    "data/shot_events_part1.csv",
    "data/shot_events_part2.csv",
    "data/shot_events_part3.csv",
  ];
  const frames = await Promise.all(parts.map(p => d3.csv(p)));
  return frames.flat().filter(d => +d.personId === +personId && +d.season === +season);
}
