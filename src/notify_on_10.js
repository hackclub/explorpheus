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
const TEN_HOURS_IN_SECONDS = 36000 - 5
// import { App } from "@slack/bolt";
// import { Pool } from "pg";

/**
 * 
 * @param {Pool} pg 
 * @param {App} app 
 */
export async function queryForProjectsWith10hPendingDevlogs(pg, app) {
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
    const diff = parseInt(d.proj_time) - parseInt(d.all_proj_time || "0")
    app.client.chat.postMessage({
      channel: `C091XDSB68G`,
      text: `omg  enon its happening :333:  ${diff} >= ${TEN_HOURS_IN_SECONDS} - project id: ${d.id}`
    })
    console.log(diff, d.user_id)
    if (diff >= TEN_HOURS_IN_SECONDS) {
      app.client.chat.postMessage({
        channel: await getSlackId(pg, d.user_id),
        text: `Meow meow neon your project https://summer.hackclub.com/projects/${d.id} has a unpushed dev log over 10h.... make sure you push it soon gang!!1!`
      })
    }
  }
}
export function getSlackId(pg, uid) {
  return pg
    .query(`SELECT slack_id FROM "users" WHERE id = $1;`, [uid])
    .then(d => d.rows[0]?.slack_id);
}

export function sqlQueryToGetData(pg) {
  return pg.query(
    `SELECT
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
  AND p.is_deleted = false AND p.user_id = 5
`).then(d => d.rows)
}
