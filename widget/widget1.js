import * as d3 from "d3";

// MagChart ?
export default function BarChartMagnitude({
  data,
  domains = [],
  xBins = [],
  binSize = [],
  domainAuto = {
    min: true,
    max: true
  },
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
  // -------------------------------------------------------
  // 1) Keep existing logic, with minimal changes
  // -------------------------------------------------------
  domains = domains.slice();
  xBins = xBins.slice();
  binSize = binSize.slice();

  const totalHeight = height + brushHeight + brushOffset + marginTop + marginBottom;

  const scaleFactor = 0.666;
  const rectWidth = 40 * scaleFactor;
  const apexOffsetTop = 10 * scaleFactor;
  const yForPrismTop = apexOffsetTop;

  // domainAuto
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

  if (!xBins.includes(0)) xBins.unshift(0);
  if (!xBins.includes(1)) xBins.push(1);
  xBins = xBins.map(bin => bin * width);

  let filteredBins = [];

  const svg = d3.create("svg")
    .attr("width", width + marginLeft + marginRight)
    .attr("height", totalHeight);
  const node = svg.node();

  // Minimal CSS
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

    /* WHITE custom grid lines */
    .custom-grid-line {
      stroke: red;
      stroke-width: 1;
      shape-rendering: crispEdges;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  const g = svg.append("g")
    .attr("transform", `translate(${marginLeft}, ${marginTop})`);

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

  let barGroup = g.append("g").classed('barGroup', true);
  let foregroundBarGroup = g.append("g").classed('foreground', true);

  let lineTicks = g.append("path").classed('line', true).classed('tick', true);
  let lineGroup = g.append("path").classed('line', true);
  let lineForegroundGroup = g.append("path").classed('foreground line', true);

  function getYScaleForBin(b) {
    return yScales[getDomainIndex(b.x0)];
  }

  g.append("line")
    .attr("class", "x-axis-line")
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", height)
    .attr("y2", height);

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

  const updateForegroundBar = update => update
    .attr("x", d => Math.min(chartXPos(d.x0), chartXPos(d.x1)))
    .attr("y", d => getYScaleForBin(d)(d.values.length))
    .attr("width", d => Math.abs(chartXPos(d.x1) - chartXPos(d.x0)) - 1)
    .attr("height", d => height - getYScaleForBin(d)(d.values.length));

  // ----------------------------------
  // New: user-defined white grid lines
  // - customGridX => domain-based x
  // - customGridY => bin-count-based y
  // We'll draw a separate horizontal line for each domain segment
  // so that it "steps" across prisms.
  // ----------------------------------
  let customGridX = null;
  let customGridY = null;

  function drawCustomGridLines() {
    // Remove any existing custom lines
    g.selectAll(".custom-grid-line").remove();

    // Draw vertical line across the entire chart if customGridX is set
    if (customGridX != null) {
      const xPos = chartXPos(customGridX);
      g.append("line")
        .attr("class", "custom-grid-line")
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", 0)
        .attr("y2", height);
    }

    // Draw horizontal line(s) for bin-count = customGridY
    if (customGridY != null) {
      // We have yScales[i] for each domain segment i
      // The horizontal line can "step" across from xBins[i] to xBins[i+1]
      // at yScales[i](customGridY).
      for (let i = 0; i < yScales.length; i++) {
        const scale = yScales[i];
        const yPos = scale(customGridY);

        // If the line is out of range (e.g. customGridY > maxCount), skip
        if (yPos < yForPrismTop || yPos > height) continue;

        const segmentLeft = xBins[i] + (i > 0 ? rectWidth : 0);
        const segmentRight = xBins[i + 1]; // no rectWidth shift on the right
        // Draw line in [segmentLeft, segmentRight]
        g.append("line")
          .attr("class", "custom-grid-line")
          .attr("x1", segmentLeft)
          .attr("x2", segmentRight)
          .attr("y1", yPos)
          .attr("y2", yPos);
      }
    }
  }

  function updateCharts() {
    lineGroup.style('display', 'none');
    barGroup.selectAll(".bar").remove();

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
      const line = d3.line()
        .x(d => Math.min(chartXPos(d.x0), chartXPos(d.x1)))
        .y(d => getYScaleForBin(d)(d.values.length));

      function domainsToLineTicks() {
        const arr = [];
        for (const d of domains) {
          if (arr.length > 0) {
            arr.push({ x0: d - 1, x1: d - 1, values: Array(5000) });
          }
          arr.push({ x0: d, x1: d, values: Array(5000) });
        }
        return arr;
      }

      lineTicks
        .datum(domainsToLineTicks(), d => d.x0)
        .attr('d', line)
        .attr('stroke-dasharray', 4)
        .attr('fill', 'none')
        .style('display', null);

      lineGroup
        .datum(add_first_last(bins), d => d.x0)
        .attr('d', line)
        .style('display', null);

      lineForegroundGroup
        .datum(add_first_last(filteredBins), d => d.x0)
        .attr('d', line);
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

    // segment-axis
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

    // Draw the newly added white grid lines
    drawCustomGridLines();
  }

  // Prism logic (unchanged)
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

  // Existing crossfilter logic
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

  // -------------------------------------------------------
  // NEW: public setter for user to define white grid lines
  //      e.g. chart.customGridLine(500, 20);
  // -------------------------------------------------------
  node.customGridLine = (xVal, yVal) => {
    customGridX = xVal !== undefined ? xVal : null;
    customGridY = yVal !== undefined ? yVal : null;
    updateCharts();
    return node;
  };

  return node;
}
