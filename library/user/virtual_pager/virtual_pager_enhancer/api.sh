#!/bin/bash
echo "Content-Type: application/json"
echo "Access-Control-Allow-Origin: *"
echo ""

CONFIG_PATH="/tmp/virtual_pager_enhancer"
SKINNER_CONFIG_FILE="$CONFIG_PATH/skinnerconfig.json"

mkdir -p "$CONFIG_PATH"
# Ensure file exists and contains at least an empty object if new
if [ ! -f "$SKINNER_CONFIG_FILE" ]; then
    echo "{}" > "$SKINNER_CONFIG_FILE"
fi

url_decode() {
    local encoded="$1"
    printf '%b' "${encoded//%/\\x}" | sed 's/+/ /g'
}

check_authentication() {
    local token="$1"
    local serverid="$2"

    local cookie_name="AUTH_$serverid"
    local cookie_value="$token"

    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" -b "$cookie_name=$cookie_value" http://localhost:1471/api/api_ping)

    if [ "$status" -eq 200 ]; then
        return 0
    else
        echo '{"status":"unauthorized"}'
        exit 0
    fi
}

run_command() {
    local cmd="$1"
    if [ -z "$cmd" ]; then
        echo '{"status":"no_command"}'
        return
    fi
    local output
    output=$(eval "$cmd" 2>&1)
    # We still need to escape the output of arbitrary commands to keep JSON valid
    echo "{\"status\":\"done\",\"output\":\"$(echo "$output" | sed 's/"/\\"/g' | tr -d '\n')\"}"
}

list_config() {
    if [ ! -s "$SKINNER_CONFIG_FILE" ]; then
        echo '{"status":"empty_config","config":{}}'
    else
        # Directly embed the file content as a JSON object
        echo -n "{\"status\":\"ok\",\"config\":"
        cat "$SKINNER_CONFIG_FILE"
        echo -n "}"
    fi
}

set_config() {
    local body
    body=$(cat)

    if [ -z "$body" ]; then
        echo '{"status":"empty_body"}'
        return
    fi

    echo "$body" > "$SKINNER_CONFIG_FILE"
    echo '{"status":"ok","message":"config_updated"}'
}

# Parse GET parameters
for param in $(echo "$QUERY_STRING" | tr '&' ' '); do
    key=$(echo "$param" | cut -d= -f1)
    value=$(echo "$param" | cut -d= -f2-)
    value=$(url_decode "$value")
    case "$key" in
        token) TOKEN="$value" ;;
        serverid) SERVERID="$value" ;;
        action) ACTION="$value" ;;
        data) DATA="$value" ;;
    esac
done

AUTH_ACTIONS=("command" "setconfig")
UNAUTH_ACTIONS=("listconfig")

if [[ " ${AUTH_ACTIONS[*]} " =~ " $ACTION " ]]; then
    if [ -z "$TOKEN" ] || [ -z "$SERVERID" ]; then
        echo '{"status":"missing_auth"}'
        exit 0
    fi
    check_authentication "$TOKEN" "$SERVERID"
fi

case "$ACTION" in
    command)
        run_command "$DATA"
        ;;
    listconfig)
        list_config
        ;;
    setconfig)
        set_config
        ;;
    *)
        echo '{"status":"unknown_action"}'
        ;;
esac