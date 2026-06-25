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

// Tallgrass 200 Official Checkpoints
let checkpoints = {
    1: { name: "Cleveland", mile: 48, lat: 36.3106, lng: -96.4697 },
    2: { name: "Pawhuska", mile: 89, lat: 36.6659, lng: -96.3389 },
    3: { name: "Fairfax", mile: 142, lat: 36.5723, lng: -96.7131 },
    4: { name: "Pawnee", mile: 167, lat: 36.3378, lng: -96.8042 },
    5: { name: "Stillwater (Finish)", mile: 200, lat: 36.1156, lng: -97.0586 }
};

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Serve Public UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve Admin UI at /admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/api/state', (req, res) => {
    res.json({ raceStartTime, raceStatus, checkpoints, participantLogs });
});

// Manual Ignition Trigger for Saturday Morning
app.post('/api/admin/start', (req, res) => {
    raceStartTime = Date.now();
    raceStatus = 'running';
    broadcast({ type: 'RACE_STARTED', raceStartTime });
    res.json({ success: true, raceStartTime });
});

app.post('/api/admin/reset', (req, res) => {
    raceStartTime = null;
    raceStatus = 'stopped';
    participantLogs = [];
    broadcast({ type: 'RACE_RESET' });
    res.sendStatus(200);
});

// Self-Reporting Entry Point
app.post('/api/report', (req, res) => {
    const { firstName, lastName, checkpointId } = req.body;
    
    if (raceStatus !== 'running') {
        return res.status(400).json({ error: 'The race clock has not been started by the director yet!' });
    }

    const id = parseInt(checkpointId);
    if (!checkpoints[id]) {
        return res.status(400).json({ error: 'Invalid Checkpoint Selected' });
    }

    // Capture actual real-world check-in time
    const checkInTime = new Date();
    const formattedTime = checkInTime.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    }).toLowerCase().replace(" ", ""); // e.g. "5:34pm"

    const logEntry = {
        firstName,
        lastName,
        checkpointId: id,
        mile: checkpoints[id].mile,
        time: formattedTime,
        timestamp: Date.now()
    };

    participantLogs.push(logEntry);
    broadcast({ type: 'NEW_SCAN', logEntry });

    res.json({ success: true, location: checkpoints[id].name, time: formattedTime });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Tallgrass 200 Tracker running on port ${PORT}`));
