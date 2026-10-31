# A guide for humans

The administrator and GM manual for the Dream series: what to press, what it does, and what to do when it goes wrong. It is written for the person running the game, and assumes no code. Started 2026-10-31.

Everything here assumes you are working on **Morty** (`192.168.1.111`), the house server. Addresses work from any machine on the house network.

## The pages you will use

| Page | Address | For |
| --- | --- | --- |
| Portal | `http://192.168.1.111:5170` | The front door: a card for every tool, with a dot saying whether it is running |
| Status | `http://192.168.1.111:5320` | Who is playing, how the server is doing, promoting builds, cleaning up old ones |
| GM | `http://192.168.1.111:5320/gm` | Doing things to players and rooms |
| Bots | `http://192.168.1.111:5320/bots` | Starting a crowd, checking the game still works |
| Dream World | `http://192.168.1.111:5240` | Building zones, publishing them, playing |
| Dream Codex | `http://192.168.1.111:5230/codex.html` | Items, abilities, loot, shops and NPC templates |
| Library | `http://192.168.1.111:5230` | Everything made, and the asset packs |

After someone updates a tool, press **Ctrl+F5** on any page you already have open.

## Accounts

**You need two things to use the Status, GM and Bots controls:** an account flagged admin, and to be on the house network. Your account `graves` has the flag.

**Signing in** lasts 12 hours, and each browser tab signs in for itself. When a page starts saying "sign in first", sign in again. Five wrong tries from one address lock it for a minute.

**A new account** is made in Dream World: the **▾** beside Play, choose **Online**, then **Register**. One address can make five new accounts an hour.

Open Command Prompt on Morty for the next three.

**Make an account an admin:**

```
cd /d D:\Public\dream-server
node tools\admin.mjs "Name"
```

Add `off` after the name to take it away. It works while the server runs.

**Reset a password**, yours or anyone's. It asks twice and is meant to show nothing as you type:

```
cd /d D:\Public\dream-server
node tools\password.mjs "Name"
```

Anywhere already signed in stays signed in until its 12 hours are up.

**Removing an account** can't be done yet. Ban it instead.

## The GM page

It lists every **open room**. A room opens when the first player joins a zone and closes two minutes after the last one leaves, so "No rooms open" just means nobody is playing. Every action is written to the log at the bottom of the page.

| Button | What happens |
| --- | --- |
| **Teleport** | Moves a player to the x and z you type, in metres. The middle of a zone is 0, 0 |
| **Heal** | Fills a player's health and stamina. Refused if they are dead, since they come back by themselves |
| **Kill** | Kills a player or an NPC. A player comes back at the spawn after a few seconds. An NPC comes back only if it is set to respawn |
| **Give / Take** | Puts an item in a bag or takes it out, picked from the current tables, up to 999 at a time. Give is refused if the bag has no room |
| **Kick** | Removes a player and shows them your reason. Their progress is saved, and **they can sign straight back in** |
| **Ban** | Removes them and stops that account signing in or playing, showing them your reason. Works on someone offline, from the form under Banned accounts. You can't ban yourself |
| **Unban** | Lifts it, from the Banned accounts list |
| **Spawn** | Adds a copy of an NPC at the x and z you type. It doesn't come back after dying, and it goes when the room closes |
| **Reload** | Reads the zone and tables again. Players stay where they stand |
| **Reset doors and chests** | Closes every door and chest in that zone, and lets chests give loot again. It asks first |

## Making content reach the game

Your server runs in one of two modes, shown on the Status page as `content`.

| Mode | Rooms play | Good for |
| --- | --- | --- |
| **library** (Morty's normal mode) | Whatever is saved in the Library right now | Building and testing |
| **live** | Only zones you have published and promoted. Needs no Library at all | The real game |

**In library mode**, save your zone and press Play. A change in the Codex reaches a room when it next opens, or straight away with **Reload** on the GM page.

**To publish a zone:**

1. Open the zone in Dream World, and sign in with your admin account (**▾** beside Play).
2. Choose **File > Publish zone…**
3. Read the report. Errors must be fixed, and each one names the record, like `loot boar: no item gone`. Warnings can be ignored if you are happy with them. It also lists the Library places the zone draws from.
4. Press **Publish to staging**. Nothing changes for players yet.
5. On the Status page, press **Promote** beside that build. It goes live, open rooms update in place, and nobody is dropped.

**Three things to know about publishing:**

- **Tables are shared.** The gameplay tables travel with every publish, and **the last build you promote sets them for every zone**. So promoting an old build of one zone also brings back its old tables everywhere. The Status page says which build they came from.
- **Going back:** a build older than the live one shows **Go back to this**. It's the same as promoting.
- **Library mode ignores builds.** You can publish and promote on Morty today, but its rooms won't play them until the server runs in live mode. To try that, start it as below with `set "CONTENT=live"` first. Zones with no live build then refuse players, so put it back afterwards.

**Clean up old builds** on the Status page keeps each zone's live build and newest five. It shows what would go and asks first.

**Keeping a place out of the public game:** in the Library panel, press the **§** on a place. You can note its licence, which appears in the publish report, and mark it not for the public game, which makes publish refuse anything from it. Nothing is marked unless you mark it.

## The Bots page

**A crowd:** pick a zone, how many, what they do, a character and how long, then press **Start**. Only one crowd runs at a time.

- They are real clients in the real room, so you can walk among them with Play online. Anyone else in that zone will meet them too.
- They need no accounts, save nothing, and leave the moment they stop.
- They count as players, and a room holds 100. Bots past that are refused and the page says so.

**Reading the numbers:**

| Number | Means |
| --- | --- |
| **Tick** | How long the server takes to work out one moment of the game. It has 50 ms for each. The target is under 10 ms with 200 players |
| **Sent** | How much the server is sending every second, and how much of that is gameplay events |
| **Memory** | What the server is using. A little growth is normal. Steady climbing for a long time is not |
| **Refused or errors** | Should be empty. `full` means the room's limit was reached |

**Check the game** plays the whole game on a private server: kill, loot, wear, portal, rejoin, reconnect. Then it runs recorded sessions again to catch the rules changing. It takes under a minute and doesn't touch your rooms or saves. If something fails, the page says what, and that text is what to give an agent.

**Past runs** keeps the numbers from each crowd.

## Starting and stopping

**Everything:** run `start-all.bat` in `D:\Public\gravepain-portal`. Each tool gets its own window, and closing a window stops that tool. It also copies newer Library files between the PC and Morty when it can reach both.

**One server,** in Command Prompt on Morty. First find it and stop it, using its port from the table below and the number at the end of the line:

```
netstat -ano | findstr LISTENING | findstr ":5320"
```
```
taskkill /F /PID <that number>
```

Then start the Dream Server again:

```
cd /d D:\Public\dream-server
node server.mjs
```

Or the Library, which needs one more line first so that saves work:

```
cd /d D:\Public\dream-library
set "DREAM_ADMIN=192.168.1.0/24"
node server.mjs
```

Closing that window stops the server. A hard stop can lose up to the last second of players' saves, so stop it while nobody is playing if you can.

| Port | Tool |
| --- | --- |
| 5170 | Portal |
| 5210 | Dream Forge |
| 5230 | Library and Codex |
| 5240 | Dream World |
| 5250 | Dream Paint |
| 5260 | Dream Effects |
| 5270 | Dream Characters |
| 5310 | Dream Sound |
| 5320 | Dream Server: Status, GM, Bots |

## When something goes wrong

| You see | It means | Do this |
| --- | --- | --- |
| "sign in first" | Your 12 hours are up, or this tab never signed in | Sign in again |
| "… is not an admin" | The account has no flag | Run `tools\admin.mjs` as above |
| "admin actions are for this machine or an address in DREAM_ADMIN" | You are off the house network, or the server started without its setting | Restart it as above |
| "Only the library machine … can change the library" | The Library started without `DREAM_ADMIN` | Restart it as above, with the `set` line |
| "too many failed sign-ins" | Five wrong passwords | Wait a minute |
| A player can't join: "not published" | The server is in live mode and the zone has no live build | Publish and promote it, or go back to library mode |
| A player can't join: "the zone is full" | The room holds 100 | Stop any bots, or start the server with `set "MAX_PLAYERS=200"` first |
| A Codex change doesn't show in the game | Library mode: the room is still open. Live mode: it has not been published | **Reload** on the GM page, or publish and promote |
| Something you deleted came back | `start-all` copies files both ways and never deletes, so the other machine had a copy | Delete it on both machines, or ask an agent |
| "No rooms open" on the GM page | Nobody is in a zone | Nothing is wrong. Join one, or start some bots |
| A page says 404, but the server is running | An update may have only half applied | Ask an agent, and mention this line |
| A tool looks out of date | Your browser kept the old one | Ctrl+F5 |

## Where things live

| What | Where |
| --- | --- |
| Accounts and player saves | `D:\Public\dream-server\saves\dream.db` |
| GM log | `D:\Public\dream-server\saves\gm.log` |
| Past bot runs | `D:\Public\dream-server\saves\bots.log` |
| Published builds and their files | `D:\Public\dream-server\packs` |
| Everything saved in the tools | `D:\Public\dream-forge-creations` |
| The server's secret | `D:\Public\dream-server\secret.txt`. Keep it private. Changing it signs everyone out |

**Backups:** nothing backs up accounts, saves or builds automatically, and they are not in git. Until that changes, stop the Dream Server and copy `saves` and `packs` somewhere safe. The Library's files keep older versions of what is saved, and `start-all` keeps a copy on the PC.

## Not there yet

- Removing an account, or resetting a password from a web page.
- Banning by address: a ban is per account.
- Chat, or a message to everyone.
- Buying in shops. They can be made in the Codex, but they don't work in the game.
- Worn gear showing on the character. It changes their stats only.
- Going public: there is no VPS, HTTPS or automatic backup yet, and the game's art can still be saved from its address.
