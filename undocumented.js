// also shamlesslyy stolen from arrpheus
// Invite an email to Slack. Uses an undocumented Slack API endpoint.
// Adapted from https://github.com/hackclub/arcadius/blob/main/src/functions/slack/inviteUser.ts

const blog = console.log;

export async function inviteGuestToSlackToriel({ email, channels, env }) {
    // This is an undocumented API method found in https://github.com/ErikKalkoken/slackApiDoc/pull/70
  // Unlike the documention in that PR, we're driving it not with a legacy token but a browser storage+cookie pair

  // The SLACK_COOKIE is a xoxd-* token found in browser cookies under the key 'd'
  // The SLACK_BROWSER_TOKEN is a xoxc-* token found in browser local storage using this script: https://gist.github.com/maxwofford/5779ea072a5485ae3b324f03bc5738e1

  // I haven't yet found out how to add custom messages, so those are ignored for now
  const cookieValue = `d=${env.SLACK_XOXD}`

  // Create a new Headers object
  const headers = new Headers()

  // Add the cookie to the headers
  headers.append('Cookie', cookieValue)
  headers.append('Content-Type', 'application/json')
  headers.append('Authorization', `Bearer ${env.SLACK_XOXC}`)

  const data = JSON.stringify({
    token: env.SLACK_XOC,
    invites: [
      {
        email,
        type: 'restricted',
        mode: 'manual',
      },
    ],
    restricted: true,
    channels,
  })

  const r = await fetch(`https://slack.com/api/users.admin.inviteBulk`, {
    headers,
    method: 'POST',
    body: data,
  })
  console.log("Got response:")
  console.log(r)
  console.log("Response JSON:")
  const j = await r.json()
  console.log(j)
  if (!j.ok) {
    throw new Error(`Slack API general error: ${j.error}`)
  }
  if (!j["invites"] || j["invites"].length === 0) {
    throw new Error(`Slack API error: successful but no invites`)
  }
  if (!j["invites"][0]["ok"]) {
    throw new Error(`Slack API error on invite: ${j["invites"][0]["error"]}`)
  }
  return { ok: true }
}

export async function inviteSlackUser({ email, channels, env }) {
    try {
        console.log(`Inviting ${email} to Slack...`);
        const result = await inviteGuestToSlackToriel({ email, channels, env })
        console.log(`Invited ${email} to Slack!`);
        blog(`Invited ${email} to Slack!`, "info");
        return { ok: result["ok"] };

    } catch (e) {
        blog(`Error in inviteSlackUser: ${e}`, "error");
        return { ok: false, error: e.message };
    }
}

export async function upgradeUser(client, user, channels, env) {
  const userProfile = await client.users.info({ user })
  const { team_id } = userProfile.user

  if (
    !userProfile.user.is_restricted &&
    !userProfile.user.is_ultra_restricted
  ) {
    console.log(`User ${user} is already a full user– skipping`)
    return { ok: false, error: 'User is already a full user' }
  }
  const startPerf = Date.now()
  console.log(`Attempting to upgrade user ${user}`)

  // @msw: This endpoint is undocumented. It's usage and token were taken from
  // inspecting the network traffic while upgrading a user. It's the result of
  // trial and error replicating the browser calls Slack's admin dashboard
  // makes, so duplicate fields (ie. putting user in the URL and JSON body) were
  // found necessary get a 200 OK from Slack.

  // The SLACK_COOKIE is a xoxd-* token found in browser cookies under the key 'd'
  // The SLACK_BROWSER_TOKEN is a xoxc-* token found in browser local storage using this script: https://gist.github.com/maxwofford/5779ea072a5485ae3b324f03bc5738e1

  const cookieValue = `d=${env.SLACK_XOXD}`

  // Create a new Headers object
  const headers = new Headers()

  // Add the cookie to the headers
  headers.append('Cookie', cookieValue)
  headers.append('Content-Type', 'application/json')
  headers.append('Authorization', `Bearer ${env.SLACK_XOXC}`)

  const form = JSON.stringify({
    user,
    team_id,
  })
  const r = await fetch(
    `https://slack.com/api/users.admin.setRegular?slack_route=${team_id}&user=${user}`,
    {
      headers,
      method: 'POST',
      body: form,
    }
  )
  const j = await r.json()
  console.log('Got promotion response:')
  console.log(JSON.stringify(j, null, 2))
  console.log(`Inviting user to ${channels.length} channels...`)
  const indivChannels = channels.split(',')
  for (const channel of indivChannels) {
    console.log(`Inviting user to ${channel}...`)
    try {
      await client.conversations.invite({ channel, users: user })
    } catch (e) {
      console.error(`Error inviting user to ${channel}: ${e}`)
      if (e.data.error.includes('not_in_channel')) {
        console.log(`attempting to join ${channel}...`)
        await client.conversations.join({ channel })
        console.log(`joined ${channel}`)
        try {
          await client.conversations.invite({ channel, users: user })
        } catch (e) {
          console.error(`Error inviting user to ${channel}, even after joining: ${e}`)
        }
      }
    }
  }
  console.log(`User ${user} upgraded in ${Date.now() - startPerf}ms`)
  return j
}

export async function inviteMCGToChannel(client, user, channel) {
  const userProfile = await client.users.info({ user })
  const { team_id } = userProfile.user

  const cookieValue = `d=${env.SLACK_XOXD}`

  // Create a new Headers object
  const headers = new Headers()

  // Add the cookie to the headers
  headers.append('Cookie', cookieValue)
  headers.append('Content-Type', 'application/json')
  headers.append('Authorization', `Bearer ${env.SLACK_XOXC}`)
  const form = JSON.stringify({
    token: env.SLACK_XOXC,
    users: user,
    channel,
    invite_all: false,
    force: true,
  })
  const r = await fetch(
    `https://slack.com/api/conversations.invite?slack_route=${team_id}`,
    {
      headers,
      method: 'POST',
      body: form,
    }
  )
  const j = await r.json()
  console.log('Got MCG invite response:')
  console.log(JSON.stringify(j, null, 2))
  return j
}