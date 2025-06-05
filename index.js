import "dotenv/config"
import express from "express"
// import { WebClient } from "@slack/web-api"
const { WebClient } = await import('@slack/web-api');
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
    API_KEY: z.string()
}).safeParse(process.env)
if(env.error) {
    throw env.error
}

env = env.data
const client = new WebClient(env.SLACK_XOXB)
const airtable = new AirtableFetch({
    apiKey: env.AIRTABLE_KEY,
    baseID: env.BASE_ID,
    tableName: "explorpheus"
})
const app = express()
const liveQueue = []
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
            channels: "C07LEEB50KD",
            env 
        }).then((_d)  => {
console.log(_d, "A OK")
item.status = "Invitation Sent"
modifying.push(item)
        }).catch((err ) => {
console.err(err, "NOOOO")
item.status = "Failed, pending retry"
if(typeof item.failed_attempts !== "number") item.failed_attempts = 0;
item.failed_attempts += 1
modifying.push(item)
        })
    }
}
doTheQueueLoop()
app.get('/healthcheck',(req,res) => {res.sendStatus(200)})
app.listen(8001, () => {
    console.log(`up`)
})