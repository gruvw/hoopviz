import { BubbleMap } from "./BubbleMap.js";
import { Screens } from "./Screens.js";
import { SeasonsLoader } from "./SeasonsLoader.js";
import { MetadataLoader } from "./MetadataLoader.js";
import * as Stats from "./stats.js";

new Screens({
  containerSelector: "#screens",
  screenSelector: "#screen-select",
  minYear: 1990,
  maxYear: 2025,
  // teams BubbleMap
  leftBubbleMap: new BubbleMap({
    containerSelector: "#teams",
    seasonsLoader: new SeasonsLoader("./data/team_seasons.csv", (row) => row["teamId"]),
    metadataLoader: new MetadataLoader("./data/team_metadata.csv", (row) => row["teamId"]),
    bubbleContent: (row) => row["teamAbbrev"],
    bubbleLogo: (row) => row["teamSlug"],
    statsUpdate: Stats.updateTeamStats,
    attributes: Stats.TEAM_ATTRIBUTES,
    build: Stats.makeRadarBuild("#team-radar", { size: 210 }),
  }),
  // players BubbleMap
  rightBubbleMap: new BubbleMap({
    containerSelector: "#players",
    seasonsLoader: new SeasonsLoader("./data/player_seasons.csv", (row) => row["personId"]),
    metadataLoader: new MetadataLoader("./data/players_metadata.csv", (row) => row["personId"]),
    bubbleContent: (row) => row["firstName"] + " " + row["lastName"],
    bubbleColor: (row) => "#005ce6",
    bubbleLogoUrl: (row) => `https://cdn.nba.com/headshots/nba/latest/1040x760/${row["personId"]}.png`,
    statsUpdate: Stats.updatePlayerStats,
    attributes: Stats.PLAYER_ATTRIBUTES,
    build: Stats.makeRadarBuild("#player-radar", { size: 200 }),
  }),
})
