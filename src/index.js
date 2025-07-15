import "dotenv/config";
import express from "express";
// import { WebClient } from "@slack/web-api"
const App = await import("@slack/bolt");
// console.log([App.default])
import { handleMCGInvite, handleTeamJoinThing } from "./undocumented.js";
import { z } from "zod";
import { AirtableFetch } from "./airtableFetch.js";
import JSONDb from "simple-json-db";
import expressStatusMonitor from "express-status-monitor";
import Keyv from "keyv";
import KeyvPostgres from "@keyv/postgres";
import { Pool } from "pg";

const keyv = new Keyv(new KeyvPostgres(process.env.PG_CONNECTION_STRING));
const sompg = new Pool({
  connectionString: process.env.PG_CONNECTION_STRING_SOM,
});

import envSchema from "./env.js";
const db = new JSONDb("./db.json");
let try_again = db.get("try_again") || [];
let alreadyCheckedEmails = [];
let env0 = envSchema.safeParse(process.env);
if (env0.error) {
  throw env0.error;
}
const env = env0.data;
// stats vars
let last_5_users = [];
let users_joined = 0;
let users_joined_but_valid = 0;
let upgrade_endpoint_hit_count = 0;
let upgraded_users = 0;
let user_last_upgraded_at = Date.now();
let user_last_joined_at = Date.now();
let user_last_joined_at_confirmed = Date.now();
let user_upgrade_endpoint_last_hit = Date.now();
let button_clicks = 0;
let try_agains = 0;
let last_tried_agained = Date.now();
// end stat vars
const receiver = new App.default.ExpressReceiver({
  signingSecret: env.SLACK_SIGNING_SECRET,
  endpoints: "/slack/events",
});
let airtable_under_press = false;
let join_requests_currently = 0;
const aclient = new App.default.App({
  token: env.SLACK_XOXB,
  receiver,
});
const client = aclient.client;
const airtable = new AirtableFetch({
  apiKey: env.AIRTABLE_KEY,
  baseID: env.BASE_ID,
  tableName: "explorpheus",
});
const app = receiver.app;
app.use(express.json());
app.use(
  expressStatusMonitor({
    title: "Explorpheus stability",

    healthChecks: [
      {
        protocol: "https",
        host: env.DOMAIN_OF_HOST,
        path: "/up",
        port: "443",
      },
      {
        protocol: "https",
        host: "explorpheus.hackclub.com",
        path: "/healthcheck",
        port: "443",
      },
      {
        protocol: "https",
        host: "explorpheus.hackclub.com",
        path: "/",
        port: "443",
      },
    ],
  })
);
app.get("/", (req, res) => res.send("hi:3"));

