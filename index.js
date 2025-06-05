import "dotenv/config"
// import { WebClient } from "@slack/web-api"
const { WebClient } = await import('@slack/web-api');

import { z } from "zod";

const env = z.object({ 
    SLACK_XOXB: z.string(),
    SLACK_XOXC: z.string(),
    SLACK_XOXD: z.string(),
    AIRTABLE_KEY: z.string(),
    BASE_ID: z.string(),
}).safeParse(process.env).data

const client = new WebClient(env.SLACK_XOXB)