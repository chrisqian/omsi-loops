// @ts-check
"use strict";

class StatGraph {
    /** @typedef {ReturnType<StatGraph["getGraphDatasets"]>[number]} Dataset */
    /**
     * @typedef {{
     *     type: string,
     *     options: any,
     *     data: {
     *         datasets: Dataset[],
     *     },
     * }} GraphObject
     */

    radius = 150;
    initalized = false;

    /** @type {d3.ScaleBand<StatName>} */
    statScale;

    /** @type {GraphObject} */
    graphObject = null;
    /** @type {d3.Selection<SVGSVGElement, Record<StatName, Stat>, HTMLElement, any>} */
    svg;
    /** @type {d3.Selection<HTMLElement, Record<StatName, Stat>>} */
    statsContainer;

    /** @param {StatName} stat */
    getAxisTip(stat) {
        return d3.pointRadial(this.statScale(stat), this.radius + 10);
    }

    /** @param {HTMLElement} statsContainer */
    init(statsContainer) {
        if (this.initalized) return;
        const orderedStats = statList.map(s => stats[s]);
        const datasets = this.getGraphDatasets();
        this.statsContainer = d3.select(statsContainer).datum(stats);
        this.svg = /** @type {d3.Selection<SVGSVGElement>} */(d3.select("svg#statChart")).datum(stats);
        for (const layer of ["axes", "legend", "scaleLines", "data"]) {
            this.svg.append("g")
                    .classed(`layer ${layer}`, true);
        }

        const tScale = this.statScale = d3.scaleBand(statList, [0, Math.PI * 2]);

        const axes = /** @type {d3.Selection<SVGGElement, Stat>} */(this.svg.selectChild("g.layer.axes")
            .selectAll("g.axis")
            .data(orderedStats, s => s.name)
            .join(enter => enter
                .append("g")
                .classed("axis", true)
                .call(enter => enter.append("path"))
                .call(enter => enter
                    .append("g")
                    .classed("label", true)
                    .append("text")))
            .call(axis => axis
                .selectChild("path")
                .attr("d", stat => d3.lineRadial()([[tScale(stat.name), 0],[tScale(stat.name), this.radius]])))
            .call(axis => axis
                .selectChild("g.label")
                .attr("transform", stat => `translate(${d3.pointRadial(tScale(stat.name), this.radius + 10).join()})`)
                .selectChild("text")
                .text(stat => stat.short_form)));
        
        const legend = this.svg.selectChild("g.legend")
            .attr("transform", `translate(0, ${-this.radius - 20})`)
            .selectChildren("g.dataset")
            .data(datasets)
            .join(enter => enter
                .append("g")
                .classed("dataset", true)
                .call(enter => enter.append("text"))
                .call(enter => enter.append("rect")))
            .attr("data-dataset", d => d.name)
            .call(set => set
                .selectChild("text")
                .attr("y", -10)
                .text(d => d.label))
            .call(set => set
                .selectChild("rect")
                .attr("x", -30)
                .attr("y", -15)
                .attr("width", 25)
                .attr("height", 10))
            .attr("transform", /** @this {SVGGElement} */function() {
                const bbox = this.getBBox();
                console.log(this, bbox);
                return `translate(-${(bbox.width + bbox.x * 2) / 2}, 0)`;
            });


        this.graphObject = {
            type: "radar",
            options: {
                plugins: {
                    tooltip: {
                        callbacks: {
                            label(context) {
                                // format raw value as a reasonable percentage
                                let formattedValue = context.raw;
                                if (formattedValue > 99.99999999) formattedValue = formattedValue.toPrecision(12);
                                else if (formattedValue > 99.999999) formattedValue = formattedValue.toPrecision(10);
                                else if (formattedValue > 99.9999) formattedValue = formattedValue.toPrecision(8);
                                else if (formattedValue > 99.99) formattedValue = formattedValue.toPrecision(6);
                                else if (formattedValue === 0) formattedValue = 0;
                                else formattedValue = formattedValue.toPrecision(4);
                                return `${context.dataset.label}: ${formattedValue}%`;
                            }
                        }
                    }
                },
                elements: {
                    line: {
                        tension: 0,
                        borderWidth: 4
                    },
                    point: {
                        radius: 5,
                        hoverRadius: 6,
                        hitRadius: 1
                    }
                },
                scales: {
                    r: {
                        suggestedMin: 0,
                        suggestedMax: 20,
                        ticks: {
                            showLabelBackdrop: false,
                            maxTicksLimit: 6,
                            stepSize: 10,
                            precision: 0,
                            z: 1
                        },
                    },
                },
            },
            data: {
                datasets,
            }
        };
        this.initalized = true;
        this.update();
    }

