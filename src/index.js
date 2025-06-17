import "dotenv/config"
import express from "express"
// import { WebClient } from "@slack/web-api"
const  App  = await import('@slack/bolt');
// console.log([App.default])
import { handleMCGInvite, handleTeamJoinThing} from "./undocumented.js"
import { z } from "zod";
import { AirtableFetch } from "./airtableFetch.js";
import JSONDb from "simple-json-db";
const db = new JSONDb("./db.json")
let try_again = db.get("try_again") || []
let alreadyCheckedEmails = []
let env0 = z.object({ 
    SLACK_XOXB: z.string(),
    SLACK_XOXC: z.string(),
    SLACK_XOXD: z.string(),
    AIRTABLE_KEY: z.string(),
    BASE_ID: z.string(),
    API_KEY: z.string(),
    APP_TOKEN: z.string().optional(),
    SLACK_SIGNING_SECRET: z.string(),
    LOOPS_ID: z.string(),
    LOOPS_API_KEY: z.string(),
    JR_BASE_ID: z.string(),
    SLACK_XOXP: z.string(),
    UPTIME_URL_THING: z.string(),
    DOMAIN_OF_HOST: z.string(),
    GARDENS_URL: z.string().optional(),
    BANNED_USERS: z.string()
}).safeParse(process.env)
if(env0.error) {
    throw env0.error
}
const env = env0.data
let last_5_users = []
const receiver = new App.default.ExpressReceiver({
  signingSecret: env.SLACK_SIGNING_SECRET,
  endpoints: '/slack/events', // This is the default endpoint for Slack events
});
let airtable_under_press = false;
let join_requests_currently = 0;
const aclient = new App.default.App({
  token: env.SLACK_XOXB,
  receiver
});
const client = aclient.client
const airtable = new AirtableFetch({
    apiKey: env.AIRTABLE_KEY,
    baseID: env.BASE_ID,
    tableName: "explorpheus"
})
const app = receiver.app;
app.use(express.json())
app.get('/', (req,res) => res.send('hi:3'))


// doTheQueueLoop()
async function sendQueueMessage() {
// pull all queue messages from airtable lol
const updateRecords = []
const currentRecords = await fetch(`https://api.airtable.com/v0/${env.BASE_ID}/messages_to_users?filterByFormula=${encodeURIComponent("AND({Automation_-_sent_to_user} = FALSE(), {Send} = TRUE())")}`, {
    headers: {
        Authorization: `Bearer ${env.AIRTABLE_KEY}`
    }
}).then(r=>r.json()).then(d=> d.records)
console.log(`Sending ${currentRecords.length} messages`)
for(const record of currentRecords) {
    const fields = record.fields;
    if(!fields.to || !fields["Sent by"] || !fields.content) {
        console.error("Invalid record", record)
        continue;
    }
    // send message to user
    try {
        await client.chat.postMessage({
            channel: fields.to,
            text: fields.content + "\n> From "+ fields["Sent by"].name,
        });
        updateRecords.push({
            id: record.id,
            fields: {
                "Automation_-_sent_to_user": true,
                "Status": "Sent"
            }
        })
    } catch (e) {
        console.error("Failed to send message", e)
    }
}
if(updateRecords.length > 0) {
    console.log(`Updating records`)
    await fetch("https://api.airtable.com/v0/"+env.BASE_ID+"/messages_to_users", {
    method: "PATCH",
    headers: {
        Authorization: `Bearer ${env.AIRTABLE_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ records: updateRecords })
}).then(r=>r.json()).then(d=> console.log("Updated records", d))
}
}
app.get('/healthcheck',(req,res) => {
    // example db query  (yes ik its a json db ;-;)
    db.set("1", 2)
    let is_fully_ok = false;
    let is_db_ok = false
    try {
        is_db_ok = db.get("1") === 2
        if(is_db_ok) {
            is_fully_ok = true;
        }
    } catch (e) {
        console.error("DB error", e)
    }
    let is_up = true;
    if(is_fully_ok) {
        res.status(200).json({ is_up,is_db_ok, is_fully_ok, airtable_under_press })
    } else {
        res.status(500).json({ is_up, is_db_ok, is_fully_ok, airtable_under_press })
    }
})
app.post('/content',async (req,res) => {
    const auth = req.headers["authorization"]
    if(auth !== env.SLACK_XOXB) return res.status(401).json({ fed: true })
        
        try {
            await client.chat.postMessage({
                channel: `C091XDSB68G`,
                text: `Queue endpoint hit`,
            })
        } catch (e) {
        }
        // const { to, from, content, airtableId } = req.body;
    console.log(`[REQ] queing time!`)
   await  sendQueueMessage()
res.json({ success:true, message: "queing msgs"})
    })

    app.post('/verified', async (req,res) => {
        console.log(req.body)
        if(req.body.token !== env.API_KEY) {
            return res.status(401).end()
        }
       if(alreadyCheckedEmails.includes(req.body.slack_id)) return res.status(400).end()
            const user = req.body.slack_id
        
        try {
            await client.chat.postMessage({
                channel: `C091XDSB68G`,
                text: `User <@${user}> upgrade endpoint hit`,
            })
        } catch (e) {
        }
        // check if user is upgraded already
   const proc = await handleMCGInvite(client, env, user, alreadyCheckedEmails)
   if(!proc) {
        return res.status(403).end()
   }
        return res.status(200).end()
    })

// on team join -> hit bens endpoint -> send magic url -> airtable add.
aclient.event('team_join', async ({ event, context }) => {
    try {
    join_requests_currently++
    if(join_requests_currently > 4) await new Promise(r=>setTimeout(r,1000))
if(join_requests_currently > 10) {
    airtable_under_press = true;
}
    // check if user is for this - if so dm them.
    console.log(event.user.id)
await    handleTeamJoinThing(client, airtable, env, last_5_users, event.user.id)
last_5_users = last_5_users.slice(0,5)
    } catch (e) {
        console.error("Error in team_join event:", e);
        if(e.data && e.data.records) {
            console.error("Airtable error records:", e.data.records);
        }
        // add to try again queue
        try_again.push({
            user: event.user.id,
        })
        db.set("try_again", try_again)
        
        try {
            await client.chat.postMessage({
                channel: `C091XDSB68G`,
                text: `User <@${event.user.id}> thing failed \`${e.message}\` \n\n Will retry later`,
            })
        } catch (e) {
        }
    }    
})
    


