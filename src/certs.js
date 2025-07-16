/*
using this sql statment:
SELECT 
  ship_certifications.*, 
  users.slack_id
FROM ship_certifications
JOIN projects ON ship_certifications.project_id = projects.id
JOIN users ON projects.user_id = users.id

Group user ids, if new ship cert change thingy push a message to the airtable thingy majig, and it will auto send :)

also later todo: migrate everything to send via the airtable thingy
*/