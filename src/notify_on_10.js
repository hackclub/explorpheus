/**
 * if next devlog has >= 10h notify user they have exceeded that and need to send a message saying hey hey js a heads up ur hours aint being counted no more etc.
query: 
SELECT
  p.*,
  -- Total from dev_log
  (SELECT SUM(seconds_coded)
   FROM devlogs
   WHERE project_id = p.id) AS all_project_time,

  -- Total from hackatime_projects matching any of the hackatime_project_keys
  (SELECT SUM(hp.seconds)
   FROM hackatime_projects hp
   WHERE hp.name = ANY(p.hackatime_project_keys)) AS proj_time

FROM projects p
WHERE p.id = 6; -- Replace with your actual project ID
"hey neon why are u running a massive ahh sql query"
*/
const NINE_HOURS_IN_SECONDS = 32400 - 5
// import { App } from "@slack/bolt";
// import { Pool } from "pg";

/**
 * 
 * @param {Pool} pg 
 * @param {App} app 
 */
export async function queryForProjectsWith10hPendingDevlogs(pg, app, db) {
  // i love testing in prod.
  // TODO: make it work with other people then me :pf
  /**
   * type: {id:string,user_id:string,all_project_time:stringint, proj_time:stringint}
   */
  // app.client.chat.postMessage({
  //   channel: `U07L45W79E1`,
  //   text: `omg neon enon its happening :333`
  // })
  const data = await sqlQueryToGetData(pg)
  app.client.chat.postMessage({
    channel: `C091XDSB68G`,
    text: `omg n/eon enon its happening :3332\n`
  })
  for (const d of data) {
    if (await db.get(`project:${d.id}`)) {
      console.log(`skipping ${d.id} as already notified`)
      continue
    }
    const diff = parseInt(d.proj_time || "0") - parseInt(d.proj_time || "0")
    // console.log(diff, d.user_id)
    if (diff >= NINE_HOURS_IN_SECONDS) {
      app.client.chat.postMessage({
        channel: `C091XDSB68G`,
        text: `omg  enon its happening :333:  ${diff} >= ${NINE_HOURS_IN_SECONDS} - project id: ${d.id}`
      })
      const slack_id = await getSlackId(pg, d.user_id)
      app.client.chat.postMessage({
        // for first run only send to log channel
        // channel: `C091XDSB68G`,
        // text: `[CACHE RUN IGNORE PLEASE] Hey there your project https://summer.hackclub.com/projects/${d.id} has a unpushed dev log over 10h! make sure you upload your devlog soon as *anything past 10h will not be counted towards your project time!*`
        channel: slack_id,
        text: `Howdy! You’re coming up on 10 Hackatime hours without a devlog on your <https://summer.hackclub.com/projects/${d.id}|project> … better post one soon so you don’t start losing time!!`
      })
      await db.set(`project:${d.id}`, true)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  await app.client.chat.postMessage({
    channel: `C091XDSB68G`,
    text: `omg neon enon its done :3332`
  })
}
export function getSlackId(pg, uid) {
  return pg
    .query(`SELECT slack_id FROM "users" WHERE id = $1;`, [uid])
    .then(d => d.rows[0]?.slack_id);
}

export function sqlQueryToGetData(pg) {
  return pg.query(
    `SELECT *
FROM (
  SELECT
    p.id,
    p.user_id,
    p.title,
    (
      SELECT COALESCE(SUM(d.seconds_coded), 0)
      FROM devlogs d
      WHERE d.project_id = p.id
    ) AS all_project_time,
    (
      SELECT COALESCE(SUM(h.seconds), 0)
      FROM hackatime_projects h
      WHERE h.name = ANY(p.hackatime_project_keys)
    ) AS proj_time
  FROM projects p
  WHERE p.hackatime_project_keys IS NOT NULL
    AND cardinality(p.hackatime_project_keys) > 0
    AND p.is_deleted = false
) sub
WHERE (proj_time - all_project_time) >= 32400;
`).then(d => d.rows)
}