// doTheQueueLoop()
async function sendQueueMessage() {
  // pull all queue messages from airtable lol
  const updateRecords = [];
  const currentRecords = await fetch(
    `https://api.airtable.com/v0/${env.BASE_ID
    }/messages_to_users?filterByFormula=${encodeURIComponent(
      "AND({Automation_-_sent_to_user} = FALSE(), {Send} = TRUE())"
    )}`,
    {
      headers: {
        Authorization: `Bearer ${env.AIRTABLE_KEY}`,
      },
    }
  )
    .then((r) => r.json())
    .then((d) => d.records);
  console.log(`Sending ${currentRecords.length} messages`);
  for (const record of currentRecords) {
    const fields = record.fields;
    if (!fields.to || !fields["Sent by"] || !fields.content) {
      console.error("Invalid record", record);
      continue;
    }
    // send message to user
    try {
      await client.chat.postMessage({
        channel: fields.to,
        text: fields.content + "\n> From " + fields["Sent by"].name,
      });
      updateRecords.push({
        id: record.id,
        fields: {
          "Automation_-_sent_to_user": true,
          Status: "Sent",
        },
      });
    } catch (e) {
      console.error("Failed to send message", e);
    }
  }
  if (updateRecords.length > 0) {
    console.log(`Updating records`);
    await fetch(
      "https://api.airtable.com/v0/" + env.BASE_ID + "/messages_to_users",
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${env.AIRTABLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ records: updateRecords }),
      }
    )
      .then((r) => r.json())
      .then((d) => console.log("Updated records", d));
  }
}
app.get("/healthcheck", async (req, res) => {
  // example db query  (yes ik its a json db ;-;)
  db.set("1", 2);
  let is_fully_ok = false;
  let is_db_ok = false;
  let is_my_db_ok = false;
  let is_som_db_ok = false;
  try {
    is_db_ok = db.get("1") === 2;
    if (is_db_ok) {
      is_fully_ok = true;
    }
  } catch (e) {
    console.error("DB error", e);
  }
  try {
    await keyv.set("test_key", "test_value");
    is_my_db_ok = true;
    if (!is_fully_ok) is_fully_ok = true;
  } catch (e) {
    console.error("Keyv error", e);
    is_fully_ok = false;
    is_my_db_ok = false;
  }
  try {
    await sompg.query("SELECT 1");
    is_som_db_ok = true;
    if (!is_fully_ok) is_fully_ok = true;
  } catch (e) {
    console.error("SOM DB error", e);
    is_som_db_ok = false;
    is_fully_ok = false;
  }
  let is_up = true;
  if (is_fully_ok) {
    res.status(200).json({
      is_up,
      is_db_ok,
      is_fully_ok,
      airtable_under_press,
      is_db_ok,
      is_som_db_ok,
    });
  } else {
    res.status(500).json({
      is_up,
      is_db_ok,
      is_fully_ok,
      airtable_under_press,
      is_db_ok,
      is_som_db_ok,
    });
  }
});
app.post("/content", async (req, res) => {
  const auth = req.headers["authorization"];
  if (auth !== env.SLACK_XOXB) return res.status(401).json({ fed: true });
  console.log(`[REQ] queing time!`);
  await sendQueueMessage();
  res.json({ success: true, message: "queing msgs" });
});

app.post("/verified", async (req, res) => {
  upgrade_endpoint_hit_count++;
  user_upgrade_endpoint_last_hit = Date.now();
  // console.log(req.body)
  if (req.body.token !== env.API_KEY) {
    return res.status(401).end();
  }
  if (alreadyCheckedEmails.includes(req.body.slack_id))
    return res.status(400).end();
  const user = req.body.slack_id;
  // check if user is upgraded already
  const proc = await handleMCGInvite(client, env, user, alreadyCheckedEmails);
  if (!proc) {
    return res.status(403).end();
  }
  upgraded_users++;
  user_last_upgraded_at = Date.now();
  return res.status(200).end();
});

// on team join -> hit bens endpoint -> send magic url -> airtable add.
aclient.event("team_join", async ({ event, context }) => {
  users_joined++;
  user_last_joined_at = Date.now();
  try {
    join_requests_currently++;
    if (join_requests_currently > 4)
      await new Promise((r) => setTimeout(r, 1000));
    if (join_requests_currently > 10) {
      airtable_under_press = true;
    }
    // check if user is for this - if so dm them.
    console.log(event.user.id);
    await handleTeamJoinThing(
      client,
      airtable,
      env,
      last_5_users,
      event.user.id
    );
    last_5_users = last_5_users.slice(0, 5);
    user_last_joined_at_confirmed = Date.now();
    users_joined_but_valid++;
  } catch (e) {
    console.error("Error in team_join event:", e);
    if (e.data && e.data.records) {
      console.error("Airtable error records:", e.data.records);
    }
    // add to try again queue
    try_again.push({
      user: event.user.id,
    });
    db.set("try_again", try_again);
    try_agains++;
    last_tried_agained = Date.now();
    try {
      await client.chat.postMessage({
        channel: `C091XDSB68G`,
        text: `User <@${event.user.id}> thing failed \`${e.message}\` \n\n Will retry later`,
      });
    } catch (e) { }
  }
});