    /** @param {Stat} stat  */
    static getManaCostReduction(stat) {
        return (1 - stat.manaMultiplier) * 100;
    }

    /** @param {Dataset} dataset  */
    autoscaleRange(dataset) {
        const dataMax = d3.max(Object.values(stats).map(dataset.data));
        const scaleMax = Math.max(Math.ceil(dataMax / 10) * 12.5 , 22.5);
        const ticks = d3.ticks(.01, scaleMax, 3);
        return [0, Math.max(scaleMax, ticks[ticks.length - 1] * 1.25)];
    }

    getGraphDatasets() {
        const datasets = [
            {
                name: "mana_cost_reduction",
                label: _txt("stats>tooltip>mana_cost_reduction"),
                data: StatGraph.getManaCostReduction,
                enabled: true,
            }
        ];
        return datasets;
    }

    update(skipAnimation) {
        if (!this.initalized) return;

        const tScale = this.statScale;
        const {data: {datasets}} = this.graphObject;

        const autoscale = this.autoscaleRange(datasets[0]);

        const rScale = d3.scaleLinear()
                        .domain(autoscale)
                        .range([0, this.radius]);

        const pointScale = ([name, value]) => d3.pointRadial(tScale(name), rScale(value))
        const line = /** @type {() => d3.LineRadial<StatName>} */(d3.lineRadial)().angle(tScale);
        const ticks = d3.ticks(1, autoscale[1], 3);

        const closedStatNames = [...statList, statList[0]];
        const closedStats = closedStatNames.map(name => stats[name]);
        const transition = d3.transition()
            .duration(skipAnimation ? 0 : 250)
            .ease(d3.easeSinIn);
        
        this.svg.selectChild("g.layer.scaleLines")
            .selectAll("g.scaleLine")
            .data(ticks, t => t)
            .join(enter => enter
                .append("g")
                .classed("scaleLine", true)
                .call(enter => enter.append("path"))
                .call(enter => enter.append("text")))
            .transition(transition)
            .call(lines => lines
                .selectChild("path")
                .attr("d", d=>line.radius(_ => rScale(d))(closedStatNames)))
            .call(lines => lines
                .selectChild("text")
                .attr("x", 0)
                .attr("y", d=>-rScale(d) - 2)
                .text(d=>d));

        this.svg.selectChild("g.layer.data")
            .selectAll("g.dataset")
            .data(datasets, d => d.label)
            .join(enter => enter
                .append("g")
                .classed("dataset", true)
                .call(enter => enter.append("polygon")))
            .attr("data-dataset", set => set.name)
            .call(sets => sets
                .selectChild("polygon")
                .transition(transition)
                .attr("points", set => closedStats.map(stat => pointScale([stat.name, set.data(stat)]).join()).join(" ")))
            .call(sets => sets
                .selectChildren("g.datapoint")
                .data(set => Object.values(stats).map(stat => /** @type {[Dataset, Stat]} */([set, stat])), ([_, stat]) => stat.name)
                .join(enter => enter
                    .append("g")
                    .classed("datapoint", true)
                    .call(enter => enter.append("circle")))
                .transition(transition)
                .attr("transform", ([set, stat]) => `translate(${pointScale([stat.name, set.data(stat)]).join()})`)
                .selectChild("circle")
                .attr("r", this.graphObject.options.elements.point.radius));
            
        view.updateStatGraphNeeded = false;
    }
};

const statGraph = new StatGraph();

let radarModifier;