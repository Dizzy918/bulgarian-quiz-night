# Bulgarian Quiz Night — your own game room

Everyone plays on their own phone. No accounts, no PINs from anyone else's
service, no internet connection required, and nothing on screen belongs to
anybody but you.

You need: a laptop, and everybody on the same Wi-Fi (a phone hotspot works).

---

## Once, before the night: install Node.js

Go to **nodejs.org**, download the big green **LTS** button, install it.
That is the only installation involved. Nothing else gets downloaded, ever.

## On the night

**1. Start the room.**
Double-click **start.command** (Mac) or **start-windows.bat** (Windows).
A black window opens and prints two addresses.

> Mac may say the file is from an unidentified developer. Right-click it →
> **Open** → **Open**. You only have to do that once.

**2. Give the players the first address.**

```
  http://192.168.x.x:8080
```

Write it on the projector or a flipchart. Everyone types it into any
browser on their phone, puts in a name, and they are in. That is the whole
join process.

**3. Open the second address yourself.** It ends in `/host?k=XXXXXX` and it
is your control screen — the projector view. Keep that one to yourself; it
is what runs the game.

**4. Run the quiz.**
Pick your rounds and the seconds per question, press **Open the room**, and
watch the names appear. Press **Start question 1** when everyone is in.

Each question reveals itself when the timer runs out or as soon as everyone
has answered — or press **Reveal the answer** to cut it short. Read the
story out loud, then **Next question**. After the last one you get the
podium.

**5. When it's over,** press Ctrl+C in the black window, or just close it.

---

## If something goes wrong

**"node: command not found"** — Node.js isn't installed. See the top of this
page.

**A phone can't open the address.** It's on a different network. Check it's
on the same Wi-Fi and that mobile data is off. Some venue and office Wi-Fi
deliberately stops devices talking to each other — if so, turn on your
phone's hotspot, connect the laptop to it, and restart the room so it
prints the new address.

**Several addresses printed.** The window lists the extras underneath. If
the first one doesn't work, try the next.

**Someone refreshed or their phone slept.** They open the address again and
put in the same name — their score is still there.

**The fonts look plain.** With no internet the page falls back to the fonts
already on the machine. Everything still works.

**You want to start over.** Press **Close the room** on the host screen:
scores reset, players stay connected, you can pick different rounds.

---

## Without the server

Double-clicking **quiz.html** on its own still gives you **Stage mode**
(teams on one screen, you tap who got it right) and the **Practice run**,
completely offline. That's your backup if the Wi-Fi misbehaves on the night.

---

## What's inside

- **quiz.html** — the whole game: questions, screens, scoring.
- **server.js** — the room. Plain Node, no packages, ~250 lines. It reads
  the questions straight out of quiz.html, so if you edit a question there,
  the server picks it up next time it starts.
- **start.command / start-windows.bat** — just run server.js for you.

## Editing the questions

Open **quiz.html** in any text editor and find `var ROUNDS`. Each question
is `{t: "the question", a: ["A","B","C"], c: 0, why: "the story"}` — `c` is
which answer is correct, counting from 0, and a list like `c: [0,1,2]` with
`multi: true` makes it select-all-that-apply. Save, restart the room.
