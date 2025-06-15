import "dotenv/config"
import express from "express"
// import { WebClient } from "@slack/web-api"
const  App  = await import('@slack/bolt');
// console.log([App.default])
import { handleMCGInvite, inviteGuestToSlackToriel} from "./undocumented.js"
import { z } from "zod";
import { AirtableFetch } from "./airtableFetch.js";
import crypto from "crypto"
const alreadyCheckedEmails = []
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
    UPTIME_URL_THING: z.string()
}).safeParse(process.env)
if(env0.error) {
    throw env0.error
}
const env = env0.data
const last_5_users = []
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
            // username: fields.from,
            // icon_url: 'https://hc-cdn.hel1.your-objectstorage.com/s/v3/d6d828d6ba656d09a62add59dc07e2974bfdb38f_image.png',
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
app.get('/healthcheck',(req,res) => {res.sendStatus(200)})
app.post('/content',(req,res) => {
    const auth = req.headers["authorization"]
    if(auth !== env.SLACK_XOXB) return res.status(401).json({ fed: true })
        // const { to, from, content, airtableId } = req.body;
    console.log(`[REQ] queing time!`)
    sendQueueMessage()
res.json({ success:true, message: "queing msgs"})
    })

    app.post('/verified', async (req,res) => {
        console.log(req.body)
        if(req.body.token !== env.API_KEY) {
            return res.status(401).end()
        }
       if(alreadyCheckedEmails.includes(req.body.slack_id)) return res.status(400).end()
            const user = req.body.slack_id
        // check if user is upgraded already
   const proc = await handleMCGInvite(client, env, user, alreadyCheckedEmails)
   if(!proc) {
        return res.status(403).end()
   }
        return res.status(200).end()
    })

// on team join -> hit bens endpoint -> ??
aclient.event('team_join', async ({ event, context }) => {
    join_requests_currently++
    if(join_requests_currently > 4) await new Promise(r=>setTimeout(r,1000))
if(join_requests_currently > 10) {
    airtable_under_press = true;
}
    // check if user is for this - if so dm them.
    console.log(event.user.id)
    // get user email 
    const info = await client.users.info({ user: event.user.id }).then(d=>d.user.profile)
    const checkOnServersBackend = await fetch(`https://52mos.hackclub.malted.dev/explorpheus/magic-link?token=${env.API_KEY}&email=${encodeURIComponent(info.email)}&slack_id=${event.user.id}`, {
        method: "POST"
    })
    const text = await checkOnServersBackend.text()
    console.debug(text)

    if(checkOnServersBackend.status !== 200) {
        // not my problem 
        // fun fact this had ran when status was 200 idk why plz kill me
        console.log("bad - ", checkOnServersBackend.status, info.email, event.user.id)
        last_5_users.unshift({
            id: event.user.id, 
            date: Date.now(),
            got_verified: false
        })
        last_5_users = last_5_users.slice(0,5)
        return;
    }
      last_5_users.unshift({
            id: event.user.id, 
            date: Date.now(),
            got_verified: true
        })
        last_5_users = last_5_users.slice(0,5)
    const json = await JSON.parse(text)
    const UA = json.user_agent || "No UA"
    const IP = json.ip || "0.0.0.0/24"
    let MAGIC_LINK = json.link || "https://saahild.com/";
    // dm them
    const textContent = "click below to get to the tutorial!"
    const blocksContent =  [
		{
			"type": "header",
			"text": {
				"type": "plain_text",
				"text": "click below to get to the tutorial!"
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": ":hii: click me! :siren-real:",
						"emoji": true
					},
					"value": "meow",
					"url": MAGIC_LINK,
					"action_id": "button-action"
				}
			]
		}
	]
    
fetch('https://app.loops.so/api/v1/transactional', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer '+env.LOOPS_API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    'email': info.email,
    'transactionalId': env.LOOPS_ID,
    'addToAudience': true,
    'dataVariables': {
      'auth_link': MAGIC_LINK
    }
  })
}).then(d=>d.text()).then(console.log).catch(console.error)
   const msgs = await Promise.all([client.chat.postMessage({
        channel: event.user.id, 
       blocks: blocksContent,
       token: env.SLACK_XOXP
    }), client.chat.postMessage({
        channel: event.user.id,
        text: textContent,
        blocks: blocksContent,
        username: 'Explorpheus',
        icon_url: 'https://hc-cdn.hel1.your-objectstorage.com/s/v3/d6d828d6ba656d09a62add59dc07e2974bfdb38f_image.png',
    })
])
;
    // update airtable by creating a record
    await airtable.createBulk([{
        fields: {
            Email: info.email,
            "Slack ID": event.user.id,
            // message_link_sent_to_user: await aclient.client.chat.getPermalink({
            //     channel: msg.channel,
            //     message_ts: msg.ts,
            // }).then(d=>d.permalink)
            magic_link: MAGIC_LINK,
            // dummy data for now ;-;
            "User Agent": UA,
            "Form Submission IP": IP
        }
    }], "Explorpheus/1.0.0 create user", env.JR_BASE_ID, "SoM 25 Joins").then(d=>console.log(d)).catch(e=>console.error(e))
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
				"text": "Hi there {user}, here you can promote people to normal users and also send magic links.. below the buttons is the last 5 users who joined.."
			}
		},
		{
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Send user magic url",
						"emoji": true
					},
					"value": "send_magic_url_modal"
				},
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Upgrade user",
						"emoji": true
					},
					"value": "upgrade_user"
				},
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Check if user is on the platform ",
						"emoji": true
					},
					"value": "check_user"
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
                text: "hi"
            }
           }
        ]
    }
})
}
})

aclient.start(process.env.PORT).then(() => {
    console.log(`uppies`)
})
// reset major count every 60s
setInterval(() => {
    join_requests_currently = 0;
}, 60 * 1000)
// aclient.r 
// magic-url
sendQueueMessage()
