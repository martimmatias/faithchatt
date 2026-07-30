# Jail feature end-to-end test

Automates what used to be a manual check: jail a member, poke at the ticket,
close it, and confirm the bot did the right thing at every step. It runs the
real command code in `bot_modules/jail/commands/mod/*.js` against a real
Discord test server and a real MongoDB - nothing about the jail feature
itself is mocked.

## What it exercises

`jail-lifecycle.e2e.test.js` runs, in order, against one throwaway "target"
account:

1. **`/jail`** - strips the target's roles, mutes them, opens a ticket
   channel in the jail category, and writes a database record. Checked:
   the database record, the muted/member role flip, and every permission
   overwrite on the new channel (target, muted role, member role,
   moderator role, `@everyone`).
2. **A second `/jail`** on the same already-jailed member - checked: it's
   rejected with the "already jailed" error and doesn't touch the existing
   ticket.
3. **Manipulating the ticket** - a message is posted in it, then
   **`/closejail`** - checked: the transcript logged to the jail-log channel
   before deletion includes that message, the database record is gone
   immediately, and the ticket channel itself is deleted (closejail waits
   5s before deleting, so this part of the test takes a few seconds).
4. **`/unjail`** (run against a fresh jail cycle) - checked: roles are
   restored, the database record is gone, and - unlike `/closejail` - the
   ticket channel is left in place.

Not covered: the "recreate a missing ticket channel for an already-jailed
member" recovery path in `jail.js`, and the guild-member-leaves/rejoins
behavior in `bot_modules/jail/events/*` (both would need disruptive extra
setup - kicking/re-inviting the target account - for comparatively low
value; happy to add if you want them).

## Why this needs a real test server

Every role/channel/category ID the jail module touches
(`variables/Roles.js`, `variables/TextChannel.js`, `variables/Categories.js`)
is hardcoded to the production FaithChatt server - the README already warns
"this will not work properly on other servers". The test never touches
those files or that server: `helpers/mockVariables.js` seeds
`require.cache` with your test server's IDs before the jail commands are
first required, so the exact same command code runs against whatever
server you point it at.

The interaction itself is faked (see `helpers/fakeInteraction.js`) - there's
no way to script an actual Discord slash-command invocation without a real
user/self-bot session, which is against Discord's ToS. Only `reply()` /
`followUp()` are stubbed; the guild, channel, member, and role objects the
commands operate on are all real, live Discord objects, and the database
writes go to a real MongoDB.

## One-time setup

1. Create (or reuse) a small Discord test server and a **separate** bot
   application/token for it - don't reuse your production bot's token
   against this server, and don't run this against the production server.
2. Enable the **Server Members Intent** and **Message Content Intent** for
   that bot in the Discord Developer Portal (Bot page) - the jail commands
   read/write member roles and the test reads message content back out of
   the transcript.
3. Invite the bot with `Manage Roles`, `Manage Channels`, and `View Audit
   Log`-adjacent permissions (enough to create channels and move roles).
4. On the test server, create:
   - A category for jail tickets.
   - Four roles: `member`, `muted`, `moderator`, `unverified` (names don't
     matter, only the IDs do).
   - Two text channels for the mod log and jail log the commands post to.
5. Add a second, throwaway account to the server for the test to jail -
   a second small bot works well and won't complain about being muted.
   It needs to actually be a guild member before the first run.
6. Copy `test/e2e/e2e.env.example` into your root `.env` and fill in the
   IDs from steps 1-5 (`TOKEN`/`MONGO_URL` are the same variables
   `index.js`/`utils/mongo.js` already read).

## Running it

```
npm run test:e2e
```

With the env vars above unset, the suite reports **skipped** (not failed) -
safe to leave in CI for anyone who hasn't set up a test server. Once your
`.env` is filled in, it exercises the full jail lifecycle against your test
server and MongoDB every time you run it, including automatically in
GitHub Actions if you add the same variables as repository secrets (see
`.github/workflows/e2e.yml`).
