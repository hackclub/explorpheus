import "dotenv/config";
import data from "./data2.json" with { type: "json" };
import { inviteToChannels } from "../src/undocumented.js";
import { WebClient } from "@slack/web-api";
const env = process.env;
const client = new WebClient(process.env.SLACK_XOXB);

(async () => {
  for (const item of data) {
    await new Promise((r) => setTimeout(r, 500));
    const verification_status = await fetch(
      "https://identity.hackclub.com/api/external/check?slack_id=" +
        item["Slack ID"],
    )
      .then((r) => r.json())
      .then((d) => d.result);
    if (verification_status !== "verified_eligible") {
      console.log(
        `Skipping ${item.Email} because verification status is ${verification_status}`,
      );
      continue;
    }
    console.log(`Trying for ${item.Email}`);
    await inviteToChannels(client, item["Slack ID"]).catch((e) =>
      console.error(e),
    );
    console.log(`It worked for ${item.Email}`);
    await new Promise((r) => setTimeout(r, 4500));
  }
})();