aclient.action("button-action", async ({ body, ack, say }) => {
  button_clicks++;
  await ack();
});
aclient.event("app_home_opened", async ({ event, context }) => {
  const allowed_user_ids = [
    "U0C7B14Q3",
    "UDK5M9Y13",
    "U01MPHKFZ7S",
    "U03DFNYGPCN",
    "U054VC2KM9P",
    "U059VC0UDEU",
    "U05F4B48GBF",
    "U05JNJZJ0BS",
    "U06QK6AG3RD",
    "U079VBNLTPD",
    "U07ACECRYM6",
    "U07AZFQLPQ8",
    "U07E7MG2ST0",
    "U07L45W79E1",
    "U07Q4K6RHM5",
    "U07SX29CECA",
    "U080A3QP42C",
    "U0810GB0HE3",
    "U082DPCGPST",
    "U08B2HD1JNA",
    "U082GTRTR5X",
  ];
  // TODO: add, view actvly added users, option to re sent magic url, option to upgrade user
  if (allowed_user_ids.includes(event.user)) {
    const user_lb_count = (await keyv.get(`users_list`)) || [];
    aclient.client.views.publish({
      user_id: event.user, // the user ID of the user whose home tab is being opened
      view: {
        type: "home",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Hi there <@${event.user}>, here you can promote people to normal users and also send magic links.. below the buttons is the last 5 users who joined..`,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Stats:\n*Users joined*: ${users_joined} (% of valid: ${(
                (users_joined_but_valid / users_joined) *
                100
              ).toFixed(2)}%) (last time event fired: ${new Date(
                user_last_joined_at
              ).toString()} )\n*Users joined but valid*: ${users_joined_but_valid} (users who clicked button: ${(
                (button_clicks / users_joined_but_valid) *
                100
              ).toFixed(2)}%) (last valid one at: ${new Date(
                user_last_joined_at_confirmed
              ).toString()}) \n*Upgrade endpoint hit count*: ${upgrade_endpoint_hit_count} (valid percent: ${(
                (upgraded_users / upgrade_endpoint_hit_count) *
                100
              ).toFixed(2)}) (last time endpoint hit: ${new Date(
                user_upgrade_endpoint_last_hit
              ).toString()}) \n*Upgraded users*: ${upgraded_users} (last hit: ${new Date(
                user_last_upgraded_at
              ).toString()})\n*Button clicks*: ${button_clicks} (last time button clicked: ${new Date(
                button_clicks
              ).toString()})\n*Try agains*: ${try_agains} (last time tried again: ${new Date(
                last_tried_agained
              ).toString()})\n*Last retry looped at*: ${new Date(
                Date.now()
              ).toString()}\n Users opted in to lb: ${user_lb_count.length} `,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Upgrade user",
                  emoji: true,
                },
                value: "upgrade_user",
                action_id: "upgrade_user",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Check if user is on the platform ",
                  emoji: true,
                },
                value: "check_user",
                action_id: "check_user",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Run payouts cache",
                  emoji: true,
                },
                value: "run_payouts_cache",
                action_id: "run_payouts_cache",
              },
            ],
          },
          {
            type: "divider",
          },
          ...last_5_users.map((d) => {
            return {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `<@${d.id}> - ${new Date(d.date).toString()} ${d.got_verified ? ":done:" : ":x:"
                  }`,
              },
            };
          }),
        ],
      },
    });
  } else {
    aclient.client.views.publish({
      user_id: event.user, // the user ID of the user whose home tab is being opened
      view: {
        type: "home",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "hi this isnt for u :>",
            },
          },
        ],
      },
    });
  }
});
aclient.view("upgrade_user", async ({ ack, body, view, context }) => {
  await ack();

  const slackId = view.state.values.slack_id_input.slack_id_action.value;

  // Do something with the Slack ID
  console.log(`Upgrading user with Slack ID: ${slackId}`);
  if (!slackId || slackId.length < 5) {
    await ack({
      response_action: "errors",
      errors: {
        slack_id_input: "Please enter a valid Slack ID.",
      },
    });
    return;
  }
  try {
    await handleMCGInvite(client, env, slackId, alreadyCheckedEmails);
    await aclient.client.chat.postMessage({
      channel: body.user.id,
      text: `<@${slackId}> has been upgraded!`,
    });
    await aclient.client.chat.postMessage({
      channel: `C091XDSB68G`,
      text: `User <@${slackId}> has been upgraded! (_manually by <@${body.user.id}>_)`,
    });
  } catch (error) {
    console.error(error);
    await aclient.client.chat.postMessage({
      channel: body.user.id,
      text: `Failed to upgrade <@${slackId}>. Please check the logs for more details.`,
    });
  }
});

