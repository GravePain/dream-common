# Dream common

What the Dream tools share. It sits next to the other Dream folders (`K:\` here, `D:\Public` on Morty) and they reach it by relative path, so there is nothing to install.

## serve.mjs

The one static server. Each tool's `server.mjs` is three lines:

```js
import { serveFolder } from '../dream-common/serve.mjs';
serveFolder(import.meta.url, { name: 'Dream Paint', port: 5250 });
```

- Serves the tool's folder on all network interfaces; dot folders (`.git`, `.claude`) and paths outside the folder are 404.
- `/dl/*` is passed to the Dream Library (`http://127.0.0.1:5230`, or `DREAM_LIBRARY`), so a page only talks to its own origin.
- `/common/*` serves this folder, for browser-side files the tools will share.
- A server fix is made here once, for every tool.

If a tool says it cannot find `../dream-common/serve.mjs`, clone this repo beside it.

## docs/

Notes that belong to the series rather than one tool: reviews, the publish flow, how the tools fit together.

## Ports

| Tool | Port |
| --- | --- |
| Portal | 5170 |
| Dream Forge | 5210 |
| Dream Library | 5230 |
| Dream World | 5240 |
| Dream Paint | 5250 |
| Dream Effects | 5260 |
| Dream Characters | 5270 |
