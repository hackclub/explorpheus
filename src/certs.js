/*
using this sql statment:
SELECT 
  ship_certifications.judgement,ship_certifications.notes,ship_certifications.project_id, 
  users.slack_id
FROM ship_certifications
JOIN projects ON ship_certifications.project_id = projects.id
JOIN users ON projects.user_id = users.id

Group user ids, if new ship cert change thingy push a message to the airtable thingy majig, and it will auto send :)

also later todo: migrate everything to send via the airtable thingy
*/
export function queryDb(pg) {
  return pg.query(`SELECT 
  ship_certifications.judgement,ship_certifications.notes,ship_certifications.project_id, 
  users.slack_id,ship_certifications.id
FROM ship_certifications
JOIN projects ON ship_certifications.project_id = projects.id
JOIN users ON projects.user_id = users.id 
WHERE ship_certifications.judgement != 0 AND users.id = 14`).then(d => d.rows)
}
export async function runTheCertsQuery(pg, app, db) {
  const data = await queryDb(pg)
  for (const d of data) {
    if (await db.get("certification:" + d.id)) {
      console.log(`skipping ${d.project_id} as already notified`)
      continue
    }
    const slackId = d.slack_id
    if (!slackId) {
      console.log(`skipping ${d.project_id} as no slack id`)
      continue
    }
    const judgement = d.judgement == 2 ? "rejected" : "approved"
    const notes = d.notes || ""
    const projectId = d.project_id
    await app.client.chat.postMessage({
      channel: slackId,
      text: `${d.judgement == 2 ? ":neocat_thumbsdown:" : ":neocat_thumbsup:"} Your project https://summer.hackclub.com/projects/${projectId} has been *${judgement}* with the following reason:\n> ${notes}`
    })
    await db.set("certification:" + d.id, true)
  }
}