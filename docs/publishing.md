# Publishing a Dream repo

Every Dream repo lives in three places: the working copy under `K:\`, GitHub (`GravePain` org, private), and the house server Morty (`\morty\Public`, mapped as `Z:`; `D:\Public` on the box, SSH alias `morty`, cmd.exe).

1. Commit in the working copy.
2. `git push origin main`
3. `git -C /z/<repo> -c safe.directory='*' pull --ff-only` (the share is owned by another Windows user, hence `safe.directory`).

Morty's copies are plain clones tracking GitHub. Running servers do not pick up server changes until restarted (`gravepain-portal\start-all.bat`).
