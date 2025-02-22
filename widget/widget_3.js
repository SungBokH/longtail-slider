import * as d3 from "d3";

export default function BarChartMagnitude({
  data,
  domains = [],
  xBins = [],
  binSize = [],
  domainAuto = { min: true, max: true },
  type = 'line',

  width = 400,
  height = 200,
  marginTop = 20,
  marginRight = 20,
  marginBottom = 30,
  marginLeft = 40,

  brushOffset = 20,
  brushHeight = 8
}) {
  domains = domains.slice();
  xBins = xBins.slice();
  binSize = binSize.slice();

  const totalHeight = height + brushHeight + brushOffset + marginTop + marginBottom;

  // Prism geometry constants
  const scaleFactor = 0.666;
  const rectWidth = 40 * scaleFactor;         // horizontal dimension of the prism top
  const apexOffsetTop = 10 * scaleFactor;     // apex's extra height above the "top" line
  const yForPrismTop = apexOffsetTop;         // y at which prism transitions to apex

  // Possibly expand domain if auto
  const minVal = d3.min(data);
  const maxVal = d3.max(data);
  if (domainAuto.min && !domains.includes(minVal) && minVal < domains[0]) {
    domains.unshift(minVal);
  }
  if (domainAuto.max && !domains.includes(maxVal) && maxVal > domains[domains.length - 1]) {
    domains.push(maxVal);
  }

  let brushDomainLeft = null;
  let brushDomainRight = null;

  // Ensure xBins includes 0..1
  if (!xBins.includes(0)) xBins.unshift(0);
  if (!xBins.includes(1)) xBins.push(1);
  // Convert fractional xBins => pixel-based
  xBins = xBins.map(bin => bin * width);

  let filteredBins = [];

  // Main container
  const svg = d3.create("svg")
    .attr("width", width + marginLeft + marginRight)
    .attr("height", totalHeight);
  const node = svg.node();

  // Minimal style
  const style = document.createElement('style');
  style.innerHTML = /*css*/`
    .prism {
      fill: #B0C4DE;
      stroke: #B0C4DE;
      opacity: 0.5;
      transition: stroke 0.2s, stroke-width 0.2s;
    }
    .prism:hover {
      cursor: pointer;
      stroke: #000;
      stroke-width: 2;
    }

    .x-axis-line {
      stroke: black;
      stroke-width: 1;
    }
    .tick-line {
      stroke: #333;
      stroke-width: 1;
    }
    .tick-label {
      fill: #333;
      font: 10px sans-serif;
    }
    .bar {
      fill: steelblue;
    }
    .bar.highlighted {
      fill: darkorange;
    }
    .bar:hover {
      opacity: 1;
      stroke: #000;
    }
    .background .bar {
      fill: gray;
      opacity: .3;
    }
    .foreground .bar {
      fill: steelblue;
    }
    .line {
      fill: steelblue;
      stroke: steelblue;
      stroke-width: 1;
    }
    .line.foreground {
      fill: steelblue;
    }
    .line.background {
      stroke: gray;
      fill: gray;
      opacity: .3;
    }
    .line.tick {
      fill: none;
      stroke: gray;
    }
    .brush .selection {
      fill: orange;
      fill-opacity: 1;
    }
    .brush .handle {
      fill: #999;
      cursor: ew-resize;
    }
    .brush .overlay {
      fill: rgb(223, 223, 223);
    }

    /* Dashed custom grid lines */
    .custom-grid-line {
      stroke: red;
      stroke-width: 1;
      shape-rendering: crispEdges;
      pointer-events: none;
      stroke-dasharray: 4,2;  /* dashed style */
    }

    /* For multiple horizontal lines */
    .multi-hline {
      fill: none;
      stroke: red;
      stroke-dasharray: 4,2;
      stroke-width: 1;
    }

    /* For vertical lines */
    .vline-prism {
      fill: none;
      stroke: red;
      stroke-dasharray: 4,2;
      stroke-width: 1;
    }
  `;
  document.head.appendChild(style);

  const g = svg.append("g")
    .attr("transform", `translate(${marginLeft}, ${marginTop})`);

  // Domain/scale utilities
  function getDomainIndex(value) {
    for (let i = 0; i < domains.length - 1; ++i) {
      if (value >= domains[i] && value < domains[i + 1]) return i;
    }
    return domains.length - 2;
  }

  function getDomain(value) {
    const idx = getDomainIndex(value);
    return [domains[idx], domains[idx + 1]];
  }

  function getRange(value) {
    const idx = getDomainIndex(value);
    const offset = idx > 0 ? rectWidth : 0;
    return [xBins[idx] + offset, xBins[idx + 1]];
  }

  function chartXPos(value) {
    return d3.scaleLinear()
      .domain(getDomain(value))
      .range(getRange(value))(value);
  }

  // Reverse X => domain
  function getBinIndex(px) {
    for (let i = 1; i < xBins.length - 1; ++i) {
      if (px <= xBins[i] + rectWidth) return i;
    }
    return xBins.length - 1;
  }

  function invertChartXPos(px) {
    const idx = getBinIndex(px);
    const offset = idx > 1 ? rectWidth : 0;
    return d3.scaleLinear()
      .domain([xBins[idx - 1] + offset, xBins[idx]])
      .range([domains[idx - 1], domains[idx]])(px);
  }

  // Binning
  function makeBins(arr) {
    let allBins = [];
    function binRange(start, end, size) {
      for (let v = start; v < end; v += size) {
        allBins.push({ x0: v, x1: v + size, values: [] });
      }
    }
    for (let i = 0; i < domains.length - 1; ++i) {
      binRange(domains[i], domains[i + 1], binSize[i]);
    }
    arr = arr.toSorted((a, b) => a - b);
    for (let val of arr) {
      for (let b of allBins) {
        if (val >= b.x0 && val < b.x1) {
          b.values.push(val);
          break;
        }
      }
    }
    return allBins.filter(b => b.values.length > 0);
  }

  let bins = makeBins(data);

  // Y scales per segment
  let yScales = [];
  function computeYScales() {
    yScales = [];
    for (let i = 0; i < domains.length - 1; ++i) {
      const isLast = i === domains.length - 2;
      const segBin = bins.filter(b =>
        b.x0 >= domains[i] && b.x0 < domains[i + 1] + (isLast ? 1 : 0)
      );
      const maxBin = segBin.length > 0 ? d3.max(segBin, d => d.values.length) : 0;
      yScales.push(
        d3.scaleLinear()
          .domain([0, maxBin])
          .range([height, yForPrismTop])
      );
    }
  }
  computeYScales();

  // Groups
  let barGroup = g.append("g").classed('barGroup', true);
  let foregroundBarGroup = g.append("g").classed('foreground', true);

  let lineTicks = g.append("path").classed('line', true).classed('tick', true);
  let lineGroup = g.append("path").classed('line', true);
  let lineForegroundGroup = g.append("path").classed('foreground line', true);

  function getYScaleForBin(b) {
    return yScales[getDomainIndex(b.x0)];
  }

  // X axis line
  g.append("line")
    .attr("class", "x-axis-line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", height)
    .attr("y2", height);

  // Brush
  const brush = d3.brushX()
    .extent([[0, height + brushOffset], [width, height + brushOffset + brushHeight]])
    .on("brush end", brushedChart);

  const gBrush = g.append("g").attr("class", "brush").call(brush);

  function setBrushSelection() {
    if (brushDomainLeft == null || brushDomainRight == null) return;
    const left = chartXPos(brushDomainLeft);
    const right = chartXPos(brushDomainRight);
    gBrush.call(brush.move, [left, right]);
  }

  function filterTrigger(detail) {
    node.dispatchEvent(new CustomEvent('filter', { detail }));
  }

  function brushedChart(event) {
    const s = event.selection;
    if (!s) {
      brushDomainLeft = brushDomainRight = null;
      if (event.sourceEvent) {
        filterTrigger({});
      }
      return;
    }
    const [pxLeft, pxRight] = s;
    const domainLeft = invertChartXPos(pxLeft);
    const domainRight = invertChartXPos(pxRight);
    brushDomainLeft = domainLeft;
    brushDomainRight = domainRight;
    if (event.sourceEvent) {
      filterTrigger({ selection: [domainLeft, domainRight] });
    }
  }

  // Formatter
  function nFormatter(num, digits) {
    const lookup = [
      { value: 1, symbol: "" },
      { value: 1e3, symbol: "k" },
      { value: 1e6, symbol: "M" },
      { value: 1e9, symbol: "G" },
      { value: 1e12, symbol: "T" },
      { value: 1e15, symbol: "P" },
      { value: 1e18, symbol: "E" }
    ];
    const regexp = /\.0+$|(?<=\.[0-9]*[1-9])0+$/;
    const absNum = Math.abs(num);
    const item = lookup.findLast(item => absNum >= item.value);
    return item
      ? (num < 0 ? "-" : "") +
        (absNum / item.value).toFixed(digits).replace(regexp, "") +
        item.symbol
      : "0";
  }

  // Foreground bar update
  const updateForegroundBar = update => update
    .attr("x", d => Math.min(chartXPos(d.x0), chartXPos(d.x1)))
    .attr("y", d => getYScaleForBin(d)(d.values.length))
    .attr("width", d => Math.abs(chartXPos(d.x1) - chartXPos(d.x0)) - 1)
    .attr("height", d => height - getYScaleForBin(d)(d.values.length));

  // ----------------------------------
  // Multiple custom grid lines (X & Y)
  // ----------------------------------
  let customGridX = [];
  let customGridY = [];

  function drawCustomGridLines() {
    // Remove old lines
    g.selectAll(".custom-grid-line").remove();

    // 1) Vertical lines
    customGridX.forEach(xVal => {
      const xPos = chartXPos(xVal);
      g.append("line")
        .attr("class", "custom-grid-line")
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", 0)
        .attr("y2", height);
    });

    // 2) Horizontal lines
    customGridY.forEach(binCount => {
      for (let i = 0; i < yScales.length; i++) {
        const yPos = yScales[i](binCount);
        if (yPos < 0 || yPos > height) continue;

        const segmentLeft = xBins[i] + (i > 0 ? rectWidth : 0);
        const segmentRight = xBins[i + 1];

        if (yPos >= yForPrismTop) {
          g.append("line")
            .attr("class", "custom-grid-line")
            .attr("x1", segmentLeft)
            .attr("x2", segmentRight)
            .attr("y1", yPos)
            .attr("y2", yPos);
        } else {
          // angled apex region
          const t = yPos / yForPrismTop;
          const apexX = xBins[i] + rectWidth / 2;
          const xLeft = apexX + t * (xBins[i] - apexX);
          const xRight = apexX + t * ((xBins[i] + rectWidth) - apexX);
          g.append("line")
            .attr("class", "custom-grid-line")
            .attr("x1", xLeft)
            .attr("x2", xRight)
            .attr("y1", yPos)
            .attr("y2", yPos);
        }
      }
    });
  }

  // Update all visuals
  function updateCharts() {
    lineGroup.style('display', 'none');
    barGroup.selectAll(".bar").remove();

    // background bars
    if (type === 'bar') {
      barGroup.selectAll(".bar")
        .data(bins)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => Math.min(chartXPos(d.x0), chartXPos(d.x1)))
        .attr("y", d => getYScaleForBin(d)(d.values.length))
        .attr("width", d => Math.abs(chartXPos(d.x1) - chartXPos(d.x0)) - 1)
        .attr("height", d => height - getYScaleForBin(d)(d.values.length));

      // foreground bars (filtered)
      foregroundBarGroup.selectAll(".bar")
        .data(filteredBins, d => d.x0)
        .join(
          enter => enter
            .append("rect")
            .attr("class", "bar")
            .call(updateForegroundBar),
          updateForegroundBar,
          exit => exit.remove()
        );

    } else if (type === 'line') {
      function add_first_last(bins) {
        if (!bins.length) return bins;
        const first = bins[0];
        const last = bins[bins.length - 1];
        return [
          { x0: first.x0, x1: first.x0, values: [] },
          ...bins,
          { x0: last.x1, x1: last.x1, values: [] },
        ];
      }
      const lineGen = d3.line()
        .x(d => Math.min(chartXPos(d.x0), chartXPos(d.x1)))
        .y(d => getYScaleForBin(d)(d.values.length));

      function domainsToLineTicks() {
        const arr = [];
        for (const d of domains) {
          if (arr.length > 0) {
            arr.push({ x0: d - 1, x1: d - 1, values: Array(9999) });
          }
          arr.push({ x0: d, x1: d, values: Array(9999) });
        }
        return arr;
      }

      lineTicks
        .datum(domainsToLineTicks())
        .attr('d', lineGen)
        .attr('stroke-dasharray', 4)
        .attr('fill', 'none')
        .style('display', null);

      lineGroup
        .datum(add_first_last(bins))
        .attr('d', lineGen)
        .style('display', null);

      lineForegroundGroup
        .datum(add_first_last(filteredBins))
        .attr('d', lineGen);
    }

    // Remove old ticks
    g.selectAll(".y-tick,.x-tick,.seg-scale-axis").remove();

    // X ticks for domain boundaries
    const xTickSelection = g.selectAll(".x-tick")
      .data(domains)
      .enter()
      .append("g")
      .attr("class", "x-tick");
    xTickSelection.append("line").attr("class", "tick-line");
    xTickSelection.append("text").attr("class", "tick-label");
    xTickSelection.each(function(d) {
      const xPos = chartXPos(d);
      d3.select(this).select("line")
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", height)
        .attr("y2", height - 8);
      d3.select(this).select("text")
        .attr("x", xPos)
        .attr("y", height + 14)
        .attr("text-anchor", "middle")
        .text(nFormatter(d, 1));
    });

    // Segment axis for each domain segment
    function drawSegmentAxis(xPos, scale) {
      const axisGroup = g.append("g").attr("class", "seg-scale-axis");
      const ticks = scale.ticks(5);
      axisGroup.selectAll(".seg-y-tick").data(ticks).enter()
        .append("g")
        .attr("class", "seg-y-tick")
        .each(function(d) {
          const yPos = scale(d);
          d3.select(this).append("line")
            .attr("class", "tick-line")
            .attr("x1", xPos)
            .attr("x2", xPos - 8)
            .attr("y1", yPos)
            .attr("y2", yPos);
          d3.select(this).append("text")
            .attr("class", "tick-label")
            .attr("x", xPos - 10)
            .attr("y", yPos)
            .attr("text-anchor", "end")
            .text(nFormatter(d, 1));
        });

      axisGroup.append("line")
        .attr("class", "tick-line")
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", height)
        .attr("y2", yForPrismTop)
        .attr("stroke", "black");
    }

    for (let i = 0; i < yScales.length; i++) {
      const yScale = yScales[i];
      if (yScale.domain()[1] > 0) {
        drawSegmentAxis(xBins[i] + (i > 0 ? rectWidth : 0), yScale);
      }
    }

    setBrushSelection();

    // Finally draw new custom dashed grid lines (which now extend into the prism)
    drawCustomGridLines();
  }

  // Prism creation
  function createPrism(x, y, dragBehavior) {
    const group = g.append("g").call(dragBehavior);
    group.append("polygon")
      .attr("class", "prism")
      .attr("points",
        `${(x + rectWidth / 2)},${y - apexOffsetTop} ` +
        `${x},${y} ` +
        `${x},${height} ` +
        `${x + rectWidth},${height} ` +
        `${x + rectWidth},${y}`
      );
    return group;
  }

  // Build a prism at each domain boundary (except first & last)
  const prisms = [];
  for (let i = 1; i < xBins.length - 1; i++) {
    const drag = d3.drag()
      .on("start", function() { d3.select(this).raise(); })
      .on("drag", (event) => {
        let newX = event.x - rectWidth / 2;
        newX = Math.max(0, Math.min(xBins[i + 1] - rectWidth - 50, newX));
        xBins[i] = newX;
        updatePrisms();
      });
    prisms[i] = createPrism(xBins[i], yForPrismTop, drag);
  }

  function updatePrisms() {
    for (let i = 1; i < xBins.length - 1; i++) {
      const xBin = xBins[i];
      prisms[i].select(".prism").attr("points",
        `${(xBin + rectWidth / 2)},${yForPrismTop - apexOffsetTop} ` +
        `${xBin},${yForPrismTop} ` +
        `${xBin},${height} ` +
        `${xBin + rectWidth},${height} ` +
        `${xBin + rectWidth},${yForPrismTop}`
      );
    }
    updateCharts();
  }

  updateCharts();

  //---------------------------------------------------
  // External Crossfilter / API
  //---------------------------------------------------
  node.crossfilter = (filteredData) => {
    if (!filteredData) {
      barGroup.classed('background', false);
      lineGroup.classed('background', false);
      filteredBins = [];
    } else {
      barGroup.classed('background', true);
      lineGroup.classed('background', true);
      filteredBins = makeBins(filteredData);
    }
    updateCharts();
  };

  node.type = (_type) => {
    if (!_type) return type;
    type = _type;
    updateCharts();
    return node;
  };

  node.binSize = (_binSize) => {
    if (!_binSize) return binSize;
    binSize = _binSize;
    bins = makeBins(data);
    computeYScales();
    updateCharts();
    return node;
  };

  // Existing "customGridLine"
  node.customGridLine = (xVals, yVals) => {
    if (xVals === undefined || xVals === null) {
      customGridX = [];
    } else if (!Array.isArray(xVals)) {
      customGridX = [xVals];
    } else {
      customGridX = xVals;
    }

    if (yVals === undefined || yVals === null) {
      customGridY = [];
    } else if (!Array.isArray(yVals)) {
      customGridY = [yVals];
    } else {
      customGridY = yVals;
    }

    updateCharts();
    return node;
  };

  // Existing single "drawHorizontalLine"
  node.drawHorizontalLine = function (binCountValue) {
    g.selectAll(".connected-binCount-line").remove();
    if (binCountValue == null) {
      return node;
    }

    const points = [];
    let yPrev = yScales[0](binCountValue);
    points.push([xBins[0], yPrev]);
    points.push([xBins[1], yPrev]);

    const N = yScales.length;
    for (let i = 1; i < N; i++) {
      const yThis = yScales[i](binCountValue);
      points.push([xBins[i], yPrev]);              // prism diagonal start
      points.push([xBins[i] + rectWidth, yThis]);  // prism diagonal end
      points.push([xBins[i] + rectWidth, yThis]);  // sub-chart horizontal start
      points.push([xBins[i + 1], yThis]);          // sub-chart horizontal end
      yPrev = yThis;
    }

    const lineGen = d3.line().x(d => d[0]).y(d => d[1]);
    const pathData = lineGen(points);

    g.append("path")
      .attr("class", "connected-binCount-line")
      .attr("d", pathData)
      .attr("fill", "none")
      .attr("stroke", "red")
      .attr("stroke-dasharray", "4,2")
      .attr("stroke-width", 1);

    return node;
  };

  // ------------------------------------------------------------
  // (1) Multiple horizontal lines
  // ------------------------------------------------------------
  node.drawMultipleHorizontalLines = function (binCounts) {
    // Remove old multi-hline paths
    g.selectAll(".multi-hline").remove();

    // If null or empty => do nothing
    if (!binCounts || !binCounts.length) {
      return node;
    }

    // For each binCount, draw a separate path
    binCounts.forEach(binCountValue => {
      const points = [];
      let yPrev = yScales[0](binCountValue);
      points.push([xBins[0], yPrev]);
      points.push([xBins[1], yPrev]);

      const N = yScales.length;
      for (let i = 1; i < N; i++) {
        const yThis = yScales[i](binCountValue);
        points.push([xBins[i], yPrev]);              
        points.push([xBins[i] + rectWidth, yThis]);  
        points.push([xBins[i] + rectWidth, yThis]);  
        points.push([xBins[i + 1], yThis]);          
        yPrev = yThis;
      }

      const lineGen = d3.line()
        .x(d => d[0])
        .y(d => d[1]);

      const pathData = lineGen(points);

      g.append("path")
        .attr("class", "multi-hline")
        .attr("d", pathData);
    });

    return node;
  };

  // ------------------------------------------------------------
  // (2) Vertical lines
  // => Now draws a COMPLETELY VERTICAL line from y=0 to y=height
  // ------------------------------------------------------------
  node.drawVerticalLines = function (xValues) {
    // Remove old vertical lines
    g.selectAll(".vline-prism").remove();

    // If null or empty => do nothing
    if (!xValues || !xValues.length) {
      return node;
    }

    xValues.forEach(xVal => {
      const xPos = chartXPos(xVal);
      // Fully vertical line from top (y=0) to bottom (y=height)
      g.append("line")
        .attr("class", "vline-prism")
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", 0)
        .attr("y2", height);
    });

    return node;
  };

  return node;
}
