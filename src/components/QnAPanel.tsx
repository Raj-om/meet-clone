import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface Question {
    id: string;
    authorId: string;
    authorName: string;
    text: string;
    upvotes: number;
    upvotedBy: string[];
    isAnswered: boolean;
    timestamp: number;
}

export function QnAPanel({
    socket,
    userId,
    displayName,
    isHost
}: {
    socket: Socket | null;
    userId: string;
    displayName: string;
    isHost: boolean;
}) {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [newQuestion, setNewQuestion] = useState("");
    const [sortBy, setSortBy] = useState<'recent' | 'popular'>('popular');

    useEffect(() => {
        if (!socket) return;
        
        socket.on("qna-update", (q: Question[]) => {
            setQuestions(q);
        });

        // Request initial state
        socket.emit("get-qna");

        return () => {
            socket.off("qna-update");
        };
    }, [socket]);

    const submitQuestion = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newQuestion.trim() || !socket) return;
        socket.emit("qna-ask", {
            authorName: displayName,
            text: newQuestion.trim()
        });
        setNewQuestion("");
    };

    const toggleUpvote = (questionId: string) => {
        if (!socket) return;
        socket.emit("qna-upvote", { questionId });
    };

    const markAnswered = (questionId: string) => {
        if (!socket) return;
        socket.emit("qna-answered", { questionId });
    };

    const sortedQuestions = [...questions].sort((a, b) => {
        if (a.isAnswered && !b.isAnswered) return 1;
        if (!a.isAnswered && b.isAnswered) return -1;
        if (sortBy === 'popular') return b.upvotes - a.upvotes;
        return b.timestamp - a.timestamp;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#111827', color: 'white', borderRadius: '12px' }}>
            <div style={{ padding: '12px', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px' }}>Q&A</h3>
                <select 
                    value={sortBy} 
                    onChange={e => setSortBy(e.target.value as any)}
                    style={{ background: '#374151', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', fontSize: '12px', outline: 'none' }}
                >
                    <option value="popular">Popular</option>
                    <option value="recent">Recent</option>
                </select>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {questions.length === 0 && (
                    <div style={{ color: '#9ca3af', textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
                        No questions asked yet.
                    </div>
                )}
                {sortedQuestions.map(q => (
                    <div key={q.id} style={{ background: '#1f2937', padding: '10px', borderRadius: '8px', opacity: q.isAnswered ? 0.6 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#60a5fa' }}>{q.authorName}</span>
                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                {new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div style={{ fontSize: '14px', marginBottom: '8px' }}>{q.text}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button 
                                onClick={() => toggleUpvote(q.id)}
                                style={{ 
                                    background: q.upvotedBy.includes(userId) ? '#3b82f6' : '#374151',
                                    color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                👍 {q.upvotes}
                            </button>
                            {isHost && !q.isAnswered && (
                                <button 
                                    onClick={() => markAnswered(q.id)}
                                    style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}
                                >
                                    Mark Answered
                                </button>
                            )}
                            {q.isAnswered && (
                                <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 'bold' }}>✓ Answered</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={submitQuestion} style={{ padding: '12px', borderTop: '1px solid #374151', display: 'flex', gap: '8px' }}>
                <input 
                    type="text" 
                    value={newQuestion}
                    onChange={e => setNewQuestion(e.target.value)}
                    placeholder="Ask a question..."
                    style={{ flex: 1, background: '#374151', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 12px', outline: 'none' }}
                />
                <button type="submit" disabled={!newQuestion.trim()} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer', opacity: !newQuestion.trim() ? 0.5 : 1 }}>
                    Ask
                </button>
            </form>
        </div>
    );
}