// when someone clicks a button from the list above it opens the modal for such button
aclient.action("upgrade_user", async ({ body, ack, view, context }) => {
  await ack();
  // open modal
  await aclient.client.views.open({
    trigger_id: body.trigger_id,
    view: {
      type: "modal",
      callback_id: "upgrade_user",
      title: {
        type: "plain_text",
        text: "Upgrade User",
      },
      submit: {
        type: "plain_text",
        text: "Upgrade",
      },
      blocks: [
        {
          type: "input",
          block_id: "slack_id_input",
          element: {
            type: "plain_text_input",
            action_id: "slack_id_action",
          },
          label: {
            type: "plain_text",
            text: "Enter user Slack ID",
          },
        },
      ],
    },
  });
});
aclient.view("check_user", async ({ ack, body, view, context }) => {
  await ack();

  const slackId = view.state.values.slack_id_input.slack_id_action.value;

  // Do something with the Slack ID
  console.log(`check user with Slack ID: ${slackId}`);
  if (!slackId || slackId.length < 5) {
    await ack({
      response_action: "errors",
      errors: {
        slack_id_input: "Please enter a valid Slack ID.",
      },
    });
    return;
  }
  const info = await client.users.info({ user: slackId }).catch((e) => {
    console.error("Failed to fetch user info:", e);
    return null;
  });
  if (!info || !info.user) {
    await ack({
      response_action: "errors",
      errors: {
        slack_id_input: "Please enter a valid Slack ID.",
      },
    });
    return;
  }
  const email = info.user.profile.email;
  try {
    const is_on_the_platform = await fetch(
      `https://${env.DOMAIN_OF_HOST}/explorpheus/magic-link?token=${env.API_KEY
      }&email=${encodeURIComponent(email)}&slack_id=${slackId}`,
      {
        method: "POST",
      }
    )
      .then((r) => r.json())
      .then((d) => d.status == 200);
    await aclient.client.chat.postMessage({
      channel: body.user.id,
      text: `<@${slackId}> ${is_on_the_platform ? "is" : "is not"
        } on the platform!`,
    });
    await aclient.client.chat.postMessage({
      channel: `C091XDSB68G`,
      text: `User <@${slackId}> was checked if they were on the platform!(fun fact: ${is_on_the_platform ? "they are on it" : "they are not on it :3"
        })  (_manually by <@${body.user.id}>_)`,
    });
  } catch (error) {
    console.error(error);
  }
});
aclient.action("run_payouts_cache", async ({ body, ack, view, context }) => {
  await ack();
  // open modal
  await queryPayoutsAndUpdateThemUsers();
  await aclient.client.chat.postMessage({
    channel: body.user.id,
    text: `Payouts cache has been updated!`,
  });
  // log this
  await aclient.client.chat.postMessage({
    channel: `C091XDSB68G`,
    text: `Payouts cache has been updated! (_manually by <@${body.user.id}>_)`,
  });
});

aclient.action("check_user", async ({ body, ack, view, context }) => {
  await ack();
  // open modal
  await aclient.client.views.open({
    trigger_id: body.trigger_id,
    view: {
      type: "modal",
      callback_id: "check_user",
      title: {
        type: "plain_text",
        text: "Check User",
      },
      submit: {
        type: "plain_text",
        text: "Check",
      },
      blocks: [
        {
          type: "input",
          block_id: "slack_id_input",
          element: {
            type: "plain_text_input",
            action_id: "slack_id_action",
          },
          label: {
            type: "plain_text",
            text: "Enter user Slack ID",
          },
        },
      ],
    },
  });
});

