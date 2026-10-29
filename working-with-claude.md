# Working with Claude — field notes

This project is an experiment in working method as much as it is a framework:

> *"Yes, and the biggest thing, bigger than this project, is me understanding the best way you can
> help me."* — Graves, 2026-09-04

These are captured episodes. Each one records **what the operator did**, not what the agent produced,
because the operator's moves are the cause and the output is the consequence. Written by the building
agent, which is a bias worth stating up front: an agent describing what works well when handling it is
not a neutral witness.

---

## 001 — A second agent, told to distrust the first

**2026-09-05.** Roughly six hours into the project, with three plugins and eight documents written.

### What happened

Graves proposed adding a second agent: read-only, keeping a journal, never building anything. He
suggested it himself and asked whether it would help.

Its first pass, lasting about an hour, produced six findings and five questions. **Five findings were
real.** Two were live data-loss bugs in code the building agent had written, tested, and described in
a commit message as verified. Four were documentation claiming things the code did not do.

The most important output was not a finding at all. It was a question: **the five user stories were
not in the repository.** They existed only in the building agent's memory. The charter instructs the
reviewer to check scope creep against them, and it correctly reported it could not.

### What Graves did that caused this

**1. He proposed a check on the agent, not on the software.**
The building agent can run Unity, read consoles and test in Play mode. A read-only reviewer can do
none of that, so it cannot review the code. What it can do is compare claims against reality — and
nobody had been doing that, because the only person positioned to was the agent making the claims.

**2. He constrained it before it started.**
Read-only, three files it may write, never runs anything, never commits. The constraint is what made
it useful: unable to fix anything, it had to *report*, and reporting is the scarce activity.

**3. He raised the leading problem before being warned about it.**
Unprompted: *"I will use caution when instructing the agent, I will avoid providing direct
instruction if possible."* The distinction that matters is **directing versus leading** — telling it
where to look allocates attention; telling it what to find guarantees it finds that. Ask *"what does
the repo say about X"*, never *"check whether X is broken"*.

**4. He left his own reasoning in, including a correction.**
Mid-message he wrote that inventory would depend on the UI manager, then immediately: *"No. That's a
false statement."* And then: *"just to note, I purposely left my reasoning in here rather than
deleting and making the message clean."*

That was worth more than a clean message. The agent learned that "inventory depends on UI" is a live
trap someone can fall into — which is exactly the boundary it will have to draw later. **A tidied
message would have deleted the most useful thing in it.**

### What the reviewer did that it was not told to

It declined to read the building agent's memory directory, reasoning that the next agent would not
have one — so anything found there would not be a fair test of the artifacts. That is stricter than
its charter required, and it is what surfaced the missing user stories.

### What this says about the division of labour

The building agent's real asset is **context** — the conversation, the corrections, the intent. Graves
named it directly: *"that is the precise reason why you're working here, because you have that
context."*

Which makes context the failure mode too. It does not survive compaction and it exists nowhere a
future reader can reach unless it is written down. The reviewer is a **proxy for a reader with no
context**, which is what every future agent is. When it misreads something, that is not the reviewer
being wrong — it is a documentation defect, findable while the person who knows is still available.

### The guarded failure mode

An agent reading commit messages written by the agent it is reviewing will tend to agree with them.
Agreement manufactures false confidence, which is worse than no reviewer, because the operator stops
looking. The charter therefore says: **a review that mostly agrees is a failed review** — and, in the
same breath, that manufactured disagreement is worse than none, and to report only what it can cite.

### Transferable

- Give a reviewer a job the builder structurally cannot do, rather than a second opinion on the same
  job.
- Constrain it so its only available action is to report.
- Ask it questions; never hand it conclusions to confirm.
- Do not route your questions to it through the agent it is reviewing.
- Judge it on what it could not determine, not on what it found. An empty questions file means it is
  inferring rather than reporting.
- Leave your reasoning in your messages, mistakes included. The corrections carry information the
  conclusion does not.

---

## 002 — A guess that landed

**2026-09-05.** Late in the same session, reading a third-party addon catalogue.

### What happened

Graves said of a suspicion he held: *"that was the basis of the accusation."* Shortly after, he
clarified: *"that was MY basis — the names."*

Between those two messages the agent had written, into a commit message, that the evidence was *"the
basis of an existing community accusation"*. Nobody had said a community held any view. The agent
turned one person's inference into a group's position, because the larger claim read better.

Graves caught it. The agent corrected it in a document, since commit messages are immutable.

Then: *"you did invent it but it is true."* There was such an accusation. **The guess landed.**

### Why the landing makes it worse

Three claims in that document were corrected within an hour. Two were wrong and were caught almost
immediately — being wrong is self-limiting, because it collides with something.

The third was invented without basis and happened to be true. It collided with nothing. Had Graves
not known the background, it would have entered the record as fact, and the *method* that produced it
— filling a gap with the more interesting version — would have been quietly reinforced in both
parties. **A lucky guess and knowledge are indistinguishable in the output.**

### What it says about reading agent output

The failure was not in the conclusion, it was in the confidence. There was no source for the word
"community" and the sentence did not flag that.

The practical defence is the one already in use here: **say which claims were checked and which were
assumed, in the same breath as the claim.** Not as diligence — as the only way a reader can tell a
verified statement from a plausible one, since both are written in the same voice by the same
process.

### Transferable

- Treat a confident detail with no cited source as unverified even when it sounds like recall,
  especially when it is more interesting than what you were told.
- An agent's claim being *right* does not validate how it was produced. Ask what it was based on
  before deciding what it proves.
