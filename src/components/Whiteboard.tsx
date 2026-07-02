"use client"

import { useEffect, useRef, useCallback } from "react"
import { Socket } from "socket.io-client"

interface DrawEvent {
    type: "draw" | "clear"
    x0?: number
    y0?: number
    x1?: number
    y1?: number
    color?: string
    size?: number
}

interface WhiteboardProps {
    socket: Socket | null
    roomId: string
    onClose: () => void
}

export default function Whiteboard({ socket, roomId, onClose }: WhiteboardProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isDrawing = useRef(false)
    const lastPos = useRef({ x: 0, y: 0 })
    const colorRef = useRef("#ffffff")
    const sizeRef = useRef(3)
    const toolRef = useRef<"pen" | "eraser">("pen")

    const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current!.getBoundingClientRect()
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
        const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
        return {
            x: (clientX - rect.left) / rect.width,
            y: (clientY - rect.top) / rect.height
        }
    }

    const drawLine = useCallback((ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, size: number) => {
        const w = ctx.canvas.width, h = ctx.canvas.height
        ctx.beginPath()
        ctx.moveTo(x0 * w, y0 * h)
        ctx.lineTo(x1 * w, y1 * h)
        ctx.strokeStyle = color
        ctx.lineWidth = size
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.stroke()
    }, [])

    useEffect(() => {
        if (!socket) return
        const onDraw = (ev: DrawEvent) => {
            const canvas = canvasRef.current
            if (!canvas) return
            const ctx = canvas.getContext("2d")!
            if (ev.type === "clear") {
                ctx.clearRect(0, 0, canvas.width, canvas.height)
            } else if (ev.type === "draw") {
                drawLine(ctx, ev.x0!, ev.y0!, ev.x1!, ev.y1!, ev.color!, ev.size!)
            }
        }
        socket.on("whiteboard-draw", onDraw)
        return () => { socket.off("whiteboard-draw", onDraw) }
    }, [socket, drawLine])

    const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        isDrawing.current = true
        lastPos.current = getPos(e)
    }

    const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current) return
        const pos = getPos(e)
        const ctx = canvasRef.current!.getContext("2d")!
        const color = toolRef.current === "eraser" ? "#202124" : colorRef.current
        const size = toolRef.current === "eraser" ? 20 : sizeRef.current
        drawLine(ctx, lastPos.current.x, lastPos.current.y, pos.x, pos.y, color, size)
        const ev: DrawEvent = { type: "draw", x0: lastPos.current.x, y0: lastPos.current.y, x1: pos.x, y1: pos.y, color, size }
        socket?.emit("whiteboard-draw", { roomId, ...ev })
        lastPos.current = pos
    }

    const onMouseUp = () => { isDrawing.current = false }

    const clearBoard = () => {
        const canvas = canvasRef.current!
        canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height)
        socket?.emit("whiteboard-draw", { roomId, type: "clear" })
    }

    const COLORS = ["#ffffff", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#000000"]

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", flexDirection: "column", background: "#202124" }}>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", background: "#292b2f", borderBottom: "1px solid #3c4043", flexWrap: "wrap" }}>
                <span style={{ color: "white", fontWeight: 600, fontSize: "14px" }}>🎨 Whiteboard</span>

                {/* Tool selector */}
                {(["pen", "eraser"] as const).map(tool => (
                    <button key={tool} onClick={() => { toolRef.current = tool }} style={{
                        padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px",
                        background: "transparent", border: "1px solid #5f6368", color: "#9ca3af"
                    }} onMouseEnter={e => { e.currentTarget.style.background = "#3c4043" }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent" }}>
                        {tool === "pen" ? "✏️ Pen" : "🧹 Eraser"}
                    </button>
                ))}

                {/* Color swatches */}
                <div style={{ display: "flex", gap: "4px" }}>
                    {COLORS.map(c => (
                        <button key={c} onClick={() => { colorRef.current = c; toolRef.current = "pen" }} style={{
                            width: "20px", height: "20px", borderRadius: "50%", background: c, border: "2px solid #5f6368",
                            cursor: "pointer", flexShrink: 0
                        }} />
                    ))}
                </div>

                {/* Brush size */}
                <input type="range" min="1" max="20" defaultValue="3"
                    onChange={e => { sizeRef.current = Number(e.target.value) }}
                    style={{ width: "80px", accentColor: "#1a73e8" }} />

                <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                    <button onClick={clearBoard} style={{
                        background: "#3c4043", border: "none", color: "white", borderRadius: "6px",
                        padding: "6px 12px", cursor: "pointer", fontSize: "12px"
                    }}>🗑️ Clear</button>
                    <button onClick={onClose} style={{
                        background: "#ef4444", border: "none", color: "white", borderRadius: "6px",
                        padding: "6px 12px", cursor: "pointer", fontSize: "12px"
                    }}>✕ Close</button>
                </div>
            </div>

            {/* Canvas */}
            <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                style={{ flex: 1, cursor: "crosshair", width: "100%", height: "100%", objectFit: "contain", background: "#1a1a2e" }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
            />
        </div>
    )
}
