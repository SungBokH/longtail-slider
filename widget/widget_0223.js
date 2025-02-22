import * as d3 from "d3";

// A helper to format big numbers into short (K, M, G) or full format.
function nFormatter(num, digits) {
  const si = [
    { value: 1E9, symbol: "G" },
    { value: 1E6, symbol: "M" },
    { value: 1E3, symbol: "K" },
    { value: 1,   symbol: "" }
  ];
  for (let i = 0; i < si.length; i++) {
    if (num >= si[i].value) {
      return (num / si[i].value).toFixed(digits) + si[i].symbol;
    }
  }
  return num.toString();
}

export default function BarChartMagnitude({
  data,
  domains = [],
  xBins = [],
  binSize = [],
  domainAuto = { min: true, max: true },
  type = 'line',

  width = 400,
  height = 200,

  // 1) Increase marginTop (e.g., from 60 to 80) for more vertical space above the chart
  marginTop = 80,

  marginRight = 20,
  marginBottom = 30,
  marginLeft = 40,

  brushOffset = 20,
  brushHeight = 8
}) {
  // Copy arrays so we don't mutate original references
  domains = domains.slice();
  xBins = xBins.slice();
  binSize = binSize.slice();

  const totalHeight = height + brushHeight + brushOffset + marginTop + marginBottom;

  // Prism geometry constants
  const scaleFactor = 0.666;
  const rectWidth = 40 * scaleFactor;
  const apexOffsetTop = 10 * scaleFactor;

  // Possibly expand domain if auto
  const minVal = d3.min(data);
  const maxVal = d3.max(data);
  if (domainAuto.min && !domains.includes(minVal) && minVal < domains[0]) {
    domains.unshift(minVal);
  }
  if (domainAuto.max && !domains.includes(maxVal) && maxVal > domains[domains.length - 1]) {
    domains.push(maxVal);
  }

  // Ensure xBins includes 0..1
  if (!xBins.includes(0)) xBins.unshift(0);
  if (!xBins.includes(1)) xBins.push(1);
  xBins = xBins.map(bin => bin * width);

  let filteredBins = [];

  // Main SVG
  const svg = d3.create("svg")
    .attr("width", width + marginLeft + marginRight)
    .attr("height", totalHeight);
  const node = svg.node();

  // -----------------------------------------------------------------------
  // Single linear x-axis on top + vertical markers for prism boundaries
  // -----------------------------------------------------------------------
  const globalMin = domains[0];
  const globalMax = domains[domains.length - 1];
  const globalXScale = d3.scaleLinear()
    .domain([globalMin, globalMax])
    .range([0, width]);

  // We place the snippet at marginTop - 30 => e.g., 80 - 30 = 50
  // so it's 30px above the main chart area
  const topAxisG = svg.append("g")
    .attr("class", "top-linear-axis")
    .attr("transform", `translate(${marginLeft}, ${marginTop - 30})`)
    .call(
      d3.axisTop(globalXScale)
        .ticks(6)
        .tickFormat(d3.format(","))
    );

  const boundaries = domains.slice(1, -1);
  topAxisG.selectAll(".prism-boundary-marker")
    .data(boundaries)
    .enter()
    .append("line")
    .attr("class", "prism-boundary-marker")
    .attr("x1", d => globalXScale(d))
    .attr("x2", d => globalXScale(d))
    .attr("y1", 0)
    .attr("y2", 8)
    .attr("stroke", "red")
    .attr("stroke-width", 1);

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
      stroke-width: 0.7;
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

    .custom-grid-line {
      stroke: #000;
      stroke-width: 0.3;
      shape-rendering: crispEdges;
      pointer-events: none;
      stroke-dasharray: 2,1;
    }
    .multi-hline {
      fill: none;
      stroke: red;
      stroke-dasharray: 2,1;
      stroke-width: 0.5;
    }
    .vline-prism {
      fill: none;
      stroke: black;
      stroke-dasharray: 2,1;
      stroke-width: 0.7;
    }

    .seg-scale-axis .domain {
      stroke: #333;
      stroke-width: 1;
    }
    .seg-scale-axis .tick line {
      stroke: #000;
      stroke-width: 0.3;
      stroke-dasharray: 2,1;
    }
    .seg-scale-axis text {
      font: 10px sans-serif;
      fill: #333;
    }

    .toggle-label {
      fill: #333;
      font: 12px sans-serif;
      cursor: pointer;
      user-select: none;
    }

    .boundary-hover-zone {
      fill: blue;
      opacity: 0;
      cursor: pointer;
    }
    .boundary-hover-zone:hover {
      fill: rgba(0,255,0,0.03);
    }
    
    .y-seg-axis-prism {
      text, .domain {
        display: none;
      }
      line {
        stroke: #58626f;
        stroke-width: 0.3;
        stroke-dasharray: 2,1;
      }
    }
  `;
  document.head.appendChild(style);

  // clip the plot
  svg.append("defs")
    .append("clipPath")
    .attr('id', 'clipPlot')
    .append("rect")
    .attr('x', -marginLeft)
    .attr('y', 0)
    .attr("width", width + marginLeft + marginRight)
    .attr("height", height + marginBottom);

  // Container <g> for margin
  const g = svg.append("g")
    .attr("transform", `translate(${marginLeft}, ${marginTop})`);

  const content = g.append("g")
    .attr('clip-path', 'url(#clipPlot)');

  // Toggle booleans
  let shrinkByDefault = false;
  let newPrism = true;
  let boundaryHover = new Array(xBins.length).fill(false);

  function applyMode() {
    const newVal = !shrinkByDefault;
    for (let i = 1; i < xBins.length - 1; i++) {
      boundaryHover[i] = newVal;
    }
    updatePrisms();
  }
  function offsetFor(i) {
    if (i <= 0) return 0;
    if (newPrism) return 0;
    return boundaryHover[i] ? rectWidth : 0;
  }
  function topY() {
    if (newPrism) return 0;
    return apexOffsetTop;
  }

  // Domain/scale logic
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
    return [xBins[idx] + offsetFor(idx), xBins[idx + 1]];
  }
  function insidePrism(value) {
    const idx = getDomainIndex(value);
    if (idx >= domains.length - 2) return false;
    let prismPos = chartXPos(domains[idx + 1]);
    let pos = chartXPos(value);
    return pos >= prismPos - rectWidth && pos <= prismPos;
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
    const domainLeft = xBins[idx - 1] + offsetFor(idx);
    const domainRight = xBins[idx];
    return d3.scaleLinear()
      .domain([domainLeft, domainRight])
      .range([domains[idx - 1], domains[idx]])(px);
  }

  function makeBins(arr) {
    const allBins = [];
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
          .range([height, topY()])
      );
    }
  }
  computeYScales();
  function getYScaleForBin(b) {
    const domainIdx = getDomainIndex(b.x0);
    const showPrism = boundaryHover[domainIdx + 1];
    if (showPrism && newPrism && insidePrism(b.x0)) {
      const prismPos = chartXPos(domains[domainIdx + 1]);
      const prismT = d3.scaleLinear()
        .domain([prismPos - rectWidth, prismPos])
        .range([0, 1])(chartXPos(b.x0));
      return (v) =>
        (1 - prismT) * yScales[domainIdx](v)
        + prismT * yScales[domainIdx + 1](v);
    }
    return yScales[domainIdx];
  }

  // Groups for bars/lines
  const barGroup = g.append("g").classed('barGroup', true);
  const foregroundBarGroup = g.append("g").classed('foreground', true);
  const lineTicks = g.append("path").classed('line', true).classed('tick', true);
  const lineGroup = content.append("path").classed('line', true);
  const lineForegroundGroup = content.append("path").classed('foreground line', true);

  // Brush & highlight
  let brushDomainLeft = null;
  let brushDomainRight = null;
  const brush = d3.brushX()
    .extent([[0, height + brushOffset], [width, height + brushOffset + brushHeight]])
    .on("brush end", brushedChart);

  const gBrush = g.append("g").attr("class", "brush").call(brush);

  const highlightRect = g.insert("rect", ".barGroup")
    .attr("class", "brush-highlight")
    .attr("fill", "orange")
    .attr("fill-opacity", 0.3)
    .attr("y", 0)
    .attr("height", height)
    .style("pointer-events", "none")
    .style("display", "none");

  function setBrushSelection() {
    if (brushDomainLeft == null || brushDomainRight == null) {
      highlightRect.style("display", "none");
      return;
    }
    const left = chartXPos(brushDomainLeft);
    const right = chartXPos(brushDomainRight);
    gBrush.call(brush.move, [left, right]);
    highlightSelection(left, right);
  }
  function highlightSelection(pxLeft, pxRight) {
    if (pxLeft == null || pxRight == null || pxRight <= pxLeft) {
      highlightRect.style("display", "none");
    } else {
      highlightRect
        .style("display", null)
        .attr("x", pxLeft)
        .attr("width", pxRight - pxLeft);
    }
  }
  function filterTrigger(detail) {
    node.dispatchEvent(new CustomEvent('filter', { detail }));
  }
  function brushedChart(event) {
    const s = event.selection;
    if (!s) {
      brushDomainLeft = brushDomainRight = null;
      highlightRect.style("display", "none");
      if (event.sourceEvent) {
        filterTrigger({});
      }
      return;
    }
    const [pxLeft, pxRight] = s;
    brushDomainLeft = invertChartXPos(pxLeft);
    brushDomainRight = invertChartXPos(pxRight);
    highlightSelection(pxLeft, pxRight);
    if (event.sourceEvent) {
      filterTrigger({ selection: [brushDomainLeft, brushDomainRight] });
    }
  }

  // Grid lines
  let customGridX = [];
  let customGridY = [];

  function drawCustomGridLines() {
    g.selectAll(".custom-grid-line").remove();

    customGridX.forEach(xVal => {
      const xPos = chartXPos(xVal);
      g.append("line")
        .attr("class", "custom-grid-line")
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", 0)
        .attr("y2", height);
    });
    customGridY.forEach(binCount => {
      for (let i = 0; i < yScales.length; i++) {
        const yPos = yScales[i](binCount);
        if (yPos < 0 || yPos > height) continue;

        const segmentLeft = xBins[i] + offsetFor(i);
        const segmentRight = xBins[i + 1];

        if (yPos >= topY()) {
          g.append("line")
            .attr("class", "custom-grid-line")
            .attr("x1", segmentLeft)
            .attr("x2", segmentRight)
            .attr("y1", yPos)
            .attr("y2", yPos);
        } else {
          const t = yPos / topY();
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
    g.selectAll(".custom-grid-line").raise();
  }

  // Toggle #1: short‐format label
  let useShortFormat = false;

  // 2) Place the toggle buttons near the very top so they do not overlap the snippet
  // Let's position them at (x, y) = (width - 160, 5) and (width - 80, 5)
  svg.append("foreignObject")
    .attr("x", width - 160)
    .attr("y", 5) // place near top
    .attr("width", 70)
    .attr("height", 24)
    .append("xhtml:button")
    .style("font", "8px sans-serif")
    .style("cursor", "pointer")
    .style("user-select", "none")
    .text("Labels")
    .on("click", () => {
      useShortFormat = !useShortFormat;
      updateCharts();
    });

  // Toggle #2: "Hover Prism" vs. "Install Prism"
  const prismModeFO = svg.append("foreignObject")
    .attr("x", width - 80)
    .attr("y", 5) // also near top
    .attr("width", 70)
    .attr("height", 24);

  const prismModeButton = prismModeFO.append("xhtml:button")
    .style("font", "8px sans-serif")
    .style("cursor", "pointer")
    .style("user-select", "none")
    .text(shrinkByDefault ? "Hover Prism" : "Install Prism")
    .on("click", () => {
      shrinkByDefault = !shrinkByDefault;
      prismModeButton.text(shrinkByDefault ? "Hover Prism" : "Install Prism");
      applyMode();
    });

  // Create Prisms
  const prisms = [];
  for (let i = 1; i < xBins.length - 1; i++) {
    const drag = d3.drag()
      .on("start", function() {
        d3.select(this)
          .classed('dragged', true)
          .raise();
      })
      .on("drag", (event) => {
        let newX = event.x - rectWidth / 2;
        if (newPrism) {
          newX += rectWidth;
        }
        newX = Math.max(0, Math.min(xBins[i + 1] - rectWidth - 50, newX));
        xBins[i] = newX;
        updatePrisms();
      })
      .on("end", function() {
        d3.select(this)
          .classed('dragged', false);
      });

    const group = g.append("g").call(drag);
    group.append("polygon").attr("class", "prism");
    prisms[i] = group;
  }

  let timeouts = [];
  function updatePrisms() {
    for (let i = 1; i < xBins.length - 1; i++) {
      let xBin = xBins[i];
      if (boundaryHover[i] && newPrism) {
        xBin = xBin - rectWidth;
      }
      prisms[i].select(".prism")
        .attr("points",
          `${xBin},${topY()} ` +
          `${xBin},${height} ` +
          `${xBin + rectWidth},${height + apexOffsetTop*2} ` +
          `${xBin + rectWidth},${topY()}`
        )
        .on("mouseover", () => {})
        .on("mouseout", function() {
          const currentlyDragged = false;
          if (shrinkByDefault && !currentlyDragged) {
            boundaryHover[i] = false;
            g.selectAll(`.boundary-hover-zone`).style('display', null);
            updatePrisms();
          }
        });
      // Show or hide
      prisms[i].style("display", boundaryHover[i] ? null : "none");
    }
    computeYScales();
    updateCharts();
    updateHoverZones();
  }

  // Hover Zones
  const zoneWidth = 12;
  const getZoneX = i => xBins[i] - zoneWidth;
  for (let i = 1; i < xBins.length - 1; i++) {
    const zoneX = getZoneX(i);
    g.append("rect")
      .attr("class", "boundary-hover-zone")
      .attr("x", zoneX)
      .attr("y", 0)
      .attr("width", zoneWidth)
      .attr("height", height)
      .on("mouseover", function() {
        if (shrinkByDefault) {
          boundaryHover[i] = true;
          d3.select(this).style('display', 'none');
          updatePrisms();
        }
      })
      .on("mouseout", () => {});
  }

  function updateHoverZones() {
    g.selectAll('.boundary-hover-zone')
      .attr('x', (d,i) => getZoneX(i+1));
  }

  // updateCharts
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
        .attr("height", d => (height - getYScaleForBin(d)(d.values.length)));

      // Foreground bars (filtered)
      foregroundBarGroup.selectAll(".bar")
        .data(filteredBins, d => d.x0)
        .join(
          enter => enter
            .append("rect")
            .attr("class", "bar")
            .call(sel => {
              sel.attr("x", d => Math.min(chartXPos(d.x0), chartXPos(d.x1)))
                 .attr("y", d => getYScaleForBin(d)(d.values.length))
                 .attr("width", d => Math.abs(chartXPos(d.x1) - chartXPos(d.x0)) - 1)
                 .attr("height", d => (height - getYScaleForBin(d)(d.values.length)));
            }),
          update => update
            .call(sel => {
              sel.attr("x", d => Math.min(chartXPos(d.x0), chartXPos(d.x1)))
                 .attr("y", d => getYScaleForBin(d)(d.values.length))
                 .attr("width", d => Math.abs(chartXPos(d.x1) - chartXPos(d.x0)) - 1)
                 .attr("height", d => (height - getYScaleForBin(d)(d.values.length)));
            }),
          exit => exit.remove()
        );

    } else if (type === 'line') {
      function add_first_last(arr) {
        if (!arr.length) return arr;
        const first = arr[0];
        const last = arr[arr.length - 1];
        return [
          { x0: first.x0, x1: first.x0, values: [] },
          ...arr,
          { x0: last.x1, x1: last.x1, values: [] },
        ];
      }
      const lineGen = d3.line()
        .x(d => Math.min(chartXPos(d.x0), chartXPos(d.x1)))
        .y(d => getYScaleForBin(d)(d.values.length));

      lineGroup
        .datum(add_first_last(bins))
        .attr('d', lineGen)
        .style('display', null);

      lineForegroundGroup
        .datum(add_first_last(filteredBins))
        .attr('d', lineGen);
    }

    g.selectAll(".y-tick,.x-tick,.seg-scale-axis").remove();
    const segAxisGroup = g.append("g").attr("class", "seg-scale-axis");

    for (let i = 0; i < domains.length - 1; i++) {
      const xMin = xBins[i] + offsetFor(i);
      const xMax = xBins[i + 1];
      const xScaleSub = d3.scaleLinear()
        .domain([domains[i], domains[i + 1]])
        .range([xMin, xMax]);

      const yScaleSub = yScales[i];
      const subChartWidth = xMax - xMin;
      const subChartHeight = height - topY();
      const maxXTicks = Math.max(2, Math.floor(subChartWidth / 50));
      const maxYTicks = Math.max(2, Math.floor(subChartHeight / 30));

      let xAxis = d3.axisBottom(xScaleSub)
        .ticks(maxXTicks)
        .tickSize(-subChartHeight)
        .tickSizeOuter(0);

      let offset = 0;
      if (newPrism && boundaryHover[i+1]) {
        offset = rectWidth;
      }

      let yAxis = d3.axisLeft(yScaleSub)
        .ticks(maxYTicks)
        .tickSize(-subChartWidth + offset)
        .tickSizeOuter(0);

      if (useShortFormat) {
        xAxis = xAxis.tickFormat(d => {
          const val = nFormatter(d, 1);
          return val.replace(/\.0(?=[GMK]|$)/, "");
        });
        yAxis = yAxis.tickFormat(d => {
          const val = nFormatter(d, 1);
          return val.replace(/\.0(?=[GMK]|$)/, "");
        });
      } else {
        xAxis = xAxis.tickFormat(d3.format(","));
        yAxis = yAxis.tickFormat(d3.format(","));
      }

      segAxisGroup.append("g")
        .attr("class", "x-seg-axis")
        .attr("transform", `translate(0, ${height})`)
        .style('pointer-events', 'none')
        .call(xAxis);

      segAxisGroup.append("g")
        .attr("class", "y-seg-axis-left")
        .attr("transform", `translate(${xMin}, 0)`)
        .style('pointer-events', 'none')
        .call(yAxis);

      if (newPrism && boundaryHover[i+1]) {
        segAxisGroup.append("g")
          .attr("class", "y-seg-axis-prism")
          .attr("transform", `translate(${xMax - rectWidth}, 0)`)
          .style('pointer-events', 'none')
          .selectAll('line')
          .data(yScales[i].ticks(6).concat(yScales[i+1].ticks(6)))
          .enter()
          .append("line")
          .attr("x2", rectWidth)
          .attr("y1", d => yScales[i](d))
          .attr("y2", d => Math.max(yScales[i+1](d)));
      }
    }

    setBrushSelection();
    drawCustomGridLines();
  }

  applyMode();
  updateCharts();

  // External Crossfilter / API
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
      points.push([xBins[i], yPrev]);
      points.push([xBins[i] + rectWidth, yThis]);
      points.push([xBins[i] + rectWidth, yThis]);
      points.push([xBins[i + 1], yThis]);
      yPrev = yThis;
    }
    const lineGen = d3.line().x(d => d[0]).y(d => d[1]);
    const pathData = lineGen(points);
    g.append("path")
      .attr("class", "connected-binCount-line")
      .attr("d", pathData)
      .attr("fill", "none")
      .attr("stroke", "black")
      .attr("stroke-dasharray", "2,1")
      .attr("stroke-width", 0.7);
    return node;
  };

  node.drawMultipleHorizontalLines = function (lines) {
    g.selectAll(".multi-hline").remove();
    if (!lines || !lines.length) {
      return node;
    }
    const normalized = lines.map(line => {
      return (typeof line === "number") ? { value: line } : line;
    });
    normalized.forEach(lineObj => {
      const binCountValue = lineObj.value;
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
      const lineGen = d3.line().x(d => d[0]).y(d => d[1]);
      const pathData = lineGen(points);
      const path = g.append("path")
        .attr("class", lineObj.class || "multi-hline")
        .attr("d", pathData);
      if (lineObj.stroke) path.attr("stroke", lineObj.stroke);
      if (lineObj.strokeDasharray) path.attr("stroke-dasharray", lineObj.strokeDasharray);
      if (lineObj.strokeWidth) path.attr("stroke-width", lineObj.strokeWidth);
    });
    return node;
  };

  node.drawVerticalLines = function (lines) {
    g.selectAll(".vline-prism").remove();
    if (!lines || !lines.length) return node;
    const normalized = lines.map(line => {
      return (typeof line === "number") ? { value: line } : line;
    });
    normalized.forEach(lineObj => {
      const xPos = chartXPos(lineObj.value);
      const lineElem = g.append("line")
        .attr("class", lineObj.class || "vline-prism")
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", 0)
        .attr("y2", height);
      if (lineObj.stroke) lineElem.attr("stroke", lineObj.stroke);
      if (lineObj.strokeDasharray) lineElem.attr("stroke-dasharray", lineObj.strokeDasharray);
      if (lineObj.strokeWidth) lineElem.attr("stroke-width", lineObj.strokeWidth);
    });
    return node;
  };

  return node;
}
