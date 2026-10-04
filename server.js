require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// 1. Handle CORS (Your "OPTIONS" check)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    
    // If it's a preflight check, return immediately
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.get('/', async (req, res) => {
    try {
        // 2. Google Calendar URL from environment
        const CALENDAR_URL = process.env.CALENDAR_URL;
        if (!CALENDAR_URL) {
            console.error("CALENDAR_URL environment variable is not defined");
            return res.status(500).send("CALENDAR_URL environment variable is not defined");
        }

        // 3. Fetch Data from Google (Node 18 has native fetch!)
        const response = await fetch(CALENDAR_URL);
        if (!response.ok) {
            return res.status(500).send("Error fetching from Google");
        }
        let icsData = await response.text();

        // 4. THE LOGIC (Your exact Timezone code)
        const timeRegex = /((?:DTSTART|DTEND)[^:\n]*:)(\d{8}T\d{6})Z/g;

        icsData = icsData.replace(timeRegex, (match, prefix, dateStr) => {
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1; 
            const day = parseInt(dateStr.substring(6, 8));
            const hour = parseInt(dateStr.substring(9, 11));
            const min = parseInt(dateStr.substring(11, 13));
            const sec = parseInt(dateStr.substring(13, 15));

            const date = new Date(Date.UTC(year, month, day, hour, min, sec));

            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/Chicago',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            });

            const parts = formatter.formatToParts(date);
            const getPart = (type) => parts.find(p => p.type === type).value;

            const newTime = `${getPart('year')}${getPart('month')}${getPart('day')}T${getPart('hour')}${getPart('minute')}${getPart('second')}`;

            return `${prefix}${newTime}`;
        });

        // 5. Return the rewritten file
        res.set('Content-Type', 'text/calendar; charset=utf-8');
        res.send(icsData);

    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(port, () => {
    console.log(`Calendar Fixer running on port ${port}`);
});