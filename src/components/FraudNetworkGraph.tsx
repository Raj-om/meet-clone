"use client"

import React, { useEffect, useRef, useCallback } from "react"
import * as d3 from "d3"

export interface GraphNode {
    id: string
    riskScore: number
    alerts: number
}

export interface GraphEdge {
    id: string
    source: string
    target: string
    weight: number
    alerted: boolean
}

export interface FraudGraph {
    nodes: GraphNode[]
    edges: GraphEdge[]
}

interface Props {
    graph: FraudGraph
    onExport?: () => void
}

function nodeColor(score: number): string {
    if (score >= 70) return "#ef4444"
    if (score >= 40) return "#f59e0b"
    return "#22c55e"
}

function nodeRadius(score: number, alerts: number): number {
    return 16 + Math.min(24, score * 0.25 + alerts * 3)
}

export default function FraudNetworkGraph({ graph, onExport }: Props) {
    const svgRef = useRef<SVGSVGElement>(null)
    const exportRef = useRef<SVGSVGElement>(null)

    const render = useCallback(() => {
        if (!svgRef.current) return
        const svgEl = svgRef.current
        const W = svgEl.clientWidth || 290
        const H = svgEl.clientHeight || 340

        // Rebuild D3 selection each render
        const svg = d3.select(svgEl)
        svg.selectAll("*").remove()

        if (graph.nodes.length === 0) {
            svg.append("text")
                .attr("x", W / 2).attr("y", H / 2)
                .attr("text-anchor", "middle")
                .attr("fill", "#6b7280").attr("font-size", 13)
                .text("No participants yet")
            return
        }

        // Defs: glow filter for alerted edges
        const defs = svg.append("defs")
        const glow = defs.append("filter").attr("id", "glow")
        glow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur")
        const feMerge = glow.append("feMerge")
        feMerge.append("feMergeNode").attr("in", "coloredBlur")
        feMerge.append("feMergeNode").attr("in", "SourceGraphic")

        // Maps for D3 - transform edge source/target to node references
        const nodeMap = new Map(graph.nodes.map(n => [n.id, { ...n, x: W / 2, y: H / 2, vx: 0, vy: 0 }]))
        const nodes = [...nodeMap.values()] as (GraphNode & d3.SimulationNodeDatum)[]
        const links = graph.edges
            .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
            .map(e => ({
                ...e,
                source: e.source,
                target: e.target,
            })) as (GraphEdge & d3.SimulationLinkDatum<GraphNode & d3.SimulationNodeDatum>)[]

        const simulation = d3.forceSimulation<GraphNode & d3.SimulationNodeDatum>(nodes)
            .force("link", d3.forceLink<GraphNode & d3.SimulationNodeDatum, GraphEdge & d3.SimulationLinkDatum<GraphNode & d3.SimulationNodeDatum>>(links)
                .id((d) => d.id)
                .distance(100))
            .force("charge", d3.forceManyBody().strength(-180))
            .force("center", d3.forceCenter(W / 2, H / 2))
            .force("collision", d3.forceCollide<GraphNode & d3.SimulationNodeDatum>().radius(d => nodeRadius(d.riskScore, d.alerts) + 8))

        // Edge lines
        const edgeGroup = svg.append("g")
        const edgeLines = edgeGroup.selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke", d => d.alerted ? "#ef4444" : "#374151")
            .attr("stroke-width", d => 1 + Math.min(4, d.weight * 0.5))
            .attr("stroke-opacity", 0.7)
            .attr("filter", d => d.alerted ? "url(#glow)" : "none")

        // Node group
        const nodeGroup = svg.append("g")
        const nodeGs = nodeGroup.selectAll("g")
            .data(nodes)
            .join("g")
            .style("cursor", "pointer")

        // Node circle
        nodeGs.append("circle")
            .attr("r", d => nodeRadius(d.riskScore, d.alerts))
            .attr("fill", d => nodeColor(d.riskScore) + "22")
            .attr("stroke", d => nodeColor(d.riskScore))
            .attr("stroke-width", 2.5)

        // Node label (short ID)
        nodeGs.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("fill", "white")
            .attr("font-size", 11)
            .attr("font-weight", "600")
            .attr("font-family", "Inter, sans-serif")
            .text(d => d.id.substring(0, 4))

        // Risk score tooltip ring
        nodeGs.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", d => nodeRadius(d.riskScore, d.alerts) + 12)
            .attr("fill", d => nodeColor(d.riskScore))
            .attr("font-size", 10)
            .attr("font-family", "Inter, sans-serif")
            .text(d => `${d.riskScore}`)

        // Alert badge
        nodeGs.filter(d => d.alerts > 0)
            .append("text")
            .attr("dx", d => nodeRadius(d.riskScore, d.alerts) - 6)
            .attr("dy", d => -nodeRadius(d.riskScore, d.alerts) + 6)
            .attr("text-anchor", "middle")
            .attr("fill", "#fca5a5")
            .attr("font-size", 14)
            .text("⚠️")

        // Tick
        simulation.on("tick", () => {
            edgeLines
                .attr("x1", d => (d.source as any).x)
                .attr("y1", d => (d.source as any).y)
                .attr("x2", d => (d.target as any).x)
                .attr("y2", d => (d.target as any).y)

            nodeGs.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`)
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const drag: any = d3.drag()
            .on("start", (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
            .on("drag", (event: any, d: any) => { d.fx = event.x; d.fy = event.y })
            .on("end", (event: any, d: any) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null })

        nodeGs.call(drag)

        // Return cleanup fn
        simulation.on("end", null)
    }, [graph])

    useEffect(() => {
        const cleanup = render()
        return cleanup
    }, [render])

    const handleExport = useCallback(() => {
        if (!svgRef.current) return
        const svgData = new XMLSerializer().serializeToString(svgRef.current)
        const canvas = document.createElement("canvas")
        canvas.width = svgRef.current.clientWidth || 290
        canvas.height = svgRef.current.clientHeight || 340
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        const img = new Image()
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        img.onload = () => {
            ctx.fillStyle = "#1a1d21"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0)
            URL.revokeObjectURL(url)
            canvas.toBlob(b => {
                if (!b) return
                const a = document.createElement("a")
                a.href = URL.createObjectURL(b)
                a.download = "fraud-threat-map.png"
                a.click()
            })
        }
        img.src = url
        onExport?.()
    }, [onExport])

    return (
        <div style={{
            background: "linear-gradient(145deg, #1a1d21, #16181c)",
            border: "1px solid #ffffff10", borderRadius: "16px",
            padding: "14px", display: "flex", flexDirection: "column", gap: "10px",
            fontFamily: "Inter, system-ui, sans-serif", height: "100%",
        }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <span style={{ fontSize: "16px" }}>🕸️</span>
                    <span style={{ color: "white", fontWeight: "700", fontSize: "13px" }}>Threat Map</span>
                    <span style={{
                        fontSize: "10px", background: "#3b82f620", border: "1px solid #3b82f630",
                        color: "#93c5fd", padding: "2px 6px", borderRadius: "99px", fontWeight: 600
                    }}>LIVE</span>
                </div>
                <button
                    onClick={handleExport}
                    style={{
                        background: "#3c4043", border: "1px solid #ffffff20",
                        color: "#d1d5db", padding: "4px 10px", borderRadius: "6px",
                        fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px"
                    }}
                >
                    📥 Export PNG
                </button>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {[["#22c55e", "Safe"], ["#f59e0b", "Suspicious"], ["#ef4444", "High Risk"]].map(([c, l]) => (
                    <div key={l} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>{l}</span>
                    </div>
                ))}
            </div>

            {/* D3 Graph */}
            <svg
                ref={svgRef}
                style={{ flex: 1, minHeight: "260px", background: "#0f1012", borderRadius: "10px" }}
                width="100%"
                height="100%"
            />

            {/* Node count */}
            <div style={{ fontSize: "11px", color: "#6b7280", textAlign: "center" }}>
                {graph.nodes.length} participant{graph.nodes.length !== 1 ? "s" : ""} · {graph.edges.length} connection{graph.edges.length !== 1 ? "s" : ""}
            </div>

            <svg ref={exportRef} style={{ display: "none" }} />
        </div>
    )
}
