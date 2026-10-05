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

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
function shiftDay(dayStr, delta) {
    const idx = DAYS.indexOf(dayStr);
    if (idx === -1) return dayStr;
    return DAYS[(idx + delta + 7) % 7];
}

function crossesUtcMidnight(year, month, day, hour, min, sec, timeZone = 'America/Chicago') {
    const d = new Date(Date.UTC(year, month - 1, day, hour, min, sec));
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(d);
    const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-5';
    const offsetMatch = tzPart.match(/GMT([+-]\d+)/);
    const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : -5;
    return (hour - offsetHours) >= 24;
}

// Helper to convert UTC date string (YYYYMMDDTHHMMSS) to America/Chicago local date string
function convertDateStrToLocal(dateStr, timeZone = 'America/Chicago') {
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const hour = parseInt(dateStr.substring(9, 11));
    const min = parseInt(dateStr.substring(11, 13));
    const sec = parseInt(dateStr.substring(13, 15));

    const date = new Date(Date.UTC(year, month, day, hour, min, sec));

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type) => parts.find(p => p.type === type).value;

    return `${getPart('year')}${getPart('month')}${getPart('day')}T${getPart('hour')}${getPart('minute')}${getPart('second')}`;
}

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

        // 4. THE LOGIC
        // 4a. Strip VTIMEZONE blocks so calendar clients don't apply unwanted timezone shifts
        icsData = icsData.replace(/BEGIN:VTIMEZONE[\s\S]*?END:VTIMEZONE\r?\n?/g, '');

        // 4b. Strip ;TZID=... parameter from properties (e.g. DTSTART;TZID=America/Chicago:...)
        icsData = icsData.replace(/;TZID=[^:\r\n]+/g, '');

        // 4c. Convert UTC timestamps ending with Z on DTSTART, DTEND, RECURRENCE-ID, EXDATE
        const timeRegex = /((?:DTSTART|DTEND|RECURRENCE-ID|EXDATE)[^:\r\n]*:)(\d{8}T\d{6})Z/g;
        icsData = icsData.replace(timeRegex, (match, prefix, dateStr) => {
            return `${prefix}${convertDateStrToLocal(dateStr)}`;
        });

        // 4d. Convert UNTIL timestamp in RRULE if present (e.g. UNTIL=20261106T055959Z)
        const untilRegex = /(UNTIL=)(\d{8}T\d{6})Z/g;
        icsData = icsData.replace(untilRegex, (match, prefix, dateStr) => {
            return `${prefix}${convertDateStrToLocal(dateStr)}`;
        });

        // 4e. Compensate for calendar client recurring rule bug:
        // When an evening recurring event in local time crosses UTC midnight,
        // client libraries (Luxon/rrule/FullCalendar) evaluate BYDAY against UTC days,
        // shifting the displayed occurrence one day early.
        // Shifting BYDAY forward by 1 day compensates so the client displays the correct local weekday.
        const events = icsData.split('BEGIN:VEVENT');
        for (let i = 1; i < events.length; i++) {
            let ev = events[i];
            const dtstartMatch = ev.match(/DTSTART(?:;VALUE=DATE)?:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
            const rruleMatch = ev.match(/(RRULE:[^\r\n]*)/);

            if (dtstartMatch && rruleMatch) {
                const [, y, m, d, hh, mm, ss] = dtstartMatch;
                const crosses = crossesUtcMidnight(parseInt(y), parseInt(m), parseInt(d), parseInt(hh), parseInt(mm), parseInt(ss));

                if (crosses && rruleMatch[1].includes('BYDAY=')) {
                    const adjustedRrule = rruleMatch[1].replace(/BYDAY=([A-Z,]+)/, (match, days) => {
                        const shifted = days.split(',').map(day => shiftDay(day, 1)).join(',');
                        return `BYDAY=${shifted}`;
                    });
                    events[i] = ev.replace(rruleMatch[1], adjustedRrule);
                }
            }
        }
        icsData = events.join('BEGIN:VEVENT');

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
    if (!process.env.CALENDAR_URL) {
        console.warn("WARNING: CALENDAR_URL environment variable is not set!");
    }
});

