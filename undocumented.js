const CHANNELS_TO_INVITE=["C0266FRGV", "C0C78SG9L","C01D7AHKMPF","C08Q1H6D79B","C073L9LB4K1", "C056WDR3MQR"]

export async function handleMCGInvite(client,env,user,alreadyCheckedEmails) {
       const userProfile = await client.users.info({ user })
  const { team_id } = userProfile.user

  if (
    !userProfile.user.is_restricted &&
    !userProfile.user.is_ultra_restricted
  ) {
    console.log(`User ${user} is already a full user– skipping`)
    alreadyCheckedEmails.push(user)
    return false;
  }

  const cookieValue = `d=${env.SLACK_XOXD}`

  // Create a new Headers object
  const headers = new Headers()

  // Add the cookie to the headers
  headers.append('Cookie', cookieValue)
  headers.append('Content-Type', 'application/json')
  headers.append('Authorization', `Bearer ${env.SLACK_XOXC}`)

  const form = JSON.stringify({
    user: user,
   token: env.SLACK_XOXC
//    team_id,
  })
console.log(form)
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
  alreadyCheckedEmails.push(user)
  inviteToChannels(client, user)
  if(env.GARDENS_URL) {
    fetch(env.GARDENS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: user })
    }).catch(e=>{})
  }
  uptimeSanityCheck(client, env, user);
  return true;
}
async function inviteToChannels(client, user) {
  for(const channel of CHANNELS_TO_INVITE) {
    try {
      const res = await client.conversations.invite({
        channel,
        users: user,
      });
      console.log(`Invited ${user} to channel ${channel}:`, res);
    } catch (error) {
      console.error(`Error inviting ${user} to channel ${channel}:`, error);
      if (error.data && error.data.error === 'already_in_channel') {
        console.log(`${user} is already in channel ${channel}`);
      } else {
        console.error(`Failed to invite ${user} to channel ${channel}:`, error);
      }
    }
    await new Promise(r=>setTimeout(r,100))
  }
}
async function uptimeSanityCheck(client, env, userID) {
      const userProfile = await client.users.info({ user })
  if (
    !userProfile.user.is_restricted &&
    !userProfile.user.is_ultra_restricted
  ) {
    console.log(`User ${userID} is already a full user– skipping`)
    // return;
    fetch(env.UPTIME_URL_THING).catch(e=>{})
  }

}