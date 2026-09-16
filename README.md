# Bulgarian Quiz Night

A pub-quiz room that runs on one laptop over local Wi-Fi. Everybody plays on
their own phone; the host drives the round from a private page. No accounts, no
internet, no installs beyond Node.js itself.

**Playing tonight and not writing code?** Read
**[START-HERE.md](START-HERE.md)** instead — that is the whole guide.

```bash
node server.js
```

It prints the address players type in, and a separate host URL carrying a
one-time key. Nothing else to configure.

## How it fits together

Three files, no dependencies, no build step.

| File | Role |
|---|---|
| `server.js` | HTTP + SSE game server. Holds all state in memory. |
| `quiz.html` | The entire client — player view and host view — plus the questions. |
| `start.command` / `start-windows.bat` | Double-click launchers that check for Node first. |

`server.js` reads `quiz.html` at startup and pulls the questions straight out of
it with a regex on `var ROUNDS = [...]`, so **the questions have exactly one
home**: edit `quiz.html` and restart. The server then serves that same file back
with a `window.LAN` bootstrap object injected, which is what tells a browser
whether it is a player or the host.

State lives in `G` (round status, question index, deadline) and `PLAYERS`
(score, streak, answers). Nothing is written to disk — closing the window ends
the game, which is the intent.

### Endpoints

| Route | Purpose |
|---|---|
| `GET /` | Player page |
| `GET /host?k=KEY` | Host page; redirects (302) without the right key |
| `GET /events` | Server-sent events stream — scores, question changes, timer |
| `POST /join` | Claim a name, get a player id |
| `POST /answer` | Submit an answer for the current question |
| `POST /cmd` | Host-only: start, next question, reveal, reset |

The host key is generated fresh each run (`Math.random().toString(36)`), so a
player who guesses `/host` gets bounced. It keeps honest people honest on a
living-room network; it is not authentication.

## Notes

- Ports 8080–8090 are tried in order, so a busy port is not a dead end.
- The scoreboard sorts by score, then by name, so ties are stable rather than
  jittering between refreshes.
- Answer timing is enforced server-side against `qStartAt`, so a phone with a
  slow connection is not silently robbed of its window — and a clock-fiddling
  phone gains nothing.
