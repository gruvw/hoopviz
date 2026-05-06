import { BubbleMap } from "./BubbleMap.js";
import { Screens } from "./Screens.js";
import { SeasonsLoader } from "./SeasonsLoader.js";
import { MetadataLoader } from "./MetadataLoader.js";
import { RadarChart } from "../radar_chart/radarChart.js";
import * as Stats from "./stats.js";

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
    buildStats: (statsContainer) => {
      var margin = { top: 100, right: 100, bottom: 100, left: 100 },
        width = 300,
        height = 300;

      var color = ["#CC333F"];

      var radarChartOptions = {
        w: width, h: height, margin: margin,
        maxValue: 1, levels: 5, roundStrokes: true, color: color,
        axisContent: function(axisName, index) {
          return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">' +
            // '<span style="font-size:20px;line-height:1;">' + axisIcons[index] + '</span>' +
            '<span style="font-size:10px;color:#555;white-space:nowrap;">' + axisName + '</span>' +
            '</div>';
        }
      };

      let start = [
          Stats.teamRadarAxes.map((a) => { return { axis: a[0], value: 0 }; })
      ];

      return RadarChart("#team-radar", start, radarChartOptions);
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
    buildStats: (statsContainer) => {
      console.log(statsContainer);
      // TODO
      return null;
    },
  }),
})
