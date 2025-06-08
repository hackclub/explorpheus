import "dotenv/config"
import express from "express"
// import { WebClient } from "@slack/web-api"
const  App  = await import('@slack/bolt');
console.log([App.default])
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
    APP_TOKEN: z.string()
}).safeParse(process.env)
if(env.error) {
    throw env.error
}
env = env.data
const aclient = new App.default.App({
  token: env.SLACK_XOXB,
  socketMode: true,
  appToken: env.APP_TOKEN
});
const client = aclient.client
const airtable = new AirtableFetch({
    apiKey: env.AIRTABLE_KEY,
    baseID: env.BASE_ID,
    tableName: "explorpheus"
})
const app = express()
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
app.get('/healthcheck',(req,res) => {res.sendStatus(200)})
app.listen(process.env.PORT ||8001, () => {
    console.log(`up`)
})
// on team join -> hit bens endpoint -> ??
aclient.event('team_join', async ({ event, context }) => {
    // console.log(event)
    // check if user is for this - if so dm them.
    console.log(event.user.id)
    // get user email 
    const info = await client.users.info({ user: event.user.id }).then(d=>d.user.profile)
    const checkOnServersBackend = await fetch(`https://52mos.hackclub.malted.dev/explorpheus/magic-link?token=${env.API_KEY}&email=${info.email}&slack_id=${event.user.id}`, {
        method: "POST"
    })
    if(checkOnServersBackend.status !== 200) {
        // not my problem 
        // fun fact this had ran when status was 200 idk why plz kill me
        console.log("bad - ", checkOnServersBackend.status, info.email, event.user.id)
        return;
    }
    const json = await checkOnServersBackend.json()
    let MAGIC_LINK = json.link || "https://saahild.com/";
    // dm them
    client.chat.postMessage({
        channel: event.user.id, 
       blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Welcome, explorer!* Thank you for joining the hackclub slack! here is the steps you are at: \n1. >-- Join the hackclub Slack --<\n2. Connect to hackatime\n3. Work on your project..\n before you connect to hackatime you must Click below to continue…'
        }
      },
      {
        type: 'image',
        image_url: `https://hc-cdn.hel1.your-objectstorage.com/s/v3/dc669e8020030bd8fb71989651c205f7d7c41c28_clickherepurple_360.gif`,
        alt_text: 'Click Here',
        title: {
          type: 'plain_text',
          text: 'CLICK HERE',
          emoji: true
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Click Here',
              emoji: true
            },
            url: MAGIC_LINK,
            action_id: 'magic_link_button'
          }
        ]
      }
    ]
    })
})
aclient.start()