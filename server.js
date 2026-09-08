import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// ── Behavioral tracking ─────────────────────────────────────────────────────
const joinTimestamps = {};
const disconnectCounts = {};

// ── Fraud graph state ───────────────────────────────────────────────────────
const fraudGraphs = {};

// ── Participants ────────────────────────────────────────────────────────────
// roomParticipants[roomId] = Map<userId, { socketId, displayName, isMuted, isVideoOff, handRaised, isHost }>
const roomParticipants = {};

// ── Exam session state ──────────────────────────────────────────────────────
// examSessions[roomId] = { active, endTimestamp, mode, hostUserId }
const examSessions = {};

// ── Q&A State ───────────────────────────────────────────────────────────────
const qnaSessions = {};

// ── Server-authoritative host registry ──────────────────────────────────────
// roomHosts[roomId] = userId  — ONLY set when user joins; never overridden by client
const roomHosts = {};
// roomModes[roomId] = 'office' | 'classroom' | 'interview' | 'exam'
const roomModes = {};

// ── Rate limiting ────────────────────────────────────────────────────────────
// rateLimits[socketId][event] = [timestamps...]
const rateLimits = {};

const RATE_LIMITS = {
    'scam-alert':        { windowMs: 5000,  maxCalls: 3  },
    'kick-user':         { windowMs: 3000,  maxCalls: 1  },
    'mute-user':         { windowMs: 2000,  maxCalls: 2  },
    'mute-all':          { windowMs: 5000,  maxCalls: 2  },
    'lock-room':         { windowMs: 3000,  maxCalls: 2  },
    'exam-start':        { windowMs: 10000, maxCalls: 1  },
    'exam-end':          { windowMs: 5000,  maxCalls: 1  },
    'create-poll':       { windowMs: 5000,  maxCalls: 3  },
    'create-breakout':   { windowMs: 10000, maxCalls: 2  },
    'candidate-score-update': { windowMs: 1000, maxCalls: 5 },
};

/**
 * Returns true if the event is rate-limited (caller should drop the event).
 */
function isRateLimited(socketId, event) {
    const limit = RATE_LIMITS[event];
    if (!limit) return false;
    if (!rateLimits[socketId]) rateLimits[socketId] = {};
    if (!rateLimits[socketId][event]) rateLimits[socketId][event] = [];
    const now = Date.now();
    // Remove timestamps outside the window
    rateLimits[socketId][event] = rateLimits[socketId][event].filter(t => now - t < limit.windowMs);
    if (rateLimits[socketId][event].length >= limit.maxCalls) {
        return true; // Blocked
    }
    rateLimits[socketId][event].push(now);
    return false;
}

/**
 * Returns true if the socket's userId is the verified host of the room.
 */
function isVerifiedHost(roomId, userId) {
    return roomHosts[roomId] === userId;
}

function broadcastParticipants(io, roomId) {
    const map = roomParticipants[roomId];
    if (!map) return;
    const list = [...map.entries()].map(([userId, info]) => ({ userId, ...info }));
    io.to(roomId).emit("participants-update", list);
}

function ensureRoom(store, roomId) {
    if (!store[roomId]) store[roomId] = {};
}

function ensureUser(store, roomId, userId) {
    ensureRoom(store, roomId);
    if (!store[roomId][userId]) store[roomId][userId] = 0;
}

function getOrCreateGraph(roomId) {
    if (!fraudGraphs[roomId]) fraudGraphs[roomId] = { nodes: [], edges: [] };
    return fraudGraphs[roomId];
}

function upsertGraphNode(roomId, userId, riskScore) {
    const graph = getOrCreateGraph(roomId);
    const existing = graph.nodes.find(n => n.id === userId);
    if (existing) {
        existing.riskScore = Math.max(existing.riskScore, riskScore);
    } else {
        graph.nodes.push({ id: userId, riskScore, alerts: 0 });
    }
}

function upsertGraphEdge(roomId, participants) {
    const graph = getOrCreateGraph(roomId);
    for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
            const a = participants[i], b = participants[j];
            const edgeId = [a, b].sort().join("--");
            let edge = graph.edges.find(e => e.id === edgeId);
            if (!edge) {
                edge = { id: edgeId, source: a, target: b, weight: 0, alerted: false };
                graph.edges.push(edge);
            }
            edge.weight++;
        }
    }
}

