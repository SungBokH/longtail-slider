/* const scaleFactor = 0.56;
const originalWidth = 600, originalHeight = 400;

let height = (originalHeight * scaleFactor) - 40; 
const width = originalWidth * scaleFactor; 

const margin = { top: 20, right: 50*scaleFactor, bottom: 40*scaleFactor, left: 80*scaleFactor };
const blankSpace = 20 * scaleFactor;
const brushOffset = 10; 
const brushHeight = 20 * scaleFactor; 
const totalHeight = height + brushHeight + brushOffset + margin.top + margin.bottom;

const availableWidth = width - blankSpace;
const rectWidth = 40 * scaleFactor; 
const apexOffsetTop = 20 * scaleFactor; 
const yForPrismTop = apexOffsetTop; */

let chart2DomainSelection = [100000,1000000]; // Initially highlight [100K,1M]

let rectX1_3 = availableWidth * 0.2;  
let rectX2_3 = availableWidth * 0.6;  

const svg3 = d3.select("#chart2")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", totalHeight);

const g3 = svg3.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

const maxSalary = 70000000; 
const randomNormal = d3.randomNormal(9,1.2); 
const N = 10000; 
let salaries = d3.range(N).map(() => Math.exp(randomNormal()));
const maxVal = d3.max(salaries);
const scaleFactorSalary = maxSalary / maxVal;
salaries = salaries.map(d => d * scaleFactorSalary);

function chartXPos3(value) {
    if (value < 100000) {
        return d3.scaleLinear().domain([0,100000]).range([0, rectX1_3])(value);
    } else if (value === 100000) {
        return rectX1_3 + rectWidth;
    } else if (value > 100000 && value < 1000000) {
        return d3.scaleLinear().domain([100000,1000000]).range([rectX1_3+rectWidth, rectX2_3])(value);
    } else if (value === 1000000) {
        return rectX2_3 + rectWidth;
    } else {
        return d3.scaleLinear().domain([1000000, maxSalary]).range([rectX2_3+rectWidth, availableWidth])(value);
    }
}

function invertChartXPos3(px) {
    if (px <= rectX1_3) {
        const scale = d3.scaleLinear().domain([0,rectX1_3]).range([0,100000]);
        return scale(px);
    } else if (px <= rectX1_3+rectWidth) {
        return 100000;
    } else if (px <= rectX2_3) {
        const scale = d3.scaleLinear().domain([rectX1_3+rectWidth, rectX2_3]).range([100000,1000000]);
        return scale(px);
    } else if (px <= rectX2_3+rectWidth) {
        return 1000000;
    } else {
        const scale = d3.scaleLinear().domain([rectX2_3+rectWidth, availableWidth]).range([1000000,70000000]);
        return scale(px);
    }
}

function makeBins(data) {
    let binSize1 = 5000;
    let binSize2 = 50000;
    let binSize3 = 3450000; 

    function binRange(start, end, size) {
        let arr = [];
        for (let v = start; v < end; v += size) {
            arr.push({x0: v, x1: v+size, values: []});
        }
        return arr;
    }

    let bins1 = binRange(0,100000,binSize1);
    let bins2 = binRange(100000,1000000,binSize2);
    let bins3 = binRange(1000000,maxSalary,binSize3);
    const allBins = bins1.concat(bins2).concat(bins3);

    data = data.slice().sort((a,b)=>a-b);
    for (let salary of data) {
        for (let b of allBins) {
            if (salary>=b.x0 && salary<b.x1) {
                b.values.push(salary);
                break;
            }
        }
    }

    return allBins.filter(b=>b.values.length>0);
}

const bins = makeBins(salaries);

const seg1Bins = bins.filter(b => b.x0<100000);
const seg2Bins = bins.filter(b => b.x0>=100000 && b.x0<1000000);
const seg3Bins = bins.filter(b => b.x0>=1000000);

const s1Max = seg1Bins.length>0 ? d3.max(seg1Bins,d=>d.values.length):0;
const s2Max = seg2Bins.length>0 ? d3.max(seg2Bins,d=>d.values.length):0;
const s3Max = seg3Bins.length>0 ? d3.max(seg3Bins,d=>d.values.length):0;

const yScaleS1 = d3.scaleLinear().domain([0,s1Max]).range([height,yForPrismTop]);
const yScaleS2 = d3.scaleLinear().domain([0,s2Max]).range([height,yForPrismTop]);
const yScaleS3 = d3.scaleLinear().domain([0,s3Max]).range([height,yForPrismTop]);

let barGroup3 = g3.append("g");

function getYScaleForBin(b) {
    if (b.x0<100000) return yScaleS1;
    else if (b.x0<1000000) return yScaleS2;
    else return yScaleS3;
}

g3.append("line")
    .attr("class", "x-axis-line3")
    .attr("x1",0)
    .attr("x2",availableWidth)
    .attr("y1",height)
    .attr("y2",height)
    .attr("stroke","black");

const brush3 = d3.brushX()
    .extent([[0, height+brushOffset],[availableWidth, height+brushOffset+brushHeight]])
    .on("brush end", brushedChart2);

const gBrush3 = g3.append("g")
    .attr("class","brush2")
    .call(brush3);

function setBrush3Selection() {
    const left = chartXPos3(chart2DomainSelection[0]);
    const right = chartXPos3(chart2DomainSelection[1]);
    gBrush3.call(brush3.move, [left,right]);
}

