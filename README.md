# calendar-offset

A mini script and lightweight Node.js proxy server to offset an iCalendar (`.ics`) feed from UTC to local time (`America/Chicago`). 

Originally designed to load `.ics` feeds into Obsidian calendar extensions (and other calendar widgets, dashboards, or clients) that do not support setting a local timezone or handling UTC timezone offsets on imported subscriptions.

---

## Features

- **Dynamic Fetching**: Proxies and formats your calendar feed on request.
- **Timezone Adjustment**: Converts UTC `DTSTART`/`DTEND` timestamps to `America/Chicago` local time stamps.
- **CORS Support**: Headers enabled for cross-origin widget and client requests.
- **Configurable via Environment**: Securely configure secret feed URLs and ports via `.env`.
- **Docker Ready**: Minimal Docker setup using `node:18-alpine`.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- Alternatively, [Docker](https://www.docker.com/)

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone git@github.com:MattLMerritt/calendar-offset.git
cd calendar-offset
npm install
```

### 2. Configuration

Copy the example environment configuration file to `.env`:

```bash
cp .env.example .env
```

Edit `.env` and set your secret iCal feed URL:

```env
CALENDAR_URL=https://calendar.google.com/calendar/ical/<your_calendar_address>/basic.ics
PORT=3000
```

> **Note**: Never commit your `.env` file or certificates to version control. They are ignored by default in `.gitignore`.

### 3. Running Locally

Start the server:

```bash
npm start
```

The server will start listening at `http://localhost:3000`.

---

## Docker Deployment

### Build the Image

```bash
docker build -t calendar-offset .
```

### Run the Container

Run passing the `.env` file:

```bash
docker run -d -p 3000:3000 --env-file .env --name calendar-offset calendar-offset
```

Or pass environment variables inline:

```bash
docker run -d -p 3000:3000 \
  -e CALENDAR_URL="https://calendar.google.com/calendar/ical/.../basic.ics" \
  --name calendar-offset calendar-offset
```

---

## API Endpoints

### `GET /`

Fetches the source calendar from `CALENDAR_URL`, adjusts date/time definitions, and returns the rewritten `.ics` file.

- **Response Content-Type**: `text/calendar; charset=utf-8`
- **CORS**: `Access-Control-Allow-Origin: *`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `CALENDAR_URL` | **Yes** | None | The private/secret iCal URL to fetch and transform. |
| `PORT` | No | `3000` | The port the HTTP server binds to. |

---

## License

[MIT](LICENSE)

