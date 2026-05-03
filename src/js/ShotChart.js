import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const toSvgX = locX => 218.6 + locX * 0.8684;
const toSvgY = locY => 89.8 + locY * 0.761;

export function drawShotChart(svgEl, shots) {
  const svg = d3.select(svgEl);
  svg.selectAll("*").remove();

  svg.attr("viewBox", "0 0 601 444")
     .attr("preserveAspectRatio", "xMidYMid meet");

  svg.append("image")
    .attr("href", "data/nba-court.svg")
    .attr("width", 601)
    .attr("height", 444);

  const filtered = shots.filter(d => +d.locY <= 470);
  const made = filtered.filter(d => +d.shotMade === 1);
  const missed = filtered.filter(d => +d.shotMade === 0);

  svg.selectAll("circle")
    .data(made)
    .join("circle")
    .attr("cx", d => toSvgX(+d.locX))
    .attr("cy", d => toSvgY(+d.locY))
    .attr("r", 4)
    .attr("fill", "none")
    .attr("stroke", "#31e77d")
    .attr("stroke-width", 1.5)
    .attr("opacity", 0.7);

  const cross = d3.symbol().type(d3.symbolCross).size(40);

  svg.selectAll("path")
    .data(missed)
    .join("path")
    .attr("d", cross)
    .attr("transform", d => `translate(${toSvgX(+d.locX)},${toSvgY(+d.locY)}) rotate(45)`)
    .attr("fill", "#ee5847")
    .attr("opacity", 0.7);
}

export async function loadShots(personId, season) {
  const parts = [
    "data/shot_events_part1.csv",
    "data/shot_events_part2.csv",
    "data/shot_events_part3.csv",
  ];
  const frames = await Promise.all(parts.map((p, i) =>
    d3.csv(p)
  ));
  const all = frames.flat();
  console.log(`${personId} ${season}`);
  const result = all.filter(d => +d.personId === +personId && +d.season === +season);
  console.log(`shots found: ${result.length}`);
  return result;
}