aclient.start(process.env.PORT).then(() => {
  console.log(`uppies`);
});
app.get("/leaderboard", async (req, res) => {
  try {
    // const users_list = (await keyv.get("users_list")) || [];
    // const users = await keyv.getMany(users_list.map((d) => `user_` + d));
    // res.json(
    //   (users || []).map((d) => {
    //     delete d.channels_to_share_to;
    //     return {
    //       ...d,
    //       payouts: d.payouts.map((dd) => {
    //         return {
    //           amount: dd.amount,
    //           created_at: dd.created_at,
    //           id: dd.id,
    //           payable_type: dd.payable_type,
    //         };
    //       }),
    //     };
    //   })
    // );
    res.json(await keyv.get(`lb_users`))
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: "Failed to fetch leaderboard",
    });
  }
});
function getEmoji(type) {
  switch (type) {
    case "User":
      return "🎁";
    case "ShopOrder":
      return "🛒";
    case "ShipEvent":
      return ":money_with_wings:";
    default:
      return `:x: ${type} :x:`;
  }
}
aclient.command("/som-watch-my-balance", async ({ command, ack, respond }) => {
  await ack();
  // check if user is already in the list
  const userId = command.user_id;
  const slackUserDbEntry = await keyv.get(`user_` + userId);
  if (slackUserDbEntry !== undefined) {
    return respond({
      response_type: "ephemeral",
      text: `:x: You already have setup this! If you want to Opt Out dm @Neon !`,
    });
  }
  // get users SOM id
  const somId = await sompg.query(
    `SELECT id from "users" WHERE "slack_id" = $1`,
    [userId]
  );
  if (somId.rows.length === 0) {
    return respond({
      response_type: "ephemeral",
      text: `:x: You are not on the SOM platform! Please join it first!`,
    });
  }
  const somUserId = somId.rows[0].id;
  // get payouts that already exist from the db
  const payouts = await sompg.query(
    `SELECT * FROM "payouts" WHERE "user_id" = $1`,
    [somUserId]
  );
  // setup DB
  await keyv.set(`user_` + somUserId, {
    slack_id: userId,
    payouts: payouts.rows || [],
    channels_to_share_to: [command.user_id],
    shells: 0, // yea they are starting from 0
  });
  await keyv.set(`user_` + userId, somUserId);
  // add user to users_list
  let users_list = (await keyv.get("users_list")) || [];
  if (!users_list.includes(somUserId)) {
    users_list.push(somUserId);
    await keyv.set("users_list", users_list);
  }
  respond({
    response_type: "ephemeral",
    text: ":done: Congrats you have opted-in! Ill be dming you all your payouts soon! if you want to share payouts in your personal channel run /som-add-channel in that channel to add it!",
  });
});
aclient.command("/som-add-channel", async ({ command, ack, respond }) => {
  await ack();
  const slackRef = await keyv.get(`user_` + command.user_id);
  const channel_id = command.text.trim() || command.channel_id;
  if (slackRef == undefined) {
    return respond({
      response_type: "ephemeral",
      text: `:x: You are not on the SOM platform! Please join it first!`,
    });
  }
  // get som Data Refrence
  const somDbRef = (await keyv.get(`user_` + slackRef)) || {};
  if (somDbRef == undefined) {
    return respond({
      response_type: "ephemeral",
      text: `:x: You are not on the SOM platform! Please join it first! (bork moment)`,
    });
  }
  somDbRef.channels_to_share_to = somDbRef.channels_to_share_to || [];
  // check if channel is already in the list
  if (somDbRef.channels_to_share_to.includes(channel_id)) {
    return respond({
      response_type: "ephemeral",
      text: `:x: This channel is already in the list!`,
    });
  }
  // add channel to the list
  somDbRef.channels_to_share_to.push(
    channel_id.replaceAll("<#", "").replaceAll(">", "")
  );
  await keyv.set(`user_` + slackRef, somDbRef);
  respond({
    response_type: "ephemeral",
    text: `:done: Channel <#${channel_id
      .replace("<#", "")
      .replace(">", "")}> has been added to the list!`,
  });
});
async function queryPayoutsAndUpdateThemUsers() {
  try {
    console.log(`Starting`);
    const users_list = (await keyv.get("users_list")) || [];
    if (users_list.length === 0)
      return console.log("No users to query payouts for");
    const placeholders = users_list.map((_, i) => `$${i + 1}`).join(", ");
    console.log(0);
    const payouts = await new Promise((resolve, reject) => {
      sompg.query(
        // `SELECT * FROM "payouts" WHERE "user_id" IN (${placeholders})`,
        `SELECT * FROM "payouts"`,
        [],
        (err, result) => {
          if (err) return reject(err);
          resolve(result.rows);
        }
      );
    });
    console.log(1);
    console.log(`Found `, payouts);
    // sort payouts into user groups now
    const payoutsByUser = {};
    for (const payout of payouts) {
      payoutsByUser[payout.user_id] = payoutsByUser[payout.user_id] || [];
      payoutsByUser[payout.user_id].push(payout);
    }
    const entries = []
    // now for each user! (WHY)
    for (const [user, payoutsForUser] of Object.entries(payoutsByUser)) {
      // const payoutsForUser = payoutsByUser[user] || [];
      const dbUser = (await keyv.get(`user_` + user)) || {};
      // get the total amount
      const totalAmount = payoutsForUser.reduce(
        (acc, payout) => parseInt(acc) + parseInt(payout.amount),
        0
      );
      const newPayouts = payoutsForUser.filter((d) => {
        return !dbUser.payouts || !dbUser.payouts.some((p) => p.id === d.id);
      });

      if (newPayouts.length > 0) {
        for (const pay of newPayouts) {
          // send them to channel or user or something idk
          const channels_to_share_to = dbUser.channels_to_share_to || [];
          const formated_string = `${getEmoji(pay.payable_type)} ${pay.amount > 0 ? "+" : ""
            }${pay.amount} :shells: were ${pay.amount > 0 ? "added" : "subtracted"
            }, user balance now totaling *${totalAmount}* :shells: (${totalAmount - parseInt(pay.amount)
            } -> ${totalAmount})`;
          if (users_list.includes(user)) {
            for (const channel of [...channels_to_share_to, "C093SV39718"]) {
              try {
                await client.chat.postMessage({
                  channel: channel,
                  text:
                    channel == "C093SV39718"
                      ? `<@${channels_to_share_to[0]}>: ${formated_string}`
                      : formated_string,
                });
              } catch (e) {
                console.error(
                  `Failed to send payout message to channel ${channel}:`,
                  e
                );
              } finally {
                await new Promise((r) => setTimeout(r, 500));
              }
            }
          }
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      // update the user in keyv
      if (payoutsForUser.length > 0) {
        const entry = {
          ...dbUser,
          shells: totalAmount,
          payouts: payoutsForUser.map((d) => {
            return {
              type: d.payable_type,
              id: d.id,
              amount: d.amount,
              created_at: d.created_at,
            };
          }),
        }
        await keyv.set(`user_` + user, entry);
        entries.push(entry)
      }
    }
    keyv.set(`lb_users`, entries.map(dd => {
      delete dd.channels_to_share_to;
      dd.payouts = dd.payouts.map((d) => {
        return {
          type: d.payable_type,
          id: d.id,
          amount: d.amount,
          created_at: d.created_at,
        };
      })
      return dd;
    }))
  } catch (e) {
    console.error("Failed to query payouts:", e);
    new Promise((r) => setTimeout(r, 1000));
  }
}

async function updatePayoutsLoop() {
  console.log("====== Starting payouts update loop ====");
  try {
    await queryPayoutsAndUpdateThemUsers();
  } catch (e) {
    console.error("Error in payouts update loop:", e);
    // retry after 3 minutes
    console.error("Retrying in 3 minutes...");
  }
  await new Promise((r) => setTimeout(r, 1000 * 60 * 3)); // wait 3 minute
  console.log("====== [E] Starting payouts update loop ====");
  updatePayoutsLoop();
}

async function reTryLoop() {
  const found = [];
  for (const { user } of try_again.slice(0, 10)) {
    try {
      try {
        await client.chat.postMessage({
          channel: `C091XDSB68G`,
          text: `User <@${user}> is being tried again :)`,
        });
      } catch (e) { }
      await handleTeamJoinThing(client, airtable, env, last_5_users, user);
      found.push(user);
    } catch (e) {
      console.error("Error in retry loop:", e);
      if (e.data && e.data.records) {
        console.error("Airtable error records:", e.data.records);
      }
      try {
        await client.chat.postMessage({
          channel: `C091XDSB68G`,
          text: `User <@${user}> failed AGAIN\n trying again soon`,
        });
      } catch (e) { }

      continue;
    } finally {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  try_again = try_again.filter((d) => !found.includes(d.user));
  db.set("try_again", try_again);
  console.log(`Yay! Retried ${found.length} users`);
}
async function retryLooped() {
  await reTryLoop();
  await new Promise((r) => setTimeout(r, 1000 * 60 * 1)); // wait 1 minute
  retryLooped();
}
retryLooped();
// magic-url
sendQueueMessage();
updatePayoutsLoop();