aclient.action('button-action', async ({ body, ack, say }) => {
    await ack();
});
aclient.event("app_home_opened", async ({ event, context }) => {
    const allowed_user_ids = [
  'U0C7B14Q3',   'UDK5M9Y13',
  'U01MPHKFZ7S', 'U03DFNYGPCN',
  'U054VC2KM9P', 'U059VC0UDEU',
  'U05F4B48GBF', 'U05JNJZJ0BS',
  'U06QK6AG3RD', 'U079VBNLTPD',
  'U07ACECRYM6', 'U07AZFQLPQ8',
  'U07E7MG2ST0', 'U07L45W79E1',
  'U07Q4K6RHM5', 'U07SX29CECA',
  'U080A3QP42C', 'U0810GB0HE3',
  'U082DPCGPST', 'U08B2HD1JNA'
]
    // TODO: add, view actvly added users, option to re sent magic url, option to upgrade user
if(allowed_user_ids.includes(event.user)) {
aclient.client.views.publish({
    user_id: event.user, // the user ID of the user whose home tab is being opened
    view: {
        type: 'home',
       "blocks": [
		{
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": `Hi there <@${event.user}>, here you can promote people to normal users and also send magic links.. below the buttons is the last 5 users who joined..`
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Upgrade user",
						"emoji": true
					},
					"value": "upgrade_user",
                    "action_id": "upgrade_user"
				},
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Check if user is on the platform ",
						"emoji": true
					},
					"value": "check_user",
                    "action_id": "check_user"
				}
			]
		},
		{
			"type": "divider"
		},
        ...last_5_users.map((d) => {
            return {
			"type": "section",
			"text": {
				"type": "mrkdwn",
				"text": `<@${d.id}> - ${new Date(d.date).toString()} ${d.got_verified?":done:": ":x:"}`
			}
		}
        })
	]
    }
})
} else {
    aclient.client.views.publish({
    user_id: event.user, // the user ID of the user whose home tab is being opened
    view: {
        type: 'home',
        blocks: [
           {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "hi this isnt for u :>"
            }
           }
        ]
    }
})
}
})
aclient.view('upgrade_user', async ({ ack, body, view, context }) => {
    await ack();

    const slackId = view.state.values.slack_id_input.slack_id_action.value;

    // Do something with the Slack ID
    console.log(`Upgrading user with Slack ID: ${slackId}`);
    if(!slackId || slackId.length < 5) {
        await ack({
    response_action: 'errors',
    errors: {
        slack_id_input: 'Please enter a valid Slack ID.'
    }
});
return;
    }
    try {
        await handleMCGInvite(client, env, slackId, alreadyCheckedEmails);
        await aclient.client.chat.postMessage({
            channel: body.user.id,
            text: `<@${slackId}> has been upgraded!`
        });
        await aclient.client.chat.postMessage({
            channel: `C091XDSB68G`,
            text: `User <@${slackId}> has been upgraded! (_manually by <@${body.user.id}>_)`,
        })
    } catch (error) {
        console.error(error);
        await aclient.client.chat.postMessage({
            channel: body.user.id,
            text: `Failed to upgrade <@${slackId}>. Please check the logs for more details.`
        });
    }
});

// when someone clicks a button from the list above it opens the modal for such button
aclient.action('upgrade_user', async ({ body, ack, view, context }) => {
    await ack();
    // open modal
    await aclient.client.views.open({
        trigger_id: body.trigger_id,
        view: {
            type: 'modal',
            callback_id: 'upgrade_user',
            title: {
                type: 'plain_text',
                text: 'Upgrade User',
            },
            submit: {
                type: 'plain_text',
                text: 'Upgrade'
            },
            blocks: [
                {
                    type: 'input',
                    block_id: 'slack_id_input',
                    element: {
                        type: 'plain_text_input',
                        action_id: 'slack_id_action'
                    },
                    label: {
                        type: 'plain_text',
                        text: 'Enter user Slack ID'
                    }
                }
            ]
        }
    });
})
aclient.view('check_user', async ({ ack, body, view, context }) => {
    await ack();

    const slackId = view.state.values.slack_id_input.slack_id_action.value;

    // Do something with the Slack ID
    console.log(`check user with Slack ID: ${slackId}`);
    if(!slackId || slackId.length < 5) {
        await ack({
    response_action: 'errors',
    errors: {
        slack_id_input: 'Please enter a valid Slack ID.'
    }
});
return;
    }
    const info = await client.users.info({ user: slackId }).catch(e => {
        console.error("Failed to fetch user info:", e);
        return null;
    })
    if(!info || !info.user) {
          await ack({
    response_action: 'errors',
    errors: {
        slack_id_input: 'Please enter a valid Slack ID.'
    }
});
return;
    }
    const email = info.user.profile.email;
    try {
        const is_on_the_platform = await fetch(`https://${env.DOMAIN_OF_HOST}/explorpheus/magic-link?token=${env.API_KEY}&email=${encodeURIComponent(email)}&slack_id=${slackId}`, {
            method: "POST"
        }).then(r=>r.json()).then(d=>d.status == 200)
        await aclient.client.chat.postMessage({
            channel: body.user.id,
            text: `<@${slackId}> ${is_on_the_platform ? "is" : "is not"} on the platform!`
        });
        await aclient.client.chat.postMessage({
            channel: `C091XDSB68G`,
            text: `User <@${slackId}> was checked if they were on the platform!(fun fact: ${is_on_the_platform? "they are on it" : "they are not on it :3"})  (_manually by <@${body.user.id}>_)`,
        })
    } catch (error) {
        console.error(error);
    }
});

aclient.action('check_user', async ({ body, ack, view, context }) => {
    await ack();
    // open modal
    await aclient.client.views.open({
        trigger_id: body.trigger_id,
        view: {
            type: 'modal',
            callback_id: 'check_user',
            title: {
                type: 'plain_text',
                text: 'Check User',
            },
            submit: {
                type: 'plain_text',
                text: 'Check'
            },
            blocks: [
                {
                    type: 'input',
                    block_id: 'slack_id_input',
                    element: {
                        type: 'plain_text_input',
                        action_id: 'slack_id_action'
                    },
                    label: {
                        type: 'plain_text',
                        text: 'Enter user Slack ID'
                    }
                }
            ]
        }
    });
})

aclient.start(process.env.PORT).then(() => {
    console.log(`uppies`)
})
// reset major count every 60s
setInterval(() => {
    join_requests_currently = 0;
}, 60 * 1000)
async function reTryLoop() {
    const found = []
    for(const { user } of try_again.slice(0,10)) {
     try {
           try {
            await client.chat.postMessage({
                channel: `C091XDSB68G`,
                text: `User <@${user}> is being tried again :)`,
            })
        } catch (e) {
        }
        await handleTeamJoinThing(client, airtable, env, last_5_users, user)
        found.push(user)
     }    catch (e) {

        console.error("Error in retry loop:", e);
        if(e.data && e.data.records) {
            console.error("Airtable error records:", e.data.records);
        }
           try {
            await client.chat.postMessage({
                channel: `C091XDSB68G`,
                text: `User <@${user}> failed AGAIN\n trying again soon`,
            })
        } catch (e) {
        }

        continue;
     } finally {
        await new Promise(r=>setTimeout(r, 500))
     }
    }
    try_again = try_again.filter(d => !found.includes(d.user))
    db.set("try_again", try_again)
    console.log(`Yay! Retried ${found.length} users`)
}
async function retryLooped() {
    await reTryLoop()
    await new Promise(r => setTimeout(r, 1000 * 60 * 1)) // wait 1 minute
    retryLooped()
}
retryLooped()
// aclient.r 
// magic-url
sendQueueMessage()
