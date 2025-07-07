#!/bin/bash

TARGET_CHANNEL_ID="C092833JXKK"
USER_FILE="users.txt"

while IFS= read -r USER_ID; do
    RESPONSE=$(curl -s -X POST "https://slack.com/api/conversations.invite" \
        -H "Authorization: Bearer $SLACK_TOKEN" \
        -H "Content-Type: application/json" \
        --data "{\"channel\":\"$TARGET_CHANNEL_ID\",\"users\":\"$USER_ID\"}")

    if echo "$RESPONSE" | jq -e '.ok' > /dev/null; then
        echo "User $USER_ID invited successfully!"
    else
        echo "Error inviting user $USER_ID: $(echo "$RESPONSE" | jq -r '.error')"
    fi

    sleep 1  # Adjust if needed
done < "$USER_FILE"
