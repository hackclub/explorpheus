#!/bin/bash

CHANNEL_ID="C015M4L9AHW"

CURSOR=""
OUTPUT_FILE="users.txt"
> "$OUTPUT_FILE" 

while true; do
    RESPONSE=$(curl -s -X POST "https://slack.com/api/conversations.members" \
        -H "Authorization: Bearer $SLACK_TOKEN" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        --data "channel=$CHANNEL_ID&cursor=$CURSOR")

    echo "$RESPONSE" | jq -r '.members[]' >> "$OUTPUT_FILE"

    CURSOR=$(echo "$RESPONSE" | jq -r '.response_metadata.next_cursor')

    if [[ -z "$CURSOR" || "$CURSOR" == "null" ]]; then
        break
    fi
done

echo "All user IDs saved to $OUTPUT_FILE"
