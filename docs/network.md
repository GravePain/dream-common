# Network setup: what is where

**Mandatory reading for any agent that runs, restarts, publishes or debugs anything in the Dream series.** It answers "which machine is this, which address, which port, and what do I do to get a change in front of the user". Keep it true: when an address, port or process changes, change this file in the same piece of work.

Checked 2026-10-29 against the live machines.

## The two machines

| | Dev PC | Morty (the house server) |
| --- | --- | --- |
| Address | `192.168.1.114` (also `localhost`; `172.24.160.1` is a virtual adapter, ignore it) | `192.168.1.111` (`172.19.144.1` is a virtual adapter, ignore it) |
| OS / shell | Windows 10, Git Bash and PowerShell | Windows Server; over SSH it is **cmd.exe** |
| Repos at | `K:\` | `D:\Public`, shared as `\\morty\Public`, mapped as `Z:` on the PC |
| Reach it | this is where an agent runs | `ssh morty` (key auth, `morty-key.pub` on the share); the share through `/z/` in Git Bash |
| Role | **the agent's sandbox**: develop and test here | **where the user works**: the user only uses Morty |
| Home LAN | `192.168.1.0/24`, never the internet | same |

**The rule:** an agent develops and tests on the PC, then pushes the change to Morty, and the user works only on Morty. A result that exists only on the PC is not done. After any change, check Morty from the command line (`curl http://192.168.1.111:<port>/`, the Library API, `git`, `ssh morty`). **An agent never drives Morty's pages in a browser:** every action there pops up a permission prompt for the user that can't be permanently allowed. Test in a browser on `localhost`, pointing a local server at Morty's Library with `DREAM_LIBRARY` when the data matters, and ask the user to look when something can only be judged by eye.

Not everything runs on both. Morty runs the whole set. The PC runs what an agent started for itself (usually Forge, Library, World, Effects, Characters, Sound, Server; **Paint is usually off**). So `localhost:5250` being dead is normal and means nothing.

## Ports (the same on both machines)

| Port | What | Runs as |
| --- | --- | --- |
| 5170 | Games Portal (landing page, launcher) | `node server.mjs`, in the user's RDP session on Morty |
| 5180 / 5181 | World Builder / its Vite helper | Vite (npm), user's RDP session: leave alone |
| 5190 / 5191 | Skyfall Blade / its Vite helper | Vite (npm), user's RDP session: leave alone |
| 5210 | Dream Forge | `node server.mjs`, Morty session 0 |
| 5230 | Dream Library (the one store; its API) | `node server.mjs`, session 0, needs `DREAM_ADMIN` (below) |
| 5240 (5241) | Dream World, Vite dev server | `node node_modules\vite\bin\vite.js`, session 0 |
| 5250 | Dream Paint | `node server.mjs`, session 0 |
| 5260 | Dream Effects | same |
| 5270 | Dream Characters | same |
| 5310 | Dream Sound | same |
| 5320 | Dream Server (online rooms, WebSocket `/ws`; Dream World reaches it as `/ds`) | same |

Everything binds `0.0.0.0`, so any machine on the LAN can open any port. Morty also has some `netsh interface portproxy` rules (`192.168.1.111:5120`, `:5250`, `:5310` and a run of `105xx` / `107xx` ports forward to `127.0.0.1` of the same number). They belong to the box, not to us: **do not delete them**; they show up as `svchost` (the IP Helper service) owning those listeners, which is why a stray process on a Dream port can look like a duplicate.

## How a page reaches things

