import * as d3 from "d3";

// A helper to format big numbers into short (K, M, G) or full format.
// We'll switch this in/out using `useShortFormat`.
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
  marginTop = 80,//20,
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
  if (domainAuto.min && !domains.includes(minVal) && (domains.length <= 0 || minVal < domains[0])) {
    domains.unshift(minVal);
  }
  if (domainAuto.max && !domains.includes(maxVal) && maxVal > domains[domains.length - 1]) {
    domains.push(maxVal);
  }

  // Ensure xBins includes 0..1
  if (!xBins.includes(0)) xBins.unshift(0);
  if (!xBins.includes(1)) xBins.push(1);
  // Convert fractional xBins => pixel-based
  xBins = xBins.map(bin => bin * width);

  // We'll use these bins to render the histogram
  let filteredBins = [];

  // Main SVG container
  const svg = d3.create("svg")
    .attr("width", width + marginLeft + marginRight)
    .attr("height", totalHeight);
  const node = svg.node();

  // -----------------------------------------------------------------------
  // Single linear x-axis on top + vertical markers for prism boundaries
  // -----------------------------------------------------------------------
  const globalMin = domains[0];
  const globalMax = domains[domains.length - 1];

  // 3) Change snippet’s tick format from e.g. "1,000,000" => "1M" using nFormatter
  const globalXScale = d3.scaleLinear()
  .domain([globalMin, globalMax])
  .range([0, width]);

  // We place the snippet at (marginTop - 30)
  const topAxisG = svg.append("g")
  .attr("class", "top-linear-axis")
  .attr("transform", `translate(${marginLeft}, ${marginTop - 30})`)
  .call(
    d3.axisTop(globalXScale)
    .ticks(6)
    .tickFormat(d => {
      // same approach as main chart: short format
      let val = nFormatter(d, 1);
      // remove trailing ".0" before K, M, G
      return val.replace(/\.0(?=[GMK]|$)/, "");
    })
  );

  // boundaries (all interior domain boundaries)
  let boundaries = domains.slice(1, -1);

  // 1) Original bar was y1=0..y2=8, stroke-width=1
  //    Enlarge by 40% => length ~ 11.2, stroke ~ 1.4
  const barLength = 2//8 * 1.4;        // ~11.2
  const barStrokeWidth = 1 * 1.4;   // ~1.4

  // We’ll also draw lines connecting snippet => prism
  // so we collect them in an array to process after we create these bars.
  let connectingLines = [];

  function updateBoundaryMarkers() {
    boundaries = domains.slice(1, -1);

    topAxisG.selectAll(".prism-boundary-marker")
    .remove()


    topAxisG.selectAll(".prism-boundary-marker")
    .data(boundaries)
    .enter()
    .append("line")
    .attr("class", "prism-boundary-marker")
    .attr("x1", d => globalXScale(d))
    .attr("x2", d => globalXScale(d))
    .attr("y1", 0)
    .attr("y2", barLength) // was 8, now 11.2
    .attr("stroke", "gray")
    .attr("stroke-width", barStrokeWidth)
    .each(function (d) {
      // 4) Record the snippet’s bottom point so we can connect it to the prism
      const xPos = globalXScale(d);
      const yPos = 0//barLength;
      connectingLines.push({domainValue: d, xSnip: xPos, ySnip: yPos});
    });

    // 2) Add label under each red bar
    // topAxisG.selectAll(".snippet-bar-label")
    // .remove()
    // topAxisG.selectAll(".snippet-bar-label")
    // .data(boundaries)
    // .enter()
    // .append("text")
    // .attr("class", "snippet-bar-label")
    // .attr("text-anchor", "middle")
    // .attr("x", d => globalXScale(d))
    // .attr("y", barLength + 12) // a bit below the bar
    // .attr("fill", "red")
    // .style("font", "10px sans-serif")
    // .text(d => {
    //   // same short format approach
    //   let val = nFormatter(d, 1);
    //   return val.replace(/\.0(?=[GMK]|$)/, "");
    // });
  }

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
    
    .hover-x-axis {
      cursor: pointer;
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
    .attr("height", height + marginBottom)

  // Container <g> for margin
  const mainG = svg.append("g")
    .attr("transform", `translate(${marginLeft}, ${marginTop})`)
    // .attr('clip-path', 'url(#clipPlot)');
  const g = mainG.append("g").classed('main-g', true)
  const content = g.append("g").attr('clip-path', 'url(#clipPlot)');

  // -----------------------------------------------------------

  const hoverXAxis = mainG.append('g').classed('hover-x-axis-g', true)
  let hoverXAxisText = hoverXAxis
    .append('text')
    .attr('y', height - 5)
  let hoverXAxisQuantileText = hoverXAxis
    .append('text')
    .attr('font-family', 'sans-serif')
    .style('font-size', '8px')
    .attr('y', height + marginBottom*.7)
  const hoverXAxisIcon = hoverXAxis
    .append('text')
    .text('✂')
    .attr('transform', `translate(${-marginLeft/2},${height+5})rotate(-90)`)

  const removeFromPrismThreshold = 5 // px
  function nearPrism(x) {
    return domains.slice(1, -1).some(d => Math.abs(chartXPos(d) - x) < removeFromPrismThreshold)
  }
  function getNearestPrimIndex(x) {
    for (let i = 1; i < domains.length - 1; ++i) {
      if (Math.abs(chartXPos(domains[i]) - x) < removeFromPrismThreshold) {
        return i
      }
    }
    return -1
  }

  hoverXAxis.append('rect')
    .attr('class', 'hover-x-axis')
    .attr('x', 0)
    .attr('y', height)
    .attr('width', width)
    .attr('height', rectWidth/2)
    .attr('fill', 'transparent')
    // .attr('fill-opacity', .5)
    .on('mousemove', function(evt) {
      const [x,y] = d3.pointer(evt)
      const xPos = invertChartXPos(x)

      const quantile = (xPos - minVal) / (maxVal - minVal) // TODO
      hoverXAxisText
        .attr('x', x - 15)
        .text(nFormatter(xPos,1))
      hoverXAxisQuantileText
        .attr('x', x - 15)
        .text(quantile.toFixed(3)+'%');
      hoverXAxisIcon
        // .attr('x', x - 15)
        .attr('transform', `translate(${x+5},${height+5})rotate(-90)`)
        // .style('display', null)

      // if xPos near a prim, display a red cross and remove the prism on left click
      if (nearPrism(x)) {
        hoverXAxisText
        .attr('x', x - 15)
        .style('display', 'none')
        // .text('delete on click')
        // .style('fill', 'red');
        hoverXAxisIcon.text('❌')
      } else {
        hoverXAxisText.style('display', null)
        hoverXAxisIcon.text('✂')
      }
    })
    .on('click', (evt) => {
      const [x,y] = d3.pointer(evt)
      const xPos = invertChartXPos(x)

      // remove on click if near prism
      if (nearPrism(x)) {
        removePrism(getNearestPrimIndex(x))
        return
      }

      const quantile = (xPos - minVal) / (maxVal - minVal)
      node.split(xPos, quantile)
    })
    .on('mouseout', () => {
      hoverXAxisText.text(null)
      hoverXAxisQuantileText.text(null)
      hoverXAxisIcon
      .transition()
        .text('✂')
        .attr('transform', `translate(${-marginLeft/2},${height+5})rotate(-90)`)
        // .style('display', 'none')
    })

  // -------------------------------------------------------------------------------------
  // 1) A global boolean that determines default “shrink” or “install” mode
  // -------------------------------------------------------------------------------------
  let shrinkByDefault = true; // If true => prism boundaries are collapsed by default

  let newPrism = true

  // We define boundaryHover[i] => whether boundary i is offset & prism is shown
  let boundaryHover = new Array(xBins.length).fill(false);

  // This function applies the chosen mode to all boundaries,
  // sets boundaryHover accordingly, re-renders
  function applyMode() {
    // If we’re “shrunk,” everything is collapsed => false
    // If we’re “installed,” everything is expanded => true
    const newVal = !shrinkByDefault;
    for (let i = 1; i < xBins.length - 1; i++) {
      boundaryHover[i] = newVal;
    }
    updatePrisms();
  }

  // offsetFor(i) => rectWidth if boundaryHover[i] is true, else 0
  function offsetFor(i) {
    if (i <= 0) return 0;
    if (newPrism) return 0;
    return boundaryHover[i] ? rectWidth : 0;
  }

  // The top boundary is apexOffsetTop in your design
  function topY() {
    if (newPrism) return 0
    return apexOffsetTop;
  }

  // -------------------------------------------------------------------------------------
  // Domain/scale logic
  // -------------------------------------------------------------------------------------
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
    if (idx >= domains.length - 2) return false
    let prismPos = chartXPos(domains[idx + 1])
    let pos = chartXPos(value)
    return pos >= prismPos - rectWidth && pos <= prismPos;
  }
  function chartXPos(value) {
    return d3.scaleLinear()
      .domain(getDomain(value))
      .range(getRange(value))(value);
  }
  function getBinIndex(px) {
    for (let i = 1; i < xBins.length - 1; ++i) {
      if (px <= xBins[i] + /*rectWidth*/offsetFor(i)) return i;
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

  // TODO add fake bin for line chart to get _| (no interpolation on the left side of the axis without prism)
  // Build the bins array
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

  // Y scales per domain segment
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
    const domainIdx = getDomainIndex(b.x0)
    const showPrism = boundaryHover[domainIdx+1]

    if (showPrism && newPrism && insidePrism(b.x0)) {
      // get position inside the prism as [0;1]
      const prismPos = chartXPos(domains[domainIdx+1])
      const prismT = d3.scaleLinear()
        .domain([prismPos-rectWidth, prismPos])
        .range([0, 1])(chartXPos(b.x0))

      // linear interpolation between yScales inside the prism
      return (v) =>
        (1 - prismT) * yScales[domainIdx](v)
        + prismT * yScales[domainIdx+1](v)
    }

    return yScales[domainIdx];
  }

  // -------------------------------------------------------------------------------------
  // Groups for bars/lines
  // -------------------------------------------------------------------------------------
  const barGroup = g.append("g").classed('barGroup', true);
  const foregroundBarGroup = g.append("g").classed('foreground', true);

  const lineTicks = g.append("path").classed('line', true).classed('tick', true);
  const lineGroup = content.append("path").classed('line', true);
  const lineForegroundGroup = content.append("path").classed('foreground line', true);

  // -------------------------------------------------------------------------------------
  // Brush & highlight
  // -------------------------------------------------------------------------------------
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

  // Force an update of the brush selection & the highlight rectangle
  function setBrushSelection() {
    if (brushDomainLeft == null || brushDomainRight == null) {
      // If no selection, hide highlightRect
      highlightRect.style("display", "none");
      return;
    }
    const left = chartXPos(brushDomainLeft);
    const right = chartXPos(brushDomainRight);

    // Call the brush to set the selection in the bottom region
    gBrush.call(brush.move, [left, right]);

    // Also directly update the highlightRect in case the brush event doesn't re-fire
    highlightSelection(left, right);
  }

  // Show/hide the highlight rectangle on the main chart
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

  // Dispatch a “filter” event
  function filterTrigger(detail) {
    node.dispatchEvent(new CustomEvent('filter', { detail }));
  }

  // On brushing, track domain extents & highlight
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

  // -------------------------------------------------------------------------------------
  // Grid lines
  // -------------------------------------------------------------------------------------
  let customGridX = [];
  let customGridY = [];

  function drawCustomGridLines() {
    g.selectAll(".custom-grid-line").remove();

    // Vertical lines
    customGridX.forEach(xVal => {
      const xPos = chartXPos(xVal);
      g.append("line")
        .attr("class", "custom-grid-line")
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", 0)
        .attr("y2", height);
    });

    // Horizontal lines
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

  // -------------------------------------------------------------------------------------
  // 2) Toggle #1: short‐format label
  // -------------------------------------------------------------------------------------
  let useShortFormat = true;
  svg.append("foreignObject")
    .attr("x", width - 160)
    // .attr("y", -22)
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

  // -------------------------------------------------------------------------------------
  // 3) Toggle #2: "Hover Prism" vs. "Install Prism"
  // -------------------------------------------------------------------------------------
  const prismModeButton = svg.append("foreignObject")
    .attr("x", width - 80)
    // .attr("y", -22)
    .attr("width", 70)
    .attr("height", 24)
    .append("xhtml:button")
    .style("font", "8px sans-serif")
    .style("cursor", "pointer")
    .style("user-select", "none")
    .text(shrinkByDefault ? "Hover Prism" : "Install Prism")
    .on("click", () => {
      shrinkByDefault = !shrinkByDefault;
      prismModeButton.text(shrinkByDefault ? "Hover Prism" : "Install Prism");
      applyMode();
    });

  // -------------------------------------------------------------------------------------
  // Create Prisms
  // We'll store them in an array, each boundary has a group with a polygon
  // -------------------------------------------------------------------------------------
  const prisms = [];
  function computePrisms() {
    prisms.length = 0
    g.selectAll('.prisms').remove()
    for (let i = 1; i < xBins.length - 1; i++) {
      const drag = d3.drag()
      .on("start", function () {
        d3.select(this)
        .classed('dragged', true)
        .raise()
      })
      .on("drag", (event) => {
        let newX = event.x - rectWidth / 2;

        if (newPrism) {
          newX += rectWidth;
        }

        // Bound to avoid overlap
        newX = Math.max(0, Math.min(xBins[i + 1] - rectWidth - 50, newX));
        xBins[i] = newX;
        updatePrisms();
      })
      .on("end", function () {
        d3.select(this)
        .classed('dragged', false)
      })

      const group = g.append("g").attr("class", "prisms").call(drag);
      group.append("polygon").attr("class", "prism");
      prisms[i] = group;
    }
  }
  computePrisms();

  function recompute() {
    // xBins.push(width)
    for (let i = 1; i < xBins.length - 1; ++i) {
      xBins[i] = i*(width/(xBins.length-1))
    }
    console.log(xBins)

    // Add value to binSize and recompute
    // binSize.push(0)
    for (let i = 0; i < binSize.length; ++i) {
      binSize[i] = (domains[i+1] - domains[i]) / 50
    }
    console.log(binSize)

    bins = makeBins(data);

    computePrisms()
    computeYScales();
    computeHoverZones()

    boundaryHover = new Array(xBins.length).fill(false);


    updateCharts();
    applyMode()
  }

  function addPrism(x) {
    const index = domains.findIndex(d => d >= x)
    domains.splice(index, 0, x)

    xBins.push(width)
    binSize.push(0)

    recompute()
  }

  function removePrism(i) {
    domains.splice(i, 1)
    console.log(domains)

    xBins.splice(i, 1)
    binSize.splice(i-1, 1)

    recompute()
  }

  let timeouts = []
  function updatePrisms() {
    for (let i = 1; i < xBins.length - 1; i++) {
      let xBin = xBins[i];

      if (boundaryHover[i] && newPrism) {
        xBin = xBin - rectWidth;
      }

      prisms[i].select(".prism")
        .attr("points",
          // `${(xBin + rectWidth / 2)},${apexOffsetTop - apexOffsetTop} ` +
          `${xBin},${topY()} ` +
          `${xBin},${height} ` +
          `${xBin + rectWidth},${height + apexOffsetTop*2} ` +
          `${xBin + rectWidth},${topY()}`
        ).on('mouseover', () => {
          // if (timeouts[i]) {
          //   clearTimeout(timeouts[i])
          //   delete timeouts[i]
          // }
        })
        .on("mouseout", function() {
          const currentlyDragged = false//d3.select(this).select(function() { return this.parentNode; }).node().classList.contains("dragged")
          if (shrinkByDefault && !currentlyDragged) {
              boundaryHover[i] = false;
              g.selectAll(`.boundary-hover-zone`).style('display', null)
              updatePrisms();
            }
        })
        .on('mousedown', (evt) => {
          // right click
          if (evt.which == 3 || evt.button == 2) {

            console.log(domains, i)
            removePrism(i)

            evt.preventDefault();
            return false
          }
        })

      // boundaryHover[i] => if we show or hide this prism
      prisms[i].style("display", boundaryHover[i] ? null : "none");
    }
    computeYScales();
    updateCharts();
    updateHoverZones()
  }

  // -------------------------------------------------------------------------------------
  // Hover Zones: On mouseover/mouseout => only do anything if shrinkByDefault
  // -------------------------------------------------------------------------------------
  const zoneWidth = 12;
  const getZoneX = i => xBins[i] - zoneWidth // /2
  function computeHoverZones() {
    g.selectAll('.boundary-hover-zone').remove()
    for (let i = 1; i < xBins.length - 1; i++) {
      const zoneX = getZoneX(i)
      g.append("rect")
      .attr("class", "boundary-hover-zone")
      .attr("x", zoneX)
      .attr("y", 0)
      .attr("width", zoneWidth)
      .attr("height", height)
      .on("mouseover", function () {
        if (shrinkByDefault) {
          boundaryHover[i] = true;
          d3.select(this).style('display', 'none')
          updatePrisms();
        }
      })
      .on("mouseout", () => {
        // if the mouse leave the boundary without entering inside the prism, hide the prism after 1s
        // timeouts[i] = setTimeout(() => {
        //   if (shrinkByDefault) {
        //     boundaryHover[i] = false;
        //     updatePrisms();
        //   }
        // }, 1000)
      });
    }
  }
  computeHoverZones()

  function updateHoverZones() {
    g.selectAll('.boundary-hover-zone')
      .attr('x', (d,i) => getZoneX(i+1))
  }

  // -------------------------------------------------------------------------------------
  // updateCharts: draws bars/lines + axes
  // -------------------------------------------------------------------------------------
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

      // background line
      lineGroup
        .datum(add_first_last(bins))
        .attr('d', lineGen)
        .style('display', null);

      // foreground line
      lineForegroundGroup
        .datum(add_first_last(filteredBins))
        .attr('d', lineGen);
    }

    // Remove old segment axis/ticks
    g.selectAll(".y-tick,.x-tick,.seg-scale-axis").remove();

    // For each domain slice, define sub-axes
    const segAxisGroup = g.append("g")
      .attr("class", "seg-scale-axis");

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

      let offset = 0
      if (newPrism && boundaryHover[i+1]) {
        offset = rectWidth
      }

      let yAxis = d3.axisLeft(yScaleSub)
        .ticks(maxYTicks)
        .tickSize(-subChartWidth+offset)
        .tickSizeOuter(0);

      // If short format is on, apply the nFormatter for xAxis/yAxis
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
        // Full format with thousands separators
        xAxis = xAxis.tickFormat(d3.format(","));
        yAxis = yAxis.tickFormat(d3.format(","));
      }

      // BOTTOM X‐AXIS
      segAxisGroup.append("g")
        .attr("class", "x-seg-axis")
        .attr("transform", `translate(0, ${height})`)
        .style('pointer-events', 'none')
        .call(xAxis);

      // LEFT Y‐AXIS
      const xSegAxis = segAxisGroup.append("g")
        .attr("class", "y-seg-axis-left")
        .attr("transform", `translate(${xMin}, 0)`)
        .style('pointer-events', 'none')
        .call(yAxis);
      xSegAxis.selectAll('.tick line')
      .style('stroke-dasharray', (i+1) * 1) // TODO depending on something?

      if (newPrism && boundaryHover[i+1]) {
        // TODO for each tick line, add a line from the yScales[i] to yScales[i+1] inside the prism
        // console.log(yScales[i].ticks(6))

        const nTicks = segAxisGroup.selectAll(".tick").nodes().length

        segAxisGroup.append("g")
        .attr("class", "y-seg-axis-prism")
        .attr("transform", `translate(${xMax-rectWidth}, 0)`)
        .attr('clip-path', 'url(#clipPlot)')
        .style('pointer-events', 'none')
        .selectAll('line')
        .data(yScales[i].ticks(nTicks).concat(yScales[i+1].ticks(6)))
        .enter()
        .append("line")
        .attr('x2', rectWidth)
        .attr('y1', d => yScales[i](d))
        .attr('y2', d => Math.max(yScales[i+1](d)))
        // .call(yAxisPrism);
      }
    }

    // Re-apply brush selection in case boundaries changed (so the highlightRect is consistent)
    setBrushSelection();

    drawCustomGridLines();

    updateBoundaryMarkers()

    // 4) Now add connecting lines from snippet => prism:
    //    For each boundary, we find its index, and draw a line from snippet's bottom
    //    to the top of the boundary in the main chart's coordinate system.
    //    We only do this after the main chart is laid out, so xBins is stable.
    svg.selectAll(".snippet-connector-line").remove();

    boundaries.forEach(d => {
      const iBoundary = domains.indexOf(d); // domain's index in 'domains'
      if (iBoundary < 0) return;

      // snippet point (absolute coords)
      // topAxis is at (marginLeft, marginTop - 30) => so snippet bar bottom is:
      const xSnipAbs = marginLeft + globalXScale(d);
      const ySnipAbs = marginTop - 30 + barLength; // barLength ~ 11.2

      // main chart boundary (top of the prism):
      // The boundary in main chart is xBins[iBoundary], y=0 in group g => absolute is:
      const xPrismAbs = marginLeft + xBins[iBoundary];
      const yPrismAbs = marginTop; // top of main chart

      svg.append("line")
      .attr("class", "snippet-connector-line")
      .attr("x1", xSnipAbs)
      .attr("y1", ySnipAbs)
      .attr("x2", xPrismAbs)
      .attr("y2", yPrismAbs)
      .attr("stroke", "black")
      .style('opacity', .3)
      .attr("stroke-dasharray", "2,2")
      .attr("stroke-width", .5);
    });
  }

  // -------------------------------------------------------------------------------------
  // INITIAL: We start in "shrinkByDefault = true" => all boundaries collapsed
  // -------------------------------------------------------------------------------------
  applyMode(); // sets boundaryHover[] = false => collapsed
  // updateCharts is called inside updatePrisms => which is inside applyMode
  // But let's ensure we call it once more for any needed final pass:
  updateCharts();

  // -------------------------------------------------
  // External Crossfilter / API
  // -------------------------------------------------
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

  node.split = addPrism

  return node;
}