// ── Breakout rooms ──────────────────────────────────────────────────────────
// breakoutRooms[mainRoomId] = [{ id, name, participants: Set<userId> }]
const breakoutRooms = {};

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        if (req.url === "/api/health" || req.url === "/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "healthy", service: "CLARIVOX Meet Clone", timestamp: new Date().toISOString() }));
            return;
        }
        handler(req, res);
    });
    const io = new Server(httpServer);
    // 🛡️ LAYER 3: BEHAVIORAL AI FIREWALL 🛡️
    const ipBlacklist = new Set();
    const joinAttempts = {}; // Tracks rapid join attempts per IP

    io.on("connection", (socket) => {
        // Simple IP extraction
        const clientIp = socket.handshake.address;

        if (ipBlacklist.has(clientIp)) {
            console.warn(`[BEHAVIORAL FIREWALL] 🛑 Rejected connection from blacklisted IP: ${clientIp}`);
            socket.disconnect(true);
            return;
        }

        console.log("User connected:", socket.id);

        // 🛡️ LAYER 2: APPLICATION LAYER FIREWALL (WAF) 🛡️
        // This middleware intercepts EVERY event before it hits the server logic.
        let eventCount = 0;
        let lastEventTime = Date.now();
        
        socket.use(([event, ...args], next) => {
            // 1. Aggressive Global Rate Limiting (Anti-DDoS)
            const now = Date.now();
            if (now - lastEventTime > 1000) {
                eventCount = 0;
                lastEventTime = now;
            }
            eventCount++;
            if (eventCount > 100) { // Max 100 events per second
                console.warn(`[FIREWALL] 🛑 Socket ${socket.id} blocked for spamming.`);
                socket.disconnect(true); // Abrupt connection termination
                return next(new Error("Rate limit exceeded"));
            }

            // 2. Deep Payload Inspection & Sanitization
            const sanitize = (obj) => {
                if (typeof obj === 'string') {
                    if (obj.length > 5000) { // Prevent Buffer Overflow attacks
                        throw new Error("Payload too large");
                    }
                    // Strip dangerous HTML/Script tags (Basic XSS protection)
                    return obj.replace(/<[^>]*>?/gm, ''); 
                }
                if (typeof obj === 'object' && obj !== null) {
                    // Prevent NoSQL Injection structures (like $where)
                    if (Object.keys(obj).some(k => k.startsWith('$'))) {
                        throw new Error("Invalid payload structure");
                    }
                    for (const key in obj) {
                        obj[key] = sanitize(obj[key]);
                    }
                }
                return obj;
            };

            try {
                for (let i = 0; i < args.length; i++) {
                    args[i] = sanitize(args[i]);
                }
                next(); // Passed inspection
            } catch (err) {
                console.warn(`[FIREWALL] 🛑 Blocked malicious payload from ${socket.id}: ${err.message}`);
                socket.disconnect(true);
                return next(err);
            }
        });

        let currentRoom = null;
        let currentUser = null;

        // ── Join room ────────────────────────────────────────────────────────
        socket.on("join-room", (roomId, userId, displayName = "Guest") => {
            // Layer 3: Brute-Force Detection
            if (!joinAttempts[clientIp]) joinAttempts[clientIp] = [];
            const now = Date.now();
            joinAttempts[clientIp] = joinAttempts[clientIp].filter(t => now - t < 10000); // 10 second window
            joinAttempts[clientIp].push(now);
            
            if (joinAttempts[clientIp].length > 5) { // More than 5 joins in 10 seconds
                console.error(`[BEHAVIORAL FIREWALL] 🛑 Brute-force attack detected from ${clientIp}. Blacklisting IP.`);
                ipBlacklist.add(clientIp);
                socket.disconnect(true);
                return;
            }

            socket.join(roomId);
            currentRoom = roomId;
            currentUser = userId;

            // Behavioral tracking
            if (!joinTimestamps[roomId]) joinTimestamps[roomId] = {};
            if (!joinTimestamps[roomId][userId]) joinTimestamps[roomId][userId] = [];
            joinTimestamps[roomId][userId].push(Date.now());

            // Participants map
            if (!roomParticipants[roomId]) roomParticipants[roomId] = new Map();
            const isFirstUser = roomParticipants[roomId].size === 0;
            // Server-authoritative host: first joiner in a room
            if (isFirstUser) roomHosts[roomId] = userId;
            const isHost = roomHosts[roomId] === userId;

            roomParticipants[roomId].set(userId, {
                socketId: socket.id,
                displayName,
                isMuted: false,
                isVideoOff: false,
                handRaised: false,
                isHost,
            });

            // Confirm host status back to the joining client
            socket.emit("host-confirmed", { isHost, hostUserId: roomHosts[roomId] });
            if (roomModes[roomId]) {
                socket.emit("mode-select", roomModes[roomId]);
            }

            socket.to(roomId).emit("user-connected", userId);

            // Fraud graph edges
            const participants = [...roomParticipants[roomId].keys()];
            upsertGraphEdge(roomId, participants);

            // Broadcast updated participants list
            broadcastParticipants(io, roomId);

            // Init rate-limit bucket for this socket
            rateLimits[socket.id] = {};

            socket.on("disconnect", () => {
                socket.to(roomId).emit("user-disconnected", userId);

                if (roomParticipants[roomId]) {
                    roomParticipants[roomId].delete(userId);
                    // If the host leaves, promote the next participant
                    if (roomHosts[roomId] === userId) {
                        const remaining = [...roomParticipants[roomId].entries()];
                        if (remaining.length > 0) {
                            const [newHostId, newHostInfo] = remaining[0];
                            roomHosts[roomId] = newHostId;
                            newHostInfo.isHost = true;
                            roomParticipants[roomId].set(newHostId, newHostInfo);
                            // Notify the new host
                            io.to(newHostInfo.socketId).emit("host-confirmed", { isHost: true, hostUserId: newHostId });
                            console.log(`[HOST TRANSFER] Room: ${roomId} → ${newHostId}`);
                        } else {
                            delete roomHosts[roomId];
                        }
                    }
                    broadcastParticipants(io, roomId);
                }
                // Clean up rate limit state
                delete rateLimits[socket.id];

                ensureUser(disconnectCounts, roomId, userId);
                disconnectCounts[roomId][userId]++;

                const joins = joinTimestamps[roomId]?.[userId] || [];
                const recentJoins = joins.filter(t => Date.now() - t < 5 * 60 * 1000);
                const disconnects = disconnectCounts[roomId]?.[userId] || 0;

                if (recentJoins.length >= 2 || disconnects >= 3) {
                    const behavioralScore = Math.min(100, (recentJoins.length * 20) + (disconnects * 15));
                    socket.to(roomId).emit("behavioral-flag", {
                        userId, disconnects, recentJoins: recentJoins.length, behavioralScore,
                    });
                }
            });
        });

        // ── WebRTC Signaling ─────────────────────────────────────────────────
        socket.on("offer", (offer, roomId, targetId, senderId) => {
            socket.to(roomId).emit("offer", offer, targetId, senderId);
        });
        socket.on("answer", (answer, roomId, targetId, senderId) => {
            socket.to(roomId).emit("answer", answer, targetId, senderId);
        });
        socket.on("ice-candidate", (candidate, roomId, targetId, senderId) => {
            socket.to(roomId).emit("ice-candidate", candidate, targetId, senderId);
        });

        // ── Screen sharing ───────────────────────────────────────────────────
        socket.on("screen-share-started", (roomId, userId) => {
            socket.to(roomId).emit("screen-share-started", userId);
        });
        socket.on("screen-share-stopped", (roomId, userId) => {
            socket.to(roomId).emit("screen-share-stopped", userId);
        });

        // ── Chat ─────────────────────────────────────────────────────────────
        socket.on("chat-message", (msg) => {
            if (!currentRoom) return;
            // Relay to everyone else in room (sender already added optimistically)
            socket.to(currentRoom).emit("chat-message", msg);
        });

        // ── Reactions ────────────────────────────────────────────────────────
        socket.on("reaction", (reaction) => {
            if (!currentRoom) return;
            socket.to(currentRoom).emit("reaction", reaction);
        });

        // ── Captions ─────────────────────────────────────────────────────────
        socket.on("caption", (cap) => {
            if (!currentRoom) return;
            socket.to(currentRoom).emit("caption", cap);
        });

        // ── Session Mode Selection ─────────────────────────────────────────────
        socket.on("mode-select", (mode) => {
            const roomId = currentRoom;
            if (!roomId) return;
            roomModes[roomId] = mode;
            io.to(roomId).emit("mode-select", mode);
            console.log(`[SESSION MODE] Room ${roomId} set to mode: ${mode}`);
        });

        // ── Participant status updates ────────────────────────────────────────
        socket.on("status-update", ({ userId, isMuted, isVideoOff }) => {
            const roomId = currentRoom;
            if (!roomId || !roomParticipants[roomId]) return;
            const p = roomParticipants[roomId].get(userId);
            if (p) {
                if (isMuted !== undefined) p.isMuted = isMuted;
                if (isVideoOff !== undefined) p.isVideoOff = isVideoOff;
                roomParticipants[roomId].set(userId, p);
                broadcastParticipants(io, roomId);
            }
        });

        // ── Raise / lower hand ────────────────────────────────────────────────
        socket.on("raise-hand", (userId) => {
            const roomId = currentRoom;
            if (!roomId || !roomParticipants[roomId]) return;
            const p = roomParticipants[roomId].get(userId);
            if (p) { p.handRaised = true; roomParticipants[roomId].set(userId, p); }
            broadcastParticipants(io, roomId);
            socket.to(roomId).emit("hand-raised", userId);
        });
        socket.on("lower-hand", (userId) => {
            const roomId = currentRoom;
            if (!roomId || !roomParticipants[roomId]) return;
            const p = roomParticipants[roomId].get(userId);
            if (p) { p.handRaised = false; roomParticipants[roomId].set(userId, p); }
            broadcastParticipants(io, roomId);
        });

        // ── Host controls (server-verified + rate-limited) ────────────────────
        socket.on("kick-user", ({ targetUserId }) => {
            const roomId = currentRoom;
            if (!roomId) return;
            if (!isVerifiedHost(roomId, currentUser)) {
                socket.emit("permission-denied", { action: "kick-user", reason: "Not host" });
                return;
            }
            if (isRateLimited(socket.id, "kick-user")) {
                socket.emit("rate-limited", { action: "kick-user" });
                return;
            }
            const target = roomParticipants[roomId]?.get(targetUserId);
            if (target) io.to(target.socketId).emit("kicked");
        });

        socket.on("mute-user", ({ targetUserId }) => {
            const roomId = currentRoom;
            if (!roomId) return;
            if (!isVerifiedHost(roomId, currentUser)) {
                socket.emit("permission-denied", { action: "mute-user", reason: "Not host" });
                return;
            }
            if (isRateLimited(socket.id, "mute-user")) return;
            const target = roomParticipants[roomId]?.get(targetUserId);
            if (target) io.to(target.socketId).emit("force-mute");
        });

        socket.on("mute-all", () => {
            const roomId = currentRoom;
            if (!roomId) return;
            if (!isVerifiedHost(roomId, currentUser)) {
                socket.emit("permission-denied", { action: "mute-all", reason: "Not host" });
                return;
            }
            if (isRateLimited(socket.id, "mute-all")) return;
            socket.to(roomId).emit("force-mute");
        });

        socket.on("lock-room", (locked) => {
            const roomId = currentRoom;
            if (!roomId) return;
            if (!isVerifiedHost(roomId, currentUser)) {
                socket.emit("permission-denied", { action: "lock-room", reason: "Not host" });
                return;
            }
            if (isRateLimited(socket.id, "lock-room")) return;
            io.to(roomId).emit("room-locked", locked);
        });

        // ── Whiteboard ────────────────────────────────────────────────────────
        socket.on("whiteboard-draw", ({ roomId, ...ev }) => {
            socket.to(roomId).emit("whiteboard-draw", ev);
        });

        // ── Polls ─────────────────────────────────────────────────────────────
        socket.on("create-poll", (poll) => {
            if (!currentRoom) return;
            io.to(currentRoom).emit("poll-created", poll);
        });
        socket.on("poll-vote", ({ pollId, optionIndex }) => {
            if (!currentRoom) return;
            io.to(currentRoom).emit("poll-vote", { pollId, optionIndex, voterId: currentUser });
        });

        // ── Q&A ───────────────────────────────────────────────────────────────
        socket.on("get-qna", () => {
            const roomId = currentRoom;
            if (!roomId) return;
            if (!qnaSessions[roomId]) qnaSessions[roomId] = [];
            socket.emit("qna-update", qnaSessions[roomId]);
        });

        socket.on("qna-ask", ({ authorName, text }) => {
            const roomId = currentRoom;
            if (!roomId) return;
            if (!qnaSessions[roomId]) qnaSessions[roomId] = [];
            
            const question = {
                id: Math.random().toString(36).substr(2, 9),
                authorId: currentUser,
                authorName,
                text,
                upvotes: 0,
                upvotedBy: [],
                isAnswered: false,
                timestamp: Date.now()
            };
            qnaSessions[roomId].push(question);
            io.to(roomId).emit("qna-update", qnaSessions[roomId]);
        });

        socket.on("qna-upvote", ({ questionId }) => {
            const roomId = currentRoom;
            if (!roomId || !qnaSessions[roomId]) return;
            
            const q = qnaSessions[roomId].find(q => q.id === questionId);
            if (q) {
                const idx = q.upvotedBy.indexOf(currentUser);
                if (idx > -1) {
                    q.upvotedBy.splice(idx, 1);
                    q.upvotes--;
                } else {
                    q.upvotedBy.push(currentUser);
                    q.upvotes++;
                }
                io.to(roomId).emit("qna-update", qnaSessions[roomId]);
            }
        });

        socket.on("qna-answered", ({ questionId }) => {
            const roomId = currentRoom;
            if (!roomId || !qnaSessions[roomId]) return;
            if (!isVerifiedHost(roomId, currentUser)) return;
            
            const q = qnaSessions[roomId].find(q => q.id === questionId);
            if (q) {
                q.isAnswered = true;
                io.to(roomId).emit("qna-update", qnaSessions[roomId]);
            }
        });

        // ── Breakout rooms ────────────────────────────────────────────────────
        socket.on("create-breakout", ({ rooms }) => {
            const roomId = currentRoom;
            if (!roomId) return;
            breakoutRooms[roomId] = rooms;
            io.to(roomId).emit("breakout-started", rooms);
        });
        socket.on("join-breakout", ({ breakoutRoomId }) => {
            if (!currentRoom) return;
            socket.join(breakoutRoomId);
            socket.to(breakoutRoomId).emit("user-connected", currentUser);
        });
        socket.on("end-breakout", () => {
            const roomId = currentRoom;
            if (!roomId) return;
            io.to(roomId).emit("breakout-ended");
            delete breakoutRooms[roomId];
        });

        // ── Scam alert broadcasting (rate-limited) ───────────────────────────
        socket.on("scam-alert", ({ participantId, riskScore, triggeredFeatures }) => {
            const roomId = currentRoom;
            if (!roomId) return;
            if (isRateLimited(socket.id, "scam-alert")) return;
            console.log(`[SCAM ALERT] Room: ${roomId} | User: ${participantId} | Score: ${riskScore}`);
            io.to(roomId).emit("scam-alert", { participantId, riskScore, triggeredFeatures });

            upsertGraphNode(roomId, participantId, riskScore);
            const graph = getOrCreateGraph(roomId);
            const node = graph.nodes.find(n => n.id === participantId);
            if (node) node.alerts++;
            graph.edges.forEach(e => {
                if ((e.source === participantId || e.target === participantId) && riskScore >= 70) {
                    e.alerted = true;
                }
            });
            io.to(roomId).emit("graph-update", graph);
        });

        // ── Fraud graph hydration ─────────────────────────────────────────────
        socket.on("request-graph", (roomId) => {
            socket.emit("graph-update", getOrCreateGraph(roomId));
        });

        // ── Exam session management (host-verified) ───────────────────────────
        socket.on("exam-start", ({ durationMin }) => {
            const roomId = currentRoom;
            if (!roomId) return;
            if (!isVerifiedHost(roomId, currentUser)) {
                socket.emit("permission-denied", { action: "exam-start", reason: "Not host" });
                return;
            }
            if (isRateLimited(socket.id, "exam-start")) return;
            const endTimestamp = Date.now() + durationMin * 60 * 1000;
            examSessions[roomId] = { active: true, endTimestamp, hostUserId: currentUser };
            console.log(`[EXAM] Room: ${roomId} | Duration: ${durationMin}min`);
            io.to(roomId).emit("exam-started", { endTimestamp, durationMin, hostId: currentUser });
        });

        socket.on("exam-end", () => {
            const roomId = currentRoom;
            if (!roomId || !examSessions[roomId]) return;
            if (!isVerifiedHost(roomId, currentUser)) {
                socket.emit("permission-denied", { action: "exam-end", reason: "Not host" });
                return;
            }
            if (isRateLimited(socket.id, "exam-end")) return;
            examSessions[roomId].active = false;
            console.log(`[EXAM END] Room: ${roomId}`);
            io.to(roomId).emit("exam-ended", { roomId, endedAt: Date.now() });
        });

        // ── Engagement score relay → host only ────────────────────────────────
        // Participants emit their own score; server relays to host socket only
        socket.on("engagement-score", (data) => {
            const roomId = currentRoom;
            if (!roomId) return;
            if (isRateLimited(socket.id, "candidate-score-update")) return;
            const hostUserId = roomHosts[roomId];
            if (!hostUserId || hostUserId === currentUser) return; // host doesn't relay to self
            const hostParticipant = roomParticipants[roomId]?.get(hostUserId);
            if (!hostParticipant) return;
            io.to(hostParticipant.socketId).emit("remote-engagement-score", {
                userId: currentUser,
                displayName: roomParticipants[roomId]?.get(currentUser)?.displayName ?? "Guest",
                score: data.score,
                level: data.level,
                trend: data.trend,
                breakdown: data.breakdown,
            });
        });

        // ── Candidate AI score relay → host only ──────────────────────────────
        // Each participant emits their own AI scores; server relays to host only
        socket.on("candidate-score-update", (data) => {
            const roomId = currentRoom;
            if (!roomId) return;
            const session = examSessions[roomId];
            const hostUserId = session?.hostUserId;
            if (!hostUserId) return;
            const hostParticipant = roomParticipants[roomId]?.get(hostUserId);
            if (!hostParticipant) return;
            // Relay score data to host socket only
            io.to(hostParticipant.socketId).emit("candidate-score-update", {
                userId: currentUser,
                ...data,
            });
        });

        // ── Exam violation relay → host ───────────────────────────────────────
        socket.on("exam-violation", (data) => {
            const roomId = currentRoom;
            if (!roomId) return;
            const session = examSessions[roomId];
            const hostUserId = session?.hostUserId;
            if (!hostUserId) return;
            const hostParticipant = roomParticipants[roomId]?.get(hostUserId);
            if (!hostParticipant) return;
            io.to(hostParticipant.socketId).emit("exam-violation", {
                userId: currentUser,
                ...data,
            });
            console.log(`[VIOLATION] Room: ${roomId} | User: ${currentUser} | Type: ${data.violation?.type}`);
        });

        socket.on("exam-auto-terminated", (data) => {
            const roomId = currentRoom;
            if (!roomId) return;
            const session = examSessions[roomId];
            const hostUserId = session?.hostUserId;
            if (!hostUserId) return;
            const hostParticipant = roomParticipants[roomId]?.get(hostUserId);
            if (!hostParticipant) return;
            io.to(hostParticipant.socketId).emit("exam-auto-terminated", {
                userId: currentUser, ...data
            });
            console.log(`[EXAM TERMINATED] Room: ${roomId} | User: ${currentUser}`);
        });

        socket.on("exam-submitted", () => {
            const roomId = currentRoom;
            if (!roomId) return;
            const session = examSessions[roomId];
            const hostUserId = session?.hostUserId;
            if (!hostUserId) return;
            const hostParticipant = roomParticipants[roomId]?.get(hostUserId);
            if (!hostParticipant) return;
            io.to(hostParticipant.socketId).emit("exam-submitted", { userId: currentUser });
        });
    });

    httpServer
        .once("error", (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