function brushedChart2(event) {
    const s = event.selection;
    if (!s) {
        barGroup3.selectAll(".bar").classed("highlighted",false);
        return;
    }
    const [pxLeft, pxRight] = s;
    const domainLeft = invertChartXPos3(pxLeft);
    const domainRight = invertChartXPos3(pxRight);

    barGroup3.selectAll(".bar")
        .classed("highlighted", d => d.x0 >= domainLeft && d.x1 <= domainRight);

    if (event.type === "end") {
        chart2DomainSelection = [domainLeft, domainRight];
    }
}

function updateCharts2() {
    barGroup3.selectAll(".bar").remove();

    barGroup3.selectAll(".bar")
        .data(bins)
        .enter().append("rect")
        .attr("class","bar")
        .attr("x", d => {
            let x0Pos = chartXPos3(d.x0);
            let x1Pos = chartXPos3(d.x1);
            return Math.min(x0Pos,x1Pos);
        })
        .attr("y", d=> {
            const scale = getYScaleForBin(d);
            return scale(d.values.length);
        })
        .attr("width", d => {
            let x0Pos = chartXPos3(d.x0);
            let x1Pos = chartXPos3(d.x1);
            return Math.abs(x1Pos - x0Pos)-1; 
        })
        .attr("height", d => {
            const scale = getYScaleForBin(d);
            return height - scale(d.values.length);
        });

    g3.selectAll(".y-tick3,.x-tick3,.seg-scale-axis").remove();

    const xValuesForTicks = [0,100000,1000000,70000000];
    const xTickSelection = g3.selectAll(".x-tick3").data(xValuesForTicks).enter().append("g").attr("class","x-tick3");
    xTickSelection.append("line").attr("class","tick-line");
    xTickSelection.append("text").attr("class","tick-label");
    xTickSelection.each(function(d) {
        const xPos = chartXPos3(d);
        d3.select(this).select("line")
            .attr("x1", xPos)
            .attr("x2", xPos)
            .attr("y1", height)
            .attr("y2", height - 8);
        d3.select(this).select("text")
            .attr("x", xPos)
            .attr("y", height + 14)
            .attr("text-anchor","middle")
            .text(d<1000000 ? (d>=100000 ? d/1000+"K" : d) : (d/1000000+"M"));
    });

    function drawSegmentAxis(xPos, scale) {
        const axisGroup = g3.append("g").attr("class","seg-scale-axis");
        const ticks = scale.ticks(5);
        axisGroup.selectAll(".seg-y-tick").data(ticks).enter().append("g")
            .attr("class","seg-y-tick")
            .each(function(d) {
                const yPos = scale(d);
                d3.select(this).append("line")
                    .attr("class","tick-line")
                    .attr("x1", xPos)
                    .attr("x2", xPos - 8)
                    .attr("y1", yPos)
                    .attr("y2", yPos);
                d3.select(this).append("text")
                    .attr("class","tick-label")
                    .attr("x", xPos - 10)
                    .attr("y", yPos)
                    .attr("text-anchor","end")
                    .text(d);
            });

        axisGroup.append("line")
            .attr("class","tick-line")
            .attr("x1", xPos)
            .attr("x2", xPos)
            .attr("y1", height)
            .attr("y2", yForPrismTop)
            .attr("stroke","black");
    }

    if (s1Max > 0) drawSegmentAxis(0, yScaleS1);
    if (s2Max > 0) drawSegmentAxis(rectX1_3+rectWidth, yScaleS2);
    if (s3Max > 0) drawSegmentAxis(rectX2_3+rectWidth, yScaleS3);

    setBrush3Selection();
}

const drag1_3 = d3.drag()
    .on("start", function () { d3.select(this).raise(); })
    .on("drag", function (event) {
        let newX = event.x - rectWidth / 2;
        newX = Math.max(0, Math.min(rectX2_3 - rectWidth - 50, newX));
        rectX1_3 = newX;
        updatePrisms3();
    });

const drag2_3 = d3.drag()
    .on("start", function () { d3.select(this).raise(); })
    .on("drag", function (event) {
        let newX = event.x - rectWidth / 2;
        newX = Math.max(rectX1_3 + rectWidth + 50, Math.min(availableWidth - rectWidth, newX));
        rectX2_3 = newX;
        updatePrisms3();
    });

function createPrism3(x, y, dragBehavior) {
    const group = g3.append("g").call(dragBehavior);
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

const prism1_3 = createPrism3(rectX1_3, yForPrismTop, drag1_3);
const prism2_3 = createPrism3(rectX2_3, yForPrismTop, drag2_3);

function updatePrisms3() {
    prism1_3.select(".prism").attr("points",
        `${(rectX1_3+rectWidth/2)},${yForPrismTop - apexOffsetTop} ` +
        `${rectX1_3},${yForPrismTop} ` +
        `${rectX1_3},${height} ` +
        `${rectX1_3+rectWidth},${height} ` +
        `${rectX1_3+rectWidth},${yForPrismTop}`
    );

    prism2_3.select(".prism").attr("points",
        `${(rectX2_3+rectWidth/2)},${yForPrismTop - apexOffsetTop} ` +
        `${rectX2_3},${yForPrismTop} ` +
        `${rectX2_3},${height} ` +
        `${rectX2_3+rectWidth},${height} ` +
        `${rectX2_3+rectWidth},${yForPrismTop}`
    );

    updateCharts2();
}

updateCharts2(); // Initial rendering of Chart 2