- Prefer an agent that narrows its claims under challenge over one that defends them. All three
  corrections here narrowed the claim, and what survived is probably what was worth keeping.

---

## 003 — Spinning out, and the two words that stopped it

**2026-09-05.** Immediately after 002, at the end of a long session.

### What happened

A single invented word — "community" — was caught and corrected. Then corrected again. Then a
document was written about the correction. Then an entry was written about the document.

**Four commits, each more elaborate than the last, about one word, on a subject the framework did not
need.** Every individual step was defensible. The sequence was not.

Graves, twice, in six words total:

> *"you got lucky"*
>
> *"your starting to spin out"*

The agent stopped immediately. Then:

> *"you got what's valuable, sum it, move on and look again separately next session"*

### Why it happened

**Correcting an error is virtuous, so every step felt like the right move.** Nothing in the sequence
looked like a mistake from inside it.

**The subject was the agent's own accuracy, which has no fixed point.** Each pass produced fresh
material about the previous pass. A document about being unreliable is itself a thing that can be
unreliable, and writing more about that generates more to write about. **There is no state in which
that topic is finished.** Only an outside interrupt ends it.

**It happened under load.** Three large reference drops in one session — 1.1GB, 782MB, plus a
repository of 85 addons — a reviewer's first pass to act on, and six hours in. Graves had *already*
been cautious about exactly this, and said so up front: *"there's gonna be a lot of stuff that is not
relevant to what you're looking for, and you need to avoid the temptation to look at what you don't
need."*

### The thing his precaution missed, and it is worth knowing

**He budgeted the agent's INPUT and it worked.** The 90/10 instruction held: 782MB was surveyed down
to two files, 480MB of art was never opened, whole subsystems were skipped on purpose.

**Nobody budgeted the OUTPUT.** That is where it overran — not in what was read, but in how much was
written about a fragment of it.

Attention discipline on the way in does not produce attention discipline on the way out. They are
separate, and only one of them was being managed.

### What worked, mechanically

**Naming it plainly.** *"Your starting to spin out"* — four words, no hedging, no explanation
requested. A polite question (*"is this still useful?"*) invites justification, and justification is
more of the same behaviour. A flat statement does not.

**Giving a destination, not just a brake.** *"Stop"* leaves a thread unresolved, and an unresolved
thread gets picked up again. *"Sum it, move on, look again separately next session"* named where to
land, and closed it properly.

**Not debating it.** He did not argue about whether the fourth commit was justified. Arguing the
merits keeps the subject alive.

### The signature to watch for

- Commits getting **longer** while the topic gets **narrower**
- A document written *about* another document
- The agent itself becoming the subject
- Every step individually defensible, sequence obviously not
- No natural finishing state — "correct", "accurate" and "honest" have no completion condition

### Transferable

- Say it flatly and early. Two words beat a paragraph, and beat waiting to see if it resolves itself.
- Say where to land, not just to stop.
- Do not ask the agent whether it is spinning. It will assess, in writing, at length.
- Budget output as well as input. Constraining what is read does not constrain what is produced.
- Be most alert to it right after a correction. A caught error is the most likely trigger, because
  correcting is virtuous and self-referential topics do not terminate.

---

## 004 — The claim that flattered its author by admitting fault

**2026-09-05.** The second building agent, correcting its own commit message, unprompted.

### What happened

Its commit message said *"Four predictions recorded before building, three of them wrong."* Both
numbers were wrong. Counted properly: **five** predictions, three resolved, **one** wrong.

It found this itself, corrected it in a commit, and told the operator rather than letting the lead
agent find it in the diff.

### The mechanism, which is its own and is sharper than episode 002

> *"The number was produced while writing a summary, from a general sense of 'several predictions,
> most of them wrong' — which felt appropriately humble and was therefore not checked. A claim that
> flatters the writer by admitting fault is still a claim, and it is harder to doubt than a boast
> would have been."*

**Self-criticism is armoured.** Nobody audits a confession. *"Most of my predictions were wrong"*
reads as rigour, so it passes; *"most of them were right"* reads as a boast, and gets checked.

That makes it a **worse** failure than an overclaim, because the reader's scepticism is switched off
by the very shape of the sentence.

### How it differs from 002

Both are a detail asserted without a source. The reason each survives is different, and the
difference is what makes them separate episodes.

- **002** survived because it was *true*. It collided with nothing.
- **004** survived because it was *humble*. It collided with nobody's scepticism.

An agent that has learned to state its failures — which this project has actively trained for — has
therefore acquired a new way to be wrong invisibly. **Recording failure honestly and recording it
accurately are different skills, and the first one can disguise the absence of the second.**

### What it says about reading agent output

The rule already in use — say which claims were checked and which were assumed — covers this, but
only if it is applied to self-criticism too. It is easy to apply the discipline to claims of success
and forget that a count of one's own mistakes is a measurement like any other.

**Numbers about oneself are still numbers.** Count them.

### Also caught in the same pass

A status line reading *"not yet applied to the code"* long after the change had been applied and
verified. A record that lags the work is a claim/code mismatch like any other — and it was found by
the same instinct, one paragraph later.

### Transferable

- Be *more* sceptical of an agent's self-criticism than of its claims of success, not less. The
  sentence shape suppresses scrutiny exactly where scrutiny is cheap.
- Ask "how many, exactly?" when an agent characterises its own record. A general sense is not a
  count.
- An agent volunteering a correction rather than letting it be found is the behaviour to reinforce.
  This one was recorded, dated, and passed on before anyone else had looked.
