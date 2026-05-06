import { BubbleMap } from "./BubbleMap.js";
import { Screens } from "./Screens.js";
import { SeasonsLoader } from "./SeasonsLoader.js";
import { MetadataLoader } from "./MetadataLoader.js";
import { RadarChart } from "../radar_chart/radarChart.js";
import * as Utils from "./utils.js";
import * as Stats from "./stats.js";

const RADAR_AXES = 6;

new Screens({
  containerSelector: "#screens",
  screenSelector: "#screen-select",
  minYear: 1985,
  maxYear: 2025,
  // teams BubbleMap
  leftBubbleMap: new BubbleMap({
    containerSelector: "#teams",
    seasonsLoader: new SeasonsLoader("./data/team_seasons.csv", (row) => row["teamId"]),
    metadataLoader: new MetadataLoader("./data/team_metadata.csv", (row) => row["teamId"]),
    bubbleContent: (row) => row["teamAbbrev"],
    bubbleColor: (row) => "url(https://i.logocdn.com/nba/2024/" + row["teamSlug"] + ".svg)",
    statsUpdate: Stats.updateTeamStats,
    attributes: Stats.TEAM_ATTRIBUTES,
    build: (bubbleMapAttributes, allAttributes, statsUpdate) => {
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
            labelContainer.addEventListener("click", (_) => {
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

      const radar = RadarChart("#team-radar", start, radarChartOptions);

      return {
        radar: radar,
        allAttributes: allAttributes,
        bubbleMapAttributes: bubbleMapAttributes,
        radarAttributes: radarInitialAttributes,
      };
    },
  }),
  // players BubbleMap
  rightBubbleMap: new BubbleMap({
    containerSelector: "#players",
    seasonsLoader: new SeasonsLoader("./data/player_seasons.csv", (row) => row["personId"]),
    metadataLoader: new MetadataLoader("./data/players_metadata.csv", (row) => row["personId"]),
    bubbleContent: (row) => row["firstName"] + " " + row["lastName"],
    bubbleColor: (row) => "#005ce6",
    statsUpdate: Stats.updatePlayerStats,
    attributes: Stats.PLAYER_ATTRIBUTES,
    build: (radarAttributes) => {
      // TODO
      return {
        radar: null,
      };
    },
  }),
})
