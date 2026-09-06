import sys

with open('src/app/meet/[id]/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """                                                    history: [],
                        </CtrlBtn>"""

fix = """                                                    history: [],
                                                    breakdown: { gazeScore: 0, faceScore: 0, calmScore: 0, behaviorScore: 0 },
                                                },
                                            }))
                                    ]}
                                />
                            </ErrorBoundary>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Control Bar ── */}
            <div className="control-bar" style={{ height: "80px", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", flexShrink: 0 }}>
                {/* Left: scan input */}
                <div className="control-left" style={{ flex: 1 }}>
                    <input type="text" placeholder="Scan link (e.g. bit.ly/refund)" value={mockChatInput}
                        onChange={e => setMockChatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && mockChatInput.trim()) { linkScanner.scanMessage(mockChatInput); setMockChatInput("") } }}
                        style={{ background: "#202124", color: "white", border: "1px solid #5f6368", borderRadius: "20px", padding: "7px 14px", fontSize: "13px", width: "220px", outline: "none" }}
                    />
                </div>

                {/* Center: main controls */}
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", flex: 1 }}>
                    {/* Primary Controls */}
                    <CtrlBtn onClick={toggleAudio} active={isMuted} title="Mute (M)">
                        {isMuted
                            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                        }
                    </CtrlBtn>
                    <CtrlBtn onClick={toggleVideo} active={isVideoOff} title="Camera (V)">
                        {isVideoOff
                            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                        }
                    </CtrlBtn>
                    {isHost && (
                        <CtrlBtn onClick={isScreenSharing ? stopScreenShare : startScreenShare} active={isScreenSharing} title="Screen Share (S)" activeColor="#22c55e">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                        </CtrlBtn>"""

if target not in content:
    target = target.replace('\\n', '\\r\\n')

if target in content:
    new_content = content.replace(target, fix)
    with open('src/app/meet/[id]/page.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Fixed successfully!")
else:
    print("Could not find the target string!")
