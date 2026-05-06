// The Radar Chart
// Originally written by Nadieh Bremer | Visual Cinnamon, alangrafu
// Modified by Lucas Jung (@gruvw)
// MIT license

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export function RadarChart(id, data, options) {
  var cfg = {
    w: 600,				// width
    h: 600,				// height
    margin: { top: 20, right: 20, bottom: 20, left: 20 }, // svg margins
    levels: 3,				// how many levels or inner circles should there be drawn
    maxValue: 0, 			// what is the value that the biggest circle will represent
    labelFactor: 1.25, 	// how much farther than the radius of the outer circle should the labels be placed
    wrapWidth: 60, 		// the number of pixels after which a label needs to be given a new line
    opacityArea: 0.35, 	// the opacity of the area of the blob
    dotRadius: 4, 			// the size of the colored circles of each blog
    opacityCircles: 0.1, 	// the opacity of the circles of each blob
    strokeWidth: 2, 		// the width of the stroke around each blob
    roundStrokes: false,	// if true the area and stroke will follow a round path (cardinal-closed)
    color: [],	// color array
    axisContent: null		// optional function to render custom HTML for each axis label
  };

  if ('undefined' !== typeof options) {
    for (var i in options) {
      if ('undefined' !== typeof options[i]) { cfg[i] = options[i]; }
    }
  }

  if (Array.isArray(cfg.color)) {
    var colorArray = cfg.color;
    cfg.color = function(i) {
      return colorArray[i % colorArray.length];
    };
  }

  var container = d3.select(id);

  container.select("svg").remove();

  var svg = container.append("svg")
    .attr("width", cfg.w + cfg.margin.left + cfg.margin.right)
    .attr("height", cfg.h + cfg.margin.top + cfg.margin.bottom)
    .attr("class", "radar" + id);

  var g = svg.append("g")
    .attr("transform", "translate(" + (cfg.w / 2 + cfg.margin.left) + "," + (cfg.h / 2 + cfg.margin.top) + ")");

  var gridLayer = g.append("g").attr("class", "gridLayer");
  var axisLayer = g.append("g").attr("class", "axisLayer");
  var areaLayer = g.append("g").attr("class", "areaLayer");
  var strokeLayer = g.append("g").attr("class", "strokeLayer");
  var circleLayer = g.append("g").attr("class", "circleLayer");
  var tooltipLayer = g.append("g").attr("class", "tooltipLayer");

  var tooltip = tooltipLayer.append("text")
    .attr("class", "tooltip")
    .style("opacity", 0);

  function getRadialLine(data, maxValue, radius, angleSlice, rScale) {
    var radarLine = d3.lineRadial()
      .radius(function(d) { return rScale(d.value); })
      .angle(function(d, i) { return i * angleSlice; })
      .curve(d3.curveLinearClosed);

    if (cfg.roundStrokes) {
      radarLine.curve(d3.curveCardinalClosed);
    }
    return radarLine;
  }

  function update(newData, duration) {
    duration = duration || 0;
    var newMaxValue = Math.max(cfg.maxValue, d3.max(newData, function(i) { return d3.max(i.map(function(o) { return o.value; })) }));
    var allAxis = newData[0].map(function(i, j) { return i.axis });
    var total = allAxis.length;
    var radius = Math.min(cfg.w / 2, cfg.h / 2);
    var Format = d3.format('.0%');
    var angleSlice = Math.PI * 2 / total;

    var rScale = d3.scaleLinear()
      .range([0, radius])
      .domain([0, newMaxValue]);

    var radarLine = getRadialLine(newData, newMaxValue, radius, angleSlice, rScale);

    var axisGrid = gridLayer.selectAll(".axisWrapper").data([null]);
    var axisGridEnter = axisGrid.enter().append("g").attr("class", "axisWrapper");
    var axisGridCombined = axisGrid.merge(axisGridEnter);

    var gridCircles = axisGridCombined.selectAll(".gridCircle")
      .data(d3.range(1, (cfg.levels + 1)).reverse());

    gridCircles.enter()
      .append("circle")
      .attr("class", "gridCircle")
      .attr("r", function(d, i) { return radius / cfg.levels * d; })
      .style("fill", "#CDCDCD")
      .style("stroke", "#CDCDCD")
      .style("fill-opacity", cfg.opacityCircles);

    gridCircles.transition("update").duration(duration)
      .attr("r", function(d, i) { return radius / cfg.levels * d; });

    var axisLabels = axisGridCombined.selectAll(".axisLabel")
      .data(d3.range(1, (cfg.levels + 1)).reverse());

    axisLabels.enter().append("text")
      .attr("class", "axisLabel")
      .attr("x", 4)
      .attr("y", function(d) { return -d * radius / cfg.levels; })
      .attr("dy", "0.4em")
      .style("font-size", "10px")
      .attr("fill", "#737373");

    axisLabels.transition("update").duration(duration)
      .attr("y", function(d) { return -d * radius / cfg.levels; })
      .text(function(d, i) { return Format(newMaxValue * d / cfg.levels); });

    var axis = axisLayer.selectAll(".axis").data(allAxis);

    axis.exit()
      .transition("update").duration(duration)
      .style("opacity", 0)
      .remove();

    var axisEnter = axis.enter().append("g")
      .attr("class", "axis")
      .style("opacity", 0);

    axisEnter.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", function(d, i) { return rScale(newMaxValue * 1.1) * Math.cos(angleSlice * i - Math.PI / 2); })
      .attr("y2", function(d, i) { return rScale(newMaxValue * 1.1) * Math.sin(angleSlice * i - Math.PI / 2); })
      .attr("class", "line")
      .style("stroke", "white")
      .style("stroke-width", "2px");

    axisEnter.append("foreignObject")
      .attr("class", "axisLabelHtml")
      .attr("width", 100)
      .attr("height", 40)
      .attr("x", function(d, i) {
        var xPos = rScale(newMaxValue * cfg.labelFactor) * Math.cos(angleSlice * i - Math.PI / 2);
        return xPos - 50;
      })
      .attr("y", function(d, i) {
        var yPos = rScale(newMaxValue * cfg.labelFactor) * Math.sin(angleSlice * i - Math.PI / 2);
        return yPos - 20;
      });

    var foBody = axisEnter.select("foreignObject")
      .append("xhtml:body")
      .style("margin", "0")
      .style("padding", "0")
      .style("background", "transparent")
      .style("text-align", "center");

    foBody.each(function(d, i) {
      var content = cfg.axisContent ? cfg.axisContent(d, i) : ("<span>" + d + "</span>");
      var container = d3.select(this);

      if (content instanceof Node) {
        container.html("");
        container.node().appendChild(content);
      } else {
        container.html(content);
      }
    });

    axis.merge(axisEnter).transition("update").duration(duration)
      .style("opacity", 1);

    var axisCombined = axis.merge(axisEnter);

    axisCombined.select("line")
      .transition("update").duration(duration)
      .attr("x2", function(d, i) { return rScale(newMaxValue * 1.1) * Math.cos(angleSlice * i - Math.PI / 2); })
      .attr("y2", function(d, i) { return rScale(newMaxValue * 1.1) * Math.sin(angleSlice * i - Math.PI / 2); });

    axisCombined.select("foreignObject")
      .transition("update").duration(duration)
      .attr("x", function(d, i) {
        var xPos = rScale(newMaxValue * cfg.labelFactor) * Math.cos(angleSlice * i - Math.PI / 2);
        return xPos - 50;
      })
      .attr("y", function(d, i) {
        var yPos = rScale(newMaxValue * cfg.labelFactor) * Math.sin(angleSlice * i - Math.PI / 2);
        return yPos - 20;
      });

    axisCombined.select("foreignObject body").each(function(d, i) {
      var content = cfg.axisContent ? cfg.axisContent(d, i) : ("<span>" + d + "</span>");
      var container = d3.select(this);

      if (content instanceof Node) {
        container.html("");
        container.node().appendChild(content);
      } else {
        container.html(content);
      }
    });

    var radarAreas = areaLayer.selectAll(".radarArea").data(newData);

    radarAreas.exit()
      .transition("update").duration(duration)
      .style("opacity", 0)
      .remove();

    var radarAreasEnter = radarAreas.enter().append("path")
      .attr("class", "radarArea")
      .style("opacity", 0)
      .style("fill", function(d, i) { return cfg.color(i); })
      .style("fill-opacity", cfg.opacityArea)
      .on('mouseover', function(event, d) {
        areaLayer.selectAll(".radarArea").transition("hover").duration(200).style("fill-opacity", 0.1);
        d3.select(this).transition("hover").duration(200).style("fill-opacity", 0.7);
      })
      .on('mouseout', function() {
        areaLayer.selectAll(".radarArea").transition("hover").duration(200).style("fill-opacity", cfg.opacityArea);
      });

    radarAreas.merge(radarAreasEnter)
      .transition("update").duration(duration)
      .style("opacity", 1)
      .attr("d", function(d, i) { return radarLine(d); });

    var radarStrokes = strokeLayer.selectAll(".radarStroke").data(newData);

    radarStrokes.exit()
      .transition("update").duration(duration)
      .style("opacity", 0)
      .remove();

    var radarStrokesEnter = radarStrokes.enter().append("path")
      .attr("class", "radarStroke")
      .style("opacity", 0)
      .style("stroke-width", cfg.strokeWidth + "px")
      .style("stroke", function(d, i) { return cfg.color(i); })
      .style("fill", "none");

    radarStrokes.merge(radarStrokesEnter)
      .transition("update").duration(duration)
      .style("opacity", 1)
      .attr("d", function(d, i) { return radarLine(d); });

    var radarCircleGroups = circleLayer.selectAll(".radarCircleGroup").data(newData);

    radarCircleGroups.exit()
      .transition("update").duration(duration)
      .style("opacity", 0)
      .remove();

    var radarCircleGroupsEnter = radarCircleGroups.enter().append("g")
      .attr("class", "radarCircleGroup")
      .style("opacity", 0);

    var radarCircleGroupsCombined = radarCircleGroups.merge(radarCircleGroupsEnter);

    radarCircleGroupsCombined.transition("update").duration(duration)
      .style("opacity", 1);

    var radarCircles = radarCircleGroupsCombined.selectAll(".radarCircle")
      .data(function(d, i) {
        return d.map(function(point) {
          return { ...point, parentIndex: i };
        });
      });

    radarCircles.exit().remove();

    var radarCirclesEnter = radarCircles.enter().append("circle")
      .attr("class", "radarCircle")
      .attr("r", cfg.dotRadius)
      .attr("cx", function(d, i) { return rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2); })
      .attr("cy", function(d, i) { return rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2); })
      .style("fill", function(d) { return cfg.color(d.parentIndex); })
      .style("fill-opacity", 0.8);

    radarCircles.merge(radarCirclesEnter)
      .transition("update").duration(duration)
      .attr("cx", function(d, i) { return rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2); })
      .attr("cy", function(d, i) { return rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2); });

    var blobCircleWrapper = tooltipLayer.selectAll(".radarCircleWrapper").data(newData);

    blobCircleWrapper.exit().remove();

    var blobCircleWrapperEnter = blobCircleWrapper.enter().append("g")
      .attr("class", "radarCircleWrapper");

    var blobCircleWrapperCombined = blobCircleWrapper.merge(blobCircleWrapperEnter);

    var invisibleCircles = blobCircleWrapperCombined.selectAll(".radarInvisibleCircle")
      .data(function(d, i) { return d; });

    invisibleCircles.exit().remove();

    var invisibleCirclesEnter = invisibleCircles.enter().append("circle")
      .attr("class", "radarInvisibleCircle")
      .attr("r", cfg.dotRadius * 1.5)
      .attr("cx", function(d, i) { return rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2); })
      .attr("cy", function(d, i) { return rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2); })
      .style("fill", "none")
      .style("pointer-events", "all")
      .on("mouseover", function(event, d) {
        var newX = parseFloat(d3.select(this).attr('cx')) - 10;
        var newY = parseFloat(d3.select(this).attr('cy')) - 10;
        tooltip.attr('x', newX).attr('y', newY).text(Format(d.value)).transition().duration(200).style('opacity', 1);
      })
      .on("mouseout", function() {
        tooltip.transition().duration(200).style("opacity", 0);
      });

    invisibleCircles.merge(invisibleCirclesEnter)
      .transition("update").duration(duration)
      .attr("cx", function(d, i) { return rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2); })
      .attr("cy", function(d, i) { return rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2); });
  }

  update(data);

  return {
    update: update
  };
}
