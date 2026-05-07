import { RadarChart } from "./radar_chart/radarChart.js";
import * as Utils from "./utils.js";
import * as Data from "./data.js";

// TODO set all attributes

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

export const TRANSITION_TIME = 500;
const RADAR_AXES = 6;

export function makeRadarBuild(radarId) {
  return (bubbleMapAttributes, allAttributes, statsUpdate) => {
    const margin = { top: 100, right: 100, bottom: 100, left: 100 },
      width = 300,
      height = 300;

    const color = ["#CC333F"];

    const radarInitialAttributes = Utils.pickItemsWithout(allAttributes, bubbleMapAttributes, RADAR_AXES - bubbleMapAttributes.length);

    const radarChartOptions = {
      w: width, h: height, margin: margin,
      maxValue: 1, levels: 4, roundStrokes: true, color: color,
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

  console.log(teamId + " " + currentYear);

  name.innerText = metadataLoader.getValue(teamId, (row) => row["teamAbbrev"]); // TODO we don't have the team name in metada
  year.innerText = currentYear;

  let attributes = [TEAM_ATTRIBUTES[0], TEAM_ATTRIBUTES[1]];
  let attributesParse = attributes.map((a) => a[1]);
  let attributesDisplay = attributes.map((a) => a[0]);
  let seasonData = Data.filter_error_values(seasonsLoader.getData(currentYear, ...attributesParse));

  let teamData = seasonData.get(teamId);
  content.innerText = attributesDisplay.map((display, index) => display + ": " + teamData[index]).join("\n");

  // radar chart
  let radarFullAttributes = Utils.makeList(built.bubbleMapAttributes, built.radarAttributes);
  let data = Data.filter_error_values(seasonsLoader.getData(currentYear, ...radarFullAttributes.map((a) => a[1])));
  data = Data.applyData(data, radarFullAttributes.map((_) => Data.min_max_norm_shaper), null);
  let teamRadarData = data.get(teamId)
  let dataPoints = [radarFullAttributes.map((_, i) => {
    return { axis: i, value: teamRadarData[i] };
  })];
  built.radar.update(dataPoints, TRANSITION_TIME, built)
}

export function updatePlayerStats(container, built, seasonsLoader, metadataLoader, currentYear, playerId) {
  // example use of the system
  const name = container.querySelector(".name");
  const year = container.querySelector(".year");
  const content = container.querySelector(".content");

  console.log(playerId + " " + currentYear);

  name.innerText = metadataLoader.getValue(playerId, (row) => row["firstName"] + " " + row["lastName"]);
  year.innerText = currentYear;

  let attributes = [PLAYER_ATTRIBUTES[0], PLAYER_ATTRIBUTES[1]];
  let attributesParse = attributes.map((a) => a[1]);
  let attributesDisplay = attributes.map((a) => a[0]);
  let seasonData = Data.filter_error_values(seasonsLoader.getData(currentYear, ...attributesParse));

  let playerData = seasonData.get(playerId);
  content.innerText = attributesDisplay.map((display, index) => display + ": " + playerData[index]).join("\n");

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
