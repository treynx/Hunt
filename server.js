const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Global State
let raceStartTime = null; 
let raceStatus = 'stopped'; // stopped, running
let participantLogs = [];

// Initialize 8 checkpoints with clues AND coordinates
// Update these coordinates (lat, lng) to match your real course points
let checkpoints = {
    1: { clue: "Clue for waypoint 1 goes here.", lat: 36.3060, lng: -96.4638 },
    2: { clue: "Clue for waypoint 2 goes here.", lat: 36.1256, lng: -97.0686 },
    3: { clue: "Clue for waypoint 3 goes here.", lat: 36.1356, lng: -97.0786 },
    4: { clue: "Clue for waypoint 4 goes here.", lat: 36.1456, lng: -97.0886 },
    5: { clue: "Clue for waypoint 5 (Mile 50) goes here.", lat: 36.1556, lng: -97.0986 },
    6: { clue: "Clue for waypoint 6 goes here.", lat: 36.1656, lng: -97.1086 },
    7: { clue: "Clue for waypoint 7 goes here.", lat: 36.1756, lng: -97.1186 },
    8: { clue: "Clue for waypoint 8 goes here.", lat: 36.1856, lng: -97.1286 }
};

// Broadcast helper for WebSockets
function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// REST API Endpoints
app.get('/api/state', (req, res) => {
    res.json({ raceStartTime, raceStatus, checkpoints, participantLogs });
});

app.post('/api/admin/start', (req, res) => {
    raceStartTime = Date.now();
    raceStatus = 'running';
    broadcast({ type: 'RACE_STARTED', raceStartTime });
    res.sendStatus(200);
});

app.post('/api/admin/reset', (req, res) => {
    raceStartTime = null;
    raceStatus = 'stopped';
    participantLogs = [];
    broadcast({ type: 'RACE_RESET' });
    res.sendStatus(200);
});

app.post('/api/admin/update-clue', (req, res) => {
    const { id, clue } = req.body;
    if (checkpoints[id]) {
        checkpoints[id].clue = clue;
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Invalid checkpoint ID' });
    }
});

// Scan Endpoint
app.post('/api/scan', (req, res) => {
    const { firstName, lastName, checkpointId } = req.body;
    
    if (raceStatus !== 'running') {
        return res.status(400).json({ error: 'Race has not started yet!' });
    }

    const id = parseInt(checkpointId);
    if (!checkpoints[id]) {
        return res.status(400).json({ error: 'Unknown Checkpoint' });
    }

    const elapsedMs = Date.now() - raceStartTime;
    const formattedTime = new Date(elapsedMs).toISOString().substr(11, 8);

    const logEntry = {
        firstName,
        lastName,
        checkpointId: id,
        time: formattedTime,
        timestamp: Date.now()
    };

    participantLogs.push(logEntry);
    broadcast({ type: 'NEW_SCAN', logEntry });

    res.json({ success: true, clue: checkpoints[id].clue, time: formattedTime });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
