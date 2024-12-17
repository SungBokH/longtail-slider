const scaleFactor = 0.56;
const originalWidth = 600, originalHeight = 400;

let height = (originalHeight * scaleFactor) - 40; 
const width = originalWidth * scaleFactor; 

const margin = { top: 20, right: 50*scaleFactor, bottom: 40*scaleFactor, left: 80*scaleFactor };
const blankSpace = 20 * scaleFactor;
const brushOffset = 10; // small vertical offset below x-axis
const brushHeight = 20 * scaleFactor; 
const totalHeight = height + brushHeight + brushOffset + margin.top + margin.bottom;

const availableWidth = width - blankSpace;

const wealthTop1 = d3.range(0, 1.1, 0.1).map(i => ({
    x: i,
    y: 1000000 - 600000 * Math.pow(i,0.5)
}));

const wealthNext9 = d3.range(1, 11, 1).map(i => ({
    x: i,
    y: 400000 * Math.pow(0.93, i - 1)
}));

const wealthBottom90 = d3.range(10, 101, 10).map(i => ({
    x: i,
    y: 200000 * Math.pow(0.85, (i-10)/10)
}));

const rectWidth = 40 * scaleFactor; 
const apexOffsetTop = 20 * scaleFactor; 
const yForPrismTop = apexOffsetTop; 

// Initially selected domain intervals
let chart1DomainSelection = [1,10]; // Highlight [1,10] in Chart 1 initially

let rectX1 = availableWidth * 0.2; 
let rectX2 = availableWidth * 0.6;

const svg = d3.select("#chart1")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", totalHeight);

const g = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

const yScaleTop1 = d3.scaleLinear()
    .domain([0, d3.max(wealthTop1, d => d.y)])
    .range([height, yForPrismTop]);

const yScaleNext9 = d3.scaleLinear()
    .domain([0, d3.max(wealthNext9, d => d.y)])
    .range([height, yForPrismTop]);

const yScaleBottom90 = d3.scaleLinear()
    .domain([0, d3.max(wealthBottom90, d => d.y)])
    .range([height, yForPrismTop]);

function chartXPos(d) {
    if (d < 1) {
        return d3.scaleLinear().domain([0,1]).range([0, rectX1])(d);
    } else if (d === 1) {
        return rectX1 + rectWidth; 
    } else if (d > 1 && d < 10) {
        return d3.scaleLinear().domain([1,10]).range([rectX1+rectWidth, rectX2])(d);
    } else if (d === 10) {
        return rectX2 + rectWidth;
    } else {
        return d3.scaleLinear().domain([10,100]).range([rectX2+rectWidth, availableWidth])(d);
    }
}

const highlightRect1 = g.append("rect")
    .attr("y", yForPrismTop)
    .attr("height", height - yForPrismTop)
    .attr("fill", "rgba(70,130,180,0.2)")
    .attr("display","none");

const top1LinePath = g.append("path").datum(wealthTop1).attr("class", "line");
const next9LinePath = g.append("path").datum(wealthNext9).attr("class", "line");
const bottom90LinePath = g.append("path").datum(wealthBottom90).attr("class", "line");

const connectorArea1 = g.append("polygon").attr("class", "connector-area");
const connectorLine1 = g.append("line").attr("class", "connector-line");
const connectorArea2 = g.append("polygon").attr("class", "connector-area");
const connectorLine2 = g.append("line").attr("class", "connector-line");

const refValues = [100000, 30000]; 
const refGroup = g.append("g");
const refConnectorAreas1 = [];
const refConnectorLines1 = [];
const refConnectorAreas2 = [];
const refConnectorLines2 = [];

refValues.forEach((val, i) => {
    refGroup.append("line").attr("class", "ref-line top1-ref-line");
    refGroup.append("line").attr("class", "ref-line next9-ref-line");
    refGroup.append("line").attr("class", "ref-line bottom90-ref-line");

    refConnectorAreas1[i] = g.append("polygon").attr("class", "ref-connector-area");
    refConnectorLines1[i] = g.append("line").attr("class", "ref-connector-line");
    refConnectorAreas2[i] = g.append("polygon").attr("class", "ref-connector-area");
    refConnectorLines2[i] = g.append("line").attr("class", "ref-connector-line");
});