- A page never names another host or port. It talks to its **own origin**: the Library is `${location.origin}/dl` (each tool's server forwards `/dl/*` to the Library on `127.0.0.1:5230`, or `DREAM_LIBRARY`), the shared kit is `${location.origin}/common` (served from `dream-common/web`).
- The portal builds every link from the address the page was opened on (`localhost` gives the PC's servers, `192.168.1.111` gives Morty's). **Opening the portal on one machine and a tool on the other is how the user gets "bounced"**: it is not a broken link, the two machines run different sets.
- The tools' "Portal" link and `window.open` links to another tool use the page's own hostname the same way.
- No CORS headers anywhere: pages reach the Library only through their own origin.
- A window's place and size (`window.js`) is remembered per browser **and per address**, so `localhost` and `192.168.1.111` each have their own layout.

## Who may write to the Library

Everyone on the LAN can browse and read. Only the Library machine itself and the addresses in `DREAM_ADMIN` can save, tag or add and drop places. The tools' proxies pass the real client on in `X-Forwarded-For`, believed only when the request comes from loopback.

`DREAM_ADMIN` is comma-separated and takes single addresses or IPv4 CIDR ranges. **Set to `192.168.1.0/24` on Morty** (the whole house network, which includes the PC at `.114`), so a save from any machine works. `gravepain-portal\start-all.bat` uses this value unless `DREAM_ADMIN` is already set. If a save fails with "Only the library machine (or an address in DREAM_ADMIN) can change the library; <address> can browse", the Library was started without it: restart it with it set.

The Library's files (`dream-forge-creations`, a library place, not a git repo) exist on both machines; `start-all.bat` robocopies the newer files each way before it starts the Library, deleting nothing.

The Dream Server has the same rule for publishing, promoting and the GM page, plus an account flagged admin (`node tools/admin.mjs "Name"`, in `dream-server`): `DREAM_ADMIN` comes from `start-all.bat` or `config.json`, which both say `192.168.1.0/24`. It stays on `CONTENT=library` on both machines, so unpublished zones keep playing; to play from live packs, start it with `set "CONTENT=live"`.

## Getting a change onto Morty

1. Edit and test on the PC (`node server.mjs` in the tool's folder; stop any server you started yourself when done).
2. In **every** repo touched (a change to `dream-common` touches every tool, so push it too): commit with the `Co-Authored-By` line, then `git push origin HEAD`.
3. Morty's clone: `git -C /z/<repo> -c safe.directory='*' pull --ff-only` (the share is owned by another Windows user, hence `safe.directory`). `<repo>` is the folder name on Morty (`dream-forge` for the PC's `Dream Forge`).
4. Front-end files (html, css, client js, `/common/`) are read from disk on each request: the user needs only a **hard refresh (Ctrl+F5)**. Dream World's Vite picks up `src/` changes the same way.
5. A **server file** change (`server.mjs`, `serve.mjs`, `vite.config`) needs that server restarted:
   - Find it: `ssh morty 'netstat -ano | findstr LISTENING | findstr ":52"'`, kill it: `ssh morty 'taskkill /F /PID <pid>'`.
   - Start it with a foreground command and a short timeout, **one ssh call per server**, single-quoted so Git Bash keeps the backslashes: `timeout 6 ssh morty 'cd /d D:\Public\dream-paint && node server.mjs'`. The process survives the disconnect. The Library: `... 'cd /d D:\Public\dream-library && set "DREAM_ADMIN=192.168.1.0/24" && node server.mjs'`.
   - `wmic process call create` looks like it worked and then the node exits: do not use it.
6. Verify on Morty by `curl`: the page answers `200` and serves the change. A green dot on the portal is not proof (see below).

## Things that have gone wrong

- **Half-applied pull on a Morty clone** (index.html deleted, other files half new): the page answers 404 while the process is still running. Check `git -C /z/<repo> -c safe.directory='*' status` on Morty after a pull. Fixing it needs `git restore .` there, which the safety check blocks until the user says yes in chat. Seen 2026-10-31 on `dream-library`: the running Library held `public/index.html` open, so the pull could not replace it ("File exists"); stopping the server released it. When a pull replaces a page, stop that server first.
- **Portal status dots** used to count any reply as "Running", a 404 included. The portal now loads each Dream tool's `common/ui/theme.css` to tell a working tool from something else answering its port (the Library, World Builder and Skyfall still use a plain reachability check).
- **Dev PC state is not the user's state**: window layouts, saved scenes and the Library files are per machine. Compare on Morty.
- **A server started over SSH died at its next log line.** Seen 2026-10-31: once the SSH session ends its output pipe is closed, and the first write to it (for the Dream Server, the first player to join) killed the process with no message. Every server now ignores errors on stdout and stderr; keep that in any new one. To see a server's output on Morty, redirect it to a file there.
- Windows may print "LF will be replaced by CRLF": harmless.
- An agent cannot create a GitHub repo (the classifier refuses); the user creates it empty, then add the remote and push.
- Heredocs in Git Bash mangle backslashes on this machine: patch files with a script written by the Write tool.

## See also

`CLAUDE.md` (the map of the series), `docs/publishing.md` (the three-places rule), `docs/hosting-plan.md` (a VPS plan, parked while everything is LAN-only).
