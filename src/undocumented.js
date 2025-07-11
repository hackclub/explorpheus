const CHANNELS_TO_INVITE = [
  "C0266FRGV",
  "C0C78SG9L",
  "C01D7AHKMPF",
  "C08Q1H6D79B",
  "C073L9LB4K1",
  "C056WDR3MQR",
  "C05B6DBN802",
  "C0M8PUPU6",
  "C016DEDUL87",
  "C75M7C0SY",
];

export async function handleMCGInvite(client, env, user, alreadyCheckedEmails) {
  const BANNED_USERS = env.BANNED_USERS ? env.BANNED_USERS.split(",") : [];
  const userProfile = await client.users.info({ user });
  const { team_id } = userProfile.user;

  if (
    (!userProfile.user.is_restricted &&
      !userProfile.user.is_ultra_restricted) ||
    BANNED_USERS.includes(user)
  ) {
    // console.log(`User ${user} is already a full user– or banned. skipping`);
    alreadyCheckedEmails.push(user);
    return false;
  }

  const cookieValue = `d=${env.SLACK_XOXD}`;

  // Create a new Headers object
  const headers = new Headers();

  // Add the cookie to the headers
  headers.append("Cookie", cookieValue);
  headers.append("Content-Type", "application/json");
  headers.append("Authorization", `Bearer ${env.SLACK_XOXC}`);

  const form = JSON.stringify({
    user: user,
    token: env.SLACK_XOXC,
    //    team_id,
  });
  console.log(form);
  const r = await fetch(
    `https://slack.com/api/users.admin.setRegular?slack_route=${team_id}&user=${user}`,
    {
      headers,
      method: "POST",
      body: form,
    },
  );
  const j = await r.json();
  console.log("Got promotion response:");
  console.log(JSON.stringify(j, null, 2));
  alreadyCheckedEmails.push(user);
  try {
    client.chat.postMessage({
      channel: `C091XDSB68G`, // Channel ID for the admin channel
      text: `User <@${user}> has been promoted to a full user.`,
    });
  } catch (error) {
    console.error("Error posting message to admin channel:", error);
  }
  // if(env.GARDENS_URL) {
  fetch(env.GARDENS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: user }),
  });
  await new Promise((r) => setTimeout(r, 1000));
  inviteToChannels(client, user).catch((e) => console.error(e));
  // }
  uptimeSanityCheck(client, env, user);
  return true;
}
export async function inviteToChannels(client, user) {
  for (const channel of CHANNELS_TO_INVITE) {
    try {
      const res = await client.conversations.invite({
        channel,
        users: user,
      });
      console.log(`Invited ${user} to channel ${channel}:`, res);
      await new Promise((r) => setTimeout(r, 500)); // Wait for 1 second before next invite
    } catch (error) {
      console.error(`Error inviting ${user} to channel ${channel}:`, error);
      if (error.data && error.data.error === "already_in_channel") {
        console.log(`${user} is already in channel ${channel}`);
      } else {
        console.error(`Failed to invite ${user} to channel ${channel}:`, error);
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}
async function uptimeSanityCheck(client, env, user) {
  const userProfile = await client.users.info({ user });
  if (
    !userProfile.user.is_restricted &&
    !userProfile.user.is_ultra_restricted
  ) {
    console.log(`User ${user} is already a full user– skipping`);
    // return;
    fetch(env.UPTIME_URL_THING).catch((e) => {});
  }
}
export async function handleTeamJoinThing(
  client,
  airtable,
  env,
  last_5_users,
  user,
) {
  // get user email
  const info = await client.users
    .info({ user: user })
    .then((d) => d.user.profile);
  const checkOnServersBackend = await fetch(
    `https://${env.DOMAIN_OF_HOST}/explorpheus/magic-link?token=${env.API_KEY}&email=${encodeURIComponent(info.email)}&slack_id=${user}`,
    {
      method: "POST",
      headers: {
        "User-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36",
        "X-Is-explorpheus": "rowan"
      }
    },
  );
  const text = await checkOnServersBackend.text();
  console.debug(text);

  if (
    checkOnServersBackend.status == 400 ||
    checkOnServersBackend.status == 204
  ) {
    // not my problem
    // fun fact this had ran when status was 200 idk why plz kill me
    console.log("bad - ", checkOnServersBackend.status, info.email, user);
    last_5_users.unshift({
      id: user,
      date: Date.now(),
      got_verified: false,
    });
    try {
      await client.chat.postMessage({
        channel: `C091XDSB68G`,
        text: `User <@${user}> tried to join but was not verified`,
      });
    } catch (e) {}
    last_5_users = last_5_users.slice(0, 5);
    return;
  }
  last_5_users.unshift({
    id: user,
    date: Date.now(),
    got_verified: true,
  });
  last_5_users = last_5_users.slice(0, 5);
  const json = await JSON.parse(text);
  const UA = json.user_agent || "No UA";
  const IP = json.ip || "0.0.0.0/24";
  let MAGIC_LINK = json.link || "https://saahild.com/";
  if (
    MAGIC_LINK == "https://summer.hackclub.com/magic-link?token=" ||
    MAGIC_LINK == "https://saahild.com/"
  ) {
    try {
      await client.chat.postMessage({
        channel: `C091XDSB68G`,
        text: `User <@${user}> has a bugged url!! ${MAGIC_URL} cc <@U07L45W79E1> <@U03DFNYGPCN>`,
      });
    } catch (e) {}
  }
  // dm them
  const textContent = `~1. Join Slack~\n*2. <${MAGIC_LINK}|Set up your account>* ← _YOU ARE HERE_\n3. Build a project\n4. :sparkles:Get prizes:sparkles: ԅ(◕‿◕ԅ)`;
  const blocksContent = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "~1. Join Slack~\n*2. Set up your account* ← _YOU ARE HERE_\n3. Build a project\n4. :sparkles:Get prizes:sparkles: ԅ(◕‿◕ԅ)",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: ":som-point-right-animated: SET UP YOUR ACCOUNT :som-point-left-animated:",
            emoji: true,
          },
          value: "meow",
          url: MAGIC_LINK,
          action_id: "button-action",
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Questions?* Read the <https://hackclub.slack.com/docs/T0266FRGM/F090MQF0H2Q|FAQ > first, if you have something *which is not on the faq* head to <#C090JKDJYN8>!`,
      },
    },
  ];

  fetch("https://app.loops.so/api/v1/transactional", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.LOOPS_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: info.email,
      transactionalId: env.LOOPS_ID,
      addToAudience: true,
      dataVariables: {
        auth_link: MAGIC_LINK,
      },
    }),
  })
    .then((d) => d.text())
    .then(console.log)
    .catch(console.error);
  const msgs = await Promise.all([
    client.chat.postMessage({
      channel: user,
      blocks: blocksContent,
      token: env.SLACK_XOXP,
    }),
    client.chat.postMessage({
      channel: user,
      text: textContent,
      blocks: blocksContent,
      username: "Explorpheus",
      icon_url:
        "https://hc-cdn.hel1.your-objectstorage.com/s/v3/d6d828d6ba656d09a62add59dc07e2974bfdb38f_image.png",
    }),
  ]);
  // update airtable by creating a record
  await airtable
    .createBulk(
      [
        {
          fields: {
            Email: info.email,
            "Slack ID": user,
            // message_link_sent_to_user: await aclient.client.chat.getPermalink({
            //     channel: msg.channel,
            //     message_ts: msg.ts,
            // }).then(d=>d.permalink)
            magic_link: MAGIC_LINK,
            // dummy data for now ;-;
            "User Agent": UA,
            "Form Submission IP": IP,
          },
        },
      ],
      "Explorpheus/1.0.0 create user",
      env.JR_BASE_ID,
      "SoM 25 Joins",
    )
    .then((d) => console.log(d))
    .catch((e) => console.error(e));

  try {
    await client.chat.postMessage({
      channel: `C091XDSB68G`,
      text: `User <@${user}> invited successfully`,
    });
  } catch (e) {}
}