g.append("line")
    .attr("class", "x-axis-line")
    .attr("x1", 0)
    .attr("x2", availableWidth)
    .attr("y1", height)
    .attr("y2", height);

const brush1 = d3.brushX()
    .extent([[0, height+brushOffset],[availableWidth, height+brushOffset+brushHeight]])
    .on("brush end", brushedChart1);

const gBrush1 = g.append("g")
    .attr("class","brush1")
    .call(brush1);

function setBrush1Selection() {
    const left = chartXPos(chart1DomainSelection[0]);
    const right = chartXPos(chart1DomainSelection[1]);
    gBrush1.call(brush1.move, [left, right]);
}

function brushedChart1(event) {
    const s = event.selection;
    if (!s) {
        highlightRect1.attr("display","none");
        return;
    }
    const [pxLeft, pxRight] = s;
    highlightRect1
        .attr("x", pxLeft)
        .attr("width", pxRight - pxLeft)
        .attr("display", null);

    if (event.type === "end") {
        const domainLeft = invertChart1XPos(pxLeft);
        const domainRight = invertChart1XPos(pxRight);
        chart1DomainSelection = [domainLeft, domainRight];
    }
}

function invertChart1XPos(px) {
    if (px <= rectX1) {
        const scale = d3.scaleLinear().domain([0,rectX1]).range([0,1]);
        return scale(px);
    } else if (px <= rectX1+rectWidth) {
        return 1;
    } else if (px <= rectX2) {
        const scale = d3.scaleLinear().domain([rectX1+rectWidth, rectX2]).range([1,10]);
        return scale(px);
    } else if (px <= rectX2+rectWidth) {
        return 10;
    } else {
        const scale = d3.scaleLinear().domain([rectX2+rectWidth, availableWidth]).range([10,100]);
        return scale(px);
    }
}

function updateCharts() {
    const xScaleTop1 = d3.scaleLinear().domain([0,1]).range([0, rectX1]);
    const xScaleNext9 = d3.scaleLinear().domain([1,10]).range([rectX1+rectWidth, rectX2]);
    const xScaleBottom90 = d3.scaleLinear().domain([10,100]).range([rectX2+rectWidth, availableWidth]);

    const lineTop1 = d3.line().x(d => xScaleTop1(d.x)).y(d => yScaleTop1(d.y));
    const lineNext9 = d3.line().x(d => (d.x===1 ? rectX1+rectWidth : xScaleNext9(d.x))).y(d => yScaleNext9(d.y));
    const lineBottom90 = d3.line().x(d => (d.x===10 ? rectX2+rectWidth : xScaleBottom90(d.x))).y(d => yScaleBottom90(d.y));

    top1LinePath.attr("d", lineTop1);
    next9LinePath.attr("d", lineNext9);
    bottom90LinePath.attr("d", lineBottom90);

    const top1End = wealthTop1.find(d => d.x === 1);
    const next9Start = wealthNext9.find(d => d.x === 1);
    const next9End = wealthNext9.find(d => d.x === 10);
    const bottom90Start = wealthBottom90.find(d => d.x === 10);

    const top1EndX = xScaleTop1(1),
          top1EndY = yScaleTop1(top1End.y),
          next9StartX = rectX1+rectWidth,
          next9StartY = yScaleNext9(next9Start.y),
          next9EndX = xScaleNext9(10),
          next9EndY = yScaleNext9(next9End.y),
          bottom90StartX = rectX2+rectWidth,
          bottom90StartY = yScaleBottom90(bottom90Start.y);

    connectorArea1
        .attr("points",
            `${top1EndX},${top1EndY} 
             ${top1EndX},${height} 
             ${next9StartX},${height} 
             ${next9StartX},${next9StartY}`
        );
    connectorLine1
        .attr("x1", top1EndX)
        .attr("y1", top1EndY)
        .attr("x2", next9StartX)
        .attr("y2", next9StartY);

    connectorArea2
        .attr("points",
            `${next9EndX},${next9EndY} 
             ${next9EndX},${height} 
             ${bottom90StartX},${height} 
             ${bottom90StartX},${bottom90StartY}`
        );
    connectorLine2
        .attr("x1", next9EndX)
        .attr("y1", next9EndY)
        .attr("x2", bottom90StartX)
        .attr("y2", bottom90StartY);

    g.selectAll(".top-y-tick,.mid-y-tick,.bottom-y-tick,.x-tick").remove();

    const formatY = d => {
        let s = d3.format(".2s")(d);
        s = s.replace('k','K');
        return s;
    };

    const topTicks = yScaleTop1.ticks(5);
    const midTicks = yScaleNext9.ticks(5);
    const bottomTicks = yScaleBottom90.ticks(5);

    const leftXTicks = d3.range(0, 1.01, 0.2).map(d => +d.toFixed(1));
    const midXTicksArr = d3.range(1, 11, 1);
    const rightXTicks = d3.range(10, 101, 10);
    const allXTicks = [...leftXTicks, ...midXTicksArr, ...rightXTicks];

    // Y-ticks for top
    const topTickSelection = g.selectAll(".top-y-tick").data(topTicks).enter().append("g").attr("class", "top-y-tick");
    topTickSelection.append("line").attr("class", "tick-line");
    topTickSelection.append("text").attr("class", "tick-label");
    topTickSelection.each(function(d) {
        const yPos = yScaleTop1(d);
        d3.select(this).select("line")
            .attr("x1", rectX1)
            .attr("x2", rectX1 - 8)
            .attr("y1", yPos)
            .attr("y2", yPos);
        d3.select(this).select("text")
            .attr("x", rectX1 - 10)
            .attr("y", yPos)
            .attr("text-anchor", "end")
            .text(formatY(d));
    });

    // mid-y-ticks
    const midTickSelection = g.selectAll(".mid-y-tick").data(midTicks).enter().append("g").attr("class", "mid-y-tick");
    midTickSelection.append("line").attr("class", "tick-line");
    midTickSelection.append("text").attr("class", "tick-label");
    midTickSelection.each(function(d) {
        const yPos = yScaleNext9(d);
        d3.select(this).select("line")
            .attr("x1", rectX1+rectWidth)
            .attr("x2", rectX1+rectWidth - 8)
            .attr("y1", yPos)
            .attr("y2", yPos);
        d3.select(this).select("text")
            .attr("x", rectX1+rectWidth + 10)
            .attr("y", yPos)
            .attr("text-anchor", "start")
            .text(formatY(d));
    });

    // bottom-y-ticks
    const bottomTickSelection = g.selectAll(".bottom-y-tick").data(bottomTicks).enter().append("g").attr("class", "bottom-y-tick");
    bottomTickSelection.append("line").attr("class", "tick-line");
    bottomTickSelection.append("text").attr("class", "tick-label");
    bottomTickSelection.each(function(d) {
        const yPos = yScaleBottom90(d);
        d3.select(this).select("line")
            .attr("x1", rectX2+rectWidth)
            .attr("x2", rectX2+rectWidth + 8)
            .attr("y1", yPos)
            .attr("y2", yPos);
        d3.select(this).select("text")
            .attr("x", rectX2+rectWidth + 10)
            .attr("y", yPos)
            .attr("text-anchor", "start")
            .text(formatY(d));
    });

    // x-ticks
    const candidateTicks = g.selectAll(".x-tick").data(allXTicks).enter().append("g").attr("class", "x-tick");
    candidateTicks.append("line").attr("class", "tick-line");
    candidateTicks.append("text").attr("class", "tick-label");

    candidateTicks.each(function(d) {
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
            .text(d);
    });

    // hide overlapping x-tick labels
    const textNodes = candidateTicks.select("text").nodes();
    let lastX = -Infinity;
    for (let i = 0; i < textNodes.length; i++) {
        const bbox = textNodes[i].getBBox();
        const thisX = parseFloat(textNodes[i].getAttribute("x"));
        const leftEdge = thisX - bbox.width/2;
        if (leftEdge < lastX) {
            d3.select(textNodes[i].parentNode).style("display","none");
        } else {
            lastX = thisX + bbox.width/2 + 2; 
        }
    }

    const allTop1 = refGroup.selectAll(".top1-ref-line").nodes();
    const allNext9 = refGroup.selectAll(".next9-ref-line").nodes();
    const allBottom90 = refGroup.selectAll(".bottom90-ref-line").nodes();

    refValues.forEach((val, i) => {
        const topY = yScaleTop1(val);
        const midY = yScaleNext9(val);
        const botY = yScaleBottom90(val);

        d3.select(allTop1[i])
            .attr("x1",0).attr("x2",rectX1)
            .attr("y1",topY).attr("y2",topY);

        d3.select(allNext9[i])
            .attr("x1",rectX1+rectWidth).attr("x2",rectX2)
            .attr("y1",midY).attr("y2",midY);

        d3.select(allBottom90[i])
            .attr("x1",rectX2+rectWidth).attr("x2",availableWidth)
            .attr("y1",botY).attr("y2",botY);

        const top1EndX = xScaleTop1(1);
        const next9StartX = rectX1+rectWidth;
        const next9StartY = yScaleNext9(wealthNext9.find(d => d.x===1).y);
        const next9EndX = xScaleNext9(10);
        const next9EndY = yScaleNext9(wealthNext9.find(d=>d.x===10).y);
        const bottom90StartX = rectX2+rectWidth;
        const bottom90StartY = yScaleBottom90(wealthBottom90.find(d=>d.x===10).y);

        refConnectorAreas1[i]
            .attr("points",
                `${top1EndX},${topY} 
                 ${top1EndX},${height} 
                 ${next9StartX},${height} 
                 ${next9StartX},${midY}`
            );
        refConnectorLines1[i]
            .attr("x1", top1EndX).attr("y1", topY)
            .attr("x2", next9StartX).attr("y2", next9StartY);

        refConnectorAreas2[i]
            .attr("points",
                `${next9EndX},${midY} 
                 ${next9EndX},${height} 
                 ${bottom90StartX},${height} 
                 ${bottom90StartX},${botY}`
            );
        refConnectorLines2[i]
            .attr("x1", next9EndX).attr("y1", midY)
            .attr("x2", bottom90StartX).attr("y2", botY);
    });

    setBrush1Selection();
}

const drag1 = d3.drag()
    .on("start", function () { d3.select(this).raise(); })
    .on("drag", function (event) {
        let newX = event.x - rectWidth / 2;
        newX = Math.max(0, Math.min(rectX2 - rectWidth - 50, newX));
        rectX1 = newX;
        updatePrisms();
    });

const drag2 = d3.drag()
    .on("start", function () { d3.select(this).raise(); })
    .on("drag", function (event) {
        let newX = event.x - rectWidth / 2;
        newX = Math.max(rectX1 + rectWidth + 50, Math.min(availableWidth - rectWidth, newX));
        rectX2 = newX;
        updatePrisms();
    });

function createPrism(x, y, dragBehavior) {
    const group = g.append("g").call(dragBehavior);
    group.append("polygon")
        .attr("class", "prism")
        .attr("points", 
            `${(x+rectWidth/2)},${y - apexOffsetTop} ` +
            `${x},${y} ` +
            `${x},${height} ` +
            `${x+rectWidth},${height} ` +
            `${x+rectWidth},${y}`
        );
    return group;
}

const prism1 = createPrism(rectX1, yForPrismTop, drag1);
const prism2 = createPrism(rectX2, yForPrismTop, drag2);

function updatePrisms() {
    prism1.select(".prism").attr("points",
        `${(rectX1+rectWidth/2)},${yForPrismTop - apexOffsetTop} ` +
        `${rectX1},${yForPrismTop} ` +
        `${rectX1},${height} ` +
        `${rectX1+rectWidth},${height} ` +
        `${rectX1+rectWidth},${yForPrismTop}`
    );

    prism2.select(".prism").attr("points",
        `${(rectX2+rectWidth/2)},${yForPrismTop - apexOffsetTop} ` +
        `${rectX2},${yForPrismTop} ` +
        `${rectX2},${height} ` +
        `${rectX2+rectWidth},${height} ` +
        `${rectX2+rectWidth},${yForPrismTop}`
    );

    updateCharts();
}

updateCharts(); // Initial rendering of Chart 1
