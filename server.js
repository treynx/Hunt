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

// Initialize 8 checkpoints with default clues
let checkpoints = {};
for (let i = 1; i <= 8; i++) {
    checkpoints[i] = { clue: `Clue for waypoint ${i} goes here.` };
}

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
    
    // Notify admin dashboard of new scan
    broadcast({ type: 'NEW_SCAN', logEntry });

    // Return the clue to display to the runner
    res.json({ success: true, clue: checkpoints[id].clue, time: formattedTime });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));