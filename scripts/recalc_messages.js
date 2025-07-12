// everyone who has a payout on a ship event 
import "dotenv/config"
import { Pool } from "pg";
import { WebClient } from "@slack/web-api";
const client = new WebClient(process.env.SLACK_XOXB);

const sompg = new Pool({
  connectionString: process.env.PG_CONNECTION_STRING_SOM,
});
const msg = `Hey there <@{user}> your recent ship payouts were recalculated and most of you should have a little upward shift, if you do happen to go into the negatives dont panik! you can easily recover by shipping new updates.
for more info see these posts, https://hackclub.slack.com/archives/C015M4L9AHW/p1752282450794339 https://hackclub.slack.com/archives/C090B3T9R9R/p1752289106023249"`
sompg.query(`SELECT 
  se.id AS ship_event_id,
  u.slack_id
FROM 
  ship_events se
JOIN 
  payouts p ON se.id = p.payable_id
JOIN 
  users u ON p.user_id = u.id;`).then(async d=> {
    console.log([... new Set(d.rows.map(d=>d.slack_id))].length)
 for (const slack_id of [... new Set(d.rows.map(d=>d.slack_id))]) {
  await  client.chat.postMessage({
    channel: slack_id, // Direct message to the user
    text: msg.replace("{user}", slack_id)
   }) 
   console.log(`Sent message to ${slack_id}`);
await new Promise((r) => setTimeout(r, 500))
}
})
