"use client"

import React, { useState } from "react"

export interface HostParticipant {
    userId: string
    displayName: string
    isMuted: boolean
    isVideoOff: boolean
    handRaised: boolean
    isHost: boolean
    // ML metrics (simulated/passed down)
    engagementScore?: number
    plagiarismRisk?: number
    confidenceScore?: number
}

interface Props {
    participants: HostParticipant[]
    currentUserId: string
    roomMode: 'office' | 'classroom' | 'interview' | 'exam' | null
    onMuteAll: () => void
    onMuteUser: (uid: string) => void
    onKickUser: (uid: string) => void
    onBlockIp: (uid: string) => void // New action for blocking IP
}

export default function GlobalHostDashboard({ participants, currentUserId, roomMode, onMuteAll, onMuteUser, onKickUser, onBlockIp }: Props) {
    const [search, setSearch] = useState("")

    const filtered = participants.filter(p => p.displayName.toLowerCase().includes(search.toLowerCase()))

    const getScoreDisplay = (p: HostParticipant) => {
        if (roomMode === 'exam') {
            const risk = p.plagiarismRisk ?? Math.floor(Math.random() * 20) // Simulated if not provided
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '60px', height: '6px', background: '#374151', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${risk}%`, height: '100%', background: risk > 50 ? '#ef4444' : risk > 20 ? '#f59e0b' : '#10b981' }} />
                    </div>
                    <span style={{ fontSize: '11px', color: risk > 50 ? '#ef4444' : '#9ca3af' }}>{risk}% Risk</span>
                </div>
            )
        }
        if (roomMode === 'classroom') {
            const eng = p.engagementScore ?? Math.floor(Math.random() * 40 + 60)
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '60px', height: '6px', background: '#374151', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${eng}%`, height: '100%', background: eng < 40 ? '#ef4444' : eng < 70 ? '#f59e0b' : '#3b82f6' }} />
                    </div>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{eng}% Engaged</span>
                </div>
            )
        }
        if (roomMode === 'interview') {
            const conf = p.confidenceScore ?? Math.floor(Math.random() * 30 + 70)
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '60px', height: '6px', background: '#374151', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${conf}%`, height: '100%', background: '#8b5cf6' }} />
                    </div>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{conf}% Confident</span>
                </div>
            )
        }
        return <span style={{ fontSize: '11px', color: '#6b7280' }}>N/A</span>
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(12px)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>👑</span> God Mode: {participants.length} Users
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                        type="text" 
                        placeholder="Search users..." 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '6px 12px', color: 'white', fontSize: '13px', outline: 'none' }}
                    />
                    <button onClick={onMuteAll} style={{ background: '#374151', border: 'none', color: 'white', borderRadius: '6px', padding: '0 12px', fontSize: '12px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#4b5563'} onMouseLeave={e => e.currentTarget.style.background = '#374151'}>
                        Mute All
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr>
                            <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', fontSize: '11px', fontWeight: 500 }}>USER</th>
                            <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', fontSize: '11px', fontWeight: 500 }}>METRIC</th>
                            <th style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', fontSize: '11px', fontWeight: 500, textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(p => (
                            <tr key={p.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <td style={{ padding: '10px 8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: p.isHost ? '#7c3aed' : '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'white', fontWeight: 'bold' }}>
                                            {p.displayName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ color: 'white', fontSize: '13px', fontWeight: 500 }}>
                                                {p.displayName} {p.userId === currentUserId && "(You)"}
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                                                <span style={{ fontSize: '10px', color: p.isMuted ? '#ef4444' : '#10b981' }}>{p.isMuted ? '🔇 Muted' : '🎙️ On'}</span>
                                                <span style={{ fontSize: '10px', color: p.isVideoOff ? '#ef4444' : '#10b981' }}>{p.isVideoOff ? '🚫 No Cam' : '📹 Cam'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '10px 8px' }}>
                                    {p.isHost ? <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 'bold' }}>HOST</span> : getScoreDisplay(p)}
                                </td>
                                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                                    {!p.isHost && (
                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                            <button onClick={() => onMuteUser(p.userId)} title="Mute User" style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                                                🔇
                                            </button>
                                            <button onClick={() => onKickUser(p.userId)} title="Kick User" style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', border: 'none', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)'}>
                                                👢
                                            </button>
                                            <button onClick={() => { if(confirm(`Completely block IP for ${p.displayName}? They will not be able to rejoin.`)) onBlockIp(p.userId) }} title="Block IP & Ban" style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}>
                                                🔨
                                            </button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
