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
    build: (bubbleMapAttributes) => {
      var margin = { top: 100, right: 100, bottom: 100, left: 100 },
        width = 300,
        height = 300;

      var color = ["#CC333F"];

      var radarChartOptions = {
        w: width, h: height, margin: margin,
        maxValue: 1, levels: 4, roundStrokes: true, color: color,
        axisContent: function(axisName, index) {
          var div = document.createElement("div");

          if (index === 0 || index === 1 || index == RADAR_AXES - 1) {
            div.classList.add("radar-naked-label");
            div.innerText = axisName;
          } else {
            div.classList.add("radar-label");
            div.innerText = axisName;
          }
            div.addEventListener("click", (_) => console.log("HEY"));

          return div;
        }
      };

      let radarInitialAttributes = Utils.listWith(bubbleMapAttributes, Stats.TEAM_ATTRIBUTES, RADAR_AXES);
      let radarFullAttributes = Utils.makeList(bubbleMapAttributes, radarInitialAttributes);
      let start = [
        radarFullAttributes.map((a) => { return { axis: a[0], value: 0 }; })
      ];

      let radar = RadarChart("#team-radar", start, radarChartOptions);

      return {
        radar: radar,
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
