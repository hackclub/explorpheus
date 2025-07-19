import "dotenv/config";
import { Pool } from "pg";
const client = new Pool({
  connectionString: process.env.PG_CONNECTION_STRING_SOM,
});
console.log("meow");
const stamp = Date.now()
// todo: find way to sum aa
console.log(
  client.query(
    `SELECT *,
       (proj_time - all_project_time) AS since_last_devlog
FROM (
  SELECT
    p.id,
    p.user_id,
    p.title,
    (
      SELECT COALESCE(SUM(d.duration_seconds), 0)
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
    AND p.is_deleted = false AND p.user_id = 14
) sub
WHERE (proj_time - all_project_time) >= 36000;

`,
    (_e, d) => {
      console.log(_e ? _e : d.rows)

      console.log(`Took ${Date.now() - stamp}ms (${Math.round((Date.now() - stamp) / 1000)} seconds)`)
    },
  ),
);
client.end();
/**
 * SELECT
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
 where hackatime_project_keys != '{}' AND  is_deleted = false;
-- Replace with your actual project ID

 */
