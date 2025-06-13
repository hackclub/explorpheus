import "dotenv/config"
import express from "express"
// import { WebClient } from "@slack/web-api"
const  App  = await import('@slack/bolt');
// console.log([App.default])
import { inviteGuestToSlackToriel} from "./undocumented.js"
import { z } from "zod";
import { AirtableFetch } from "./airtableFetch.js";
import crypto from "crypto"
let env = z.object({ 
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
    JR_BASE_ID: z.string()
}).safeParse(process.env)
if(env.error) {
    throw env.error
}
env = env.data
const receiver = new App.default.ExpressReceiver({
  signingSecret: env.SLACK_SIGNING_SECRET,
  endpoints: '/slack/events', // This is the default endpoint for Slack events
});
let airtable_under_press = false;
let join_requests_currently = 0;
const aclient = new App.default.App({
  token: env.SLACK_XOXB,
//   socketMode: true,
//   appToken: env.APP_TOKEN,
  receiver
});
const client = aclient.client
const airtable = new AirtableFetch({
    apiKey: env.AIRTABLE_KEY,
    baseID: env.BASE_ID,
    tableName: "explorpheus"
})
const app = receiver.app;
const liveQueue = []
const THE_CHANNEL_LIST = "C08MYN7HVN2,C08N1NWKEF4,C016DEDUL87,C75M7C0SY" // #journey,#journey-feed,#cdn,#welcome
app.use(express.json())
app.get('/', (req,res) => res.send('hi:3'))

app.post('/new_user', (req,res) => {
    // 1. validate auth
    if(req.headers.authorization !== `Bearer ${env.API_KEY}`) {
        return res.status(403).send('Forbidden')
    }
    if(!req.body?.email) {
        return res.status(400).send("No email or body found")
    }
    // 2. add to queue 
    liveQueue.push({
        email: req.body.email,
    })
    // 3. respond with OK
    res.send(
        "OK"
    )
})

function NoDiff(obj1, obj2) {
    if(typeof obj1.email !== 'string' || typeof obj2.email !== 'string') {
        return true; // dont care atp
    }
    if(typeof obj1.status !== 'string' || typeof obj2.status !== 'string') {
        return true;
    }
    if(obj1.email !== obj2.email) return false;
    if(obj1.status !== obj2.status) return false;
    return true;
}
async function syncToAirtable() {
const currentRecords = await airtable.read().then(d=>d)
const mashed = []
const mashed2 = []
for(const item of liveQueue) {
    const foundItem = currentRecords.find(r => r.fields.email === item.email)
    if(foundItem && NoDiff(item, foundItem.fields)) {
        // already exists and isnt changed, skip
        continue
    }
    if(foundItem) {
        console.log('foundItem', foundItem, item)
        // const formulatedObject= 
mashed2.push({
    id: foundItem.id,
    fields: {
        email: item.email,
        status: item.status,
        failed_attempts: item.failed_attempts || 0,
    }
})
    } else {
    mashed.push({
        fields: {
            email: item.email,
            status: item.status || "Pending",
            identifier: item.identifier || crypto.randomUUID()
        }
    })
    }
}
// update records mass
if(mashed.length > 0) {
airtable.createBulk(mashed).then(console.log).catch(console.error)
}
if(mashed2.length >0) {
    airtable.updateBulk(mashed2).catch(console.error).then(console.log)
}
}
async function doTheQueueLoop() {
if(liveQueue.length > 0) {
        await doTheQueue()
    await new Promise(r=>setTimeout(r, 500))
    await syncToAirtable()
}
    await new Promise(r=>setTimeout(r, 1000 * 60)) // wait 1 minutes
     doTheQueueLoop()
}
async function doTheQueue() {
    if(liveQueue.length === 0) return;
    let modifying = []
    for(const item of liveQueue) {
        if(item.status == "Invitation Sent") continue;
        inviteGuestToSlackToriel({
            email: item.email,
            channels: THE_CHANNEL_LIST,
            env 
        }).then(async (_d)  => {
console.log(_d, "A OK")
item.status = "Invitation Sent"
modifying.push(item)
// lets rotate to sending them with how to blah blah
// get user by email
const user = await client.users.lookupByEmail({ email: item.email  })
console.log(user)
await client.chat.postMessage({
    channel: user.user.id,
    text: FAT_MESSAGE
})
        }).catch((err ) => {
console.error(err, "NOOOO")
item.status = "Failed, pending retry"
if(typeof item.failed_attempts !== "number") item.failed_attempts = 0;
item.failed_attempts += 1
modifying.push(item)
        })
    }
}
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
// app.listen(process.env.PORT ||8001, () => {
//     console.log(`up`)
// })
// on team join -> hit bens endpoint -> ??
aclient.event('team_join', async ({ event, context }) => {
    join_requests_currently++
    if(join_requests_currently > 4) await new Promise(r=>setTimeout(r,1000))
if(join_requests_currently > 10) {
    airtable_under_press = true;
}
    // console.log(event)
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
        return;
    }
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
   const msgs = await Promise.all([client.chat.postMessage({
        channel: event.user.id, 
       blocks: blocksContent
    }), client.chat.postMessage({
        channel: event.user.id,
        text: textContent,
        blocks: blocksContent,
        username: 'Explorpheus',
        icon_url: 'https://hc-cdn.hel1.your-objectstorage.com/s/v3/d6d828d6ba656d09a62add59dc07e2974bfdb38f_image.png',
    })
])

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
});
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
    console.log(body)
    // send message to user
    const user = body.user.id;
    // const MAGIC_LINK = body.message.blocks[0].accessory.url;
    // await client.chat.postMessage({
    //     channel: user,
    //     text: `Thanks for clicking the button! Here's your magic link: ${MAGIC_LINK}`,
    //     blocks: [
    //         {
    //             type: "section",
    //             text: {
    //                 type: "mrkdwn",
    //                 text: `Here's your magic link: <${MAGIC_LINK}|Click here>`
    //             }
    //         }
    //     ]
    // });
    if(!airtable_under_press) {
//    try {
//      // update airtable to say button was clicked 
//     await airtable.updateBulk([{
//         id: user, // assuming ts is the record id
//         fields: {
//             "Automation - User clicked magic link via slack": true,
//         }
//     }])
//    } catch (e) {
//     console.error('oops ', e)
//    } 
    }
});
aclient.start(process.env.PORT).then(() => {
    console.log(`uppies`)
})
// reset major count every 60s
setInterval(() => {
    join_requests_currently = 0;
})
// aclient.r 
// magic-url
sendQueueMessage()