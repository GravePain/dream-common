# Publishing a Dream repo

Every Dream repo lives in three places: the working copy under `K:\`, GitHub (`GravePain` org, private), and the house server Morty (`\morty\Public`, mapped as `Z:`; `D:\Public` on the box, SSH alias `morty`, cmd.exe).

1. Commit in the working copy.
2. `git push origin main`
3. `git -C /z/<repo> -c safe.directory='*' pull --ff-only` (the share is owned by another Windows user, hence `safe.directory`).

Morty's copies are plain clones tracking GitHub. Running servers do not pick up server changes until restarted (`gravepain-portal\start-all.bat`).

## The Library's files

The Library's content (`K:\dream-forge-creations` here, `D:\Public\dream-forge-creations` on Morty) is not a git repo. `gravepain-portal\start-all.bat` syncs the two with robocopy before it starts the Library: each side's newer files go to the other, nothing is deleted. So a piece saved on either side appears on both after the next start; a piece deleted on one side comes back from the other.
