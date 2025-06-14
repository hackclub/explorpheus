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
    user:req.body.slack_id,
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
  uptimeSanityCheck(client, env, user);
  return true;
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