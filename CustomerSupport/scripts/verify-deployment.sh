#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_root"

export AWS_PROFILE="${AWS_PROFILE:-sca-pwmcintyre}"
export AWS_REGION="${AWS_REGION:-ap-southeast-2}"

stack_name="customer-support-agent"
target_name="default"
runtime_name="CustomerSupport"
memory_name="SharedMemory"
gateway_name="my-gateway-secure"
gateway_target_name="WarrantyCheck"
state_file="agentcore/.cli/deployed-state.json"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

for command in aws agentcore curl jq python3; do
  command -v "$command" >/dev/null || { printf 'Missing command: %s\n' "$command" >&2; exit 1; }
done

stack_output() {
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" \
    --output text
}

stack_output_prefix() {
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?starts_with(OutputKey, '$1')].OutputValue | [0]" \
    --output text
}

runtime_arn=$(stack_output RuntimeArn)
runtime_id=$(stack_output RuntimeId)
role_arn=$(stack_output RuntimeRoleArn)
memory_arn=$(stack_output_prefix "ApplicationMemory${memory_name}ArnOutput")
memory_id=$(stack_output_prefix "ApplicationMemory${memory_name}IdOutput")
gateway_arn=$(stack_output GatewayMyGatewaySecureArnOutput)
gateway_id=$(stack_output GatewayMyGatewaySecureIdOutput)
gateway_url=$(stack_output GatewayMyGatewaySecureUrlOutput)
gateway_target_id=$(stack_output GatewayTargetWarrantyCheckIdOutput)

# Custom CDK owns deployment. Register its outputs in local CLI state so
# AgentCore commands address the same runtime without running agentcore deploy.
jq_args=(
  --arg target "$target_name"
  --arg runtime "$runtime_name"
  --arg runtimeArn "$runtime_arn"
  --arg runtimeId "$runtime_id"
  --arg roleArn "$role_arn"
  --arg memory "$memory_name"
  --arg memoryArn "$memory_arn"
  --arg memoryId "$memory_id"
  --arg gateway "$gateway_name"
  --arg gatewayArn "$gateway_arn"
  --arg gatewayId "$gateway_id"
  --arg gatewayUrl "$gateway_url"
  --arg gatewayTarget "$gateway_target_name"
  --arg gatewayTargetId "$gateway_target_id"
  --arg stackName "$stack_name"
)
jq_filter='
  .targets //= {} |
  .targets[$target] //= {resources: {}} |
  .targets[$target].resources //= {} |
  .targets[$target].resources.runtimes //= {} |
  .targets[$target].resources.runtimes[$runtime] = {
    runtimeId: $runtimeId,
    runtimeArn: $runtimeArn,
    roleArn: $roleArn
  } |
  .targets[$target].resources.memories //= {} |
  .targets[$target].resources.memories[$memory] = {
    memoryId: $memoryId,
    memoryArn: $memoryArn
  } |
  .targets[$target].resources.mcp = {
    gateways: {
      ($gateway): {
        gatewayId: $gatewayId,
        gatewayArn: $gatewayArn,
        gatewayUrl: $gatewayUrl,
        targets: {
          ($gatewayTarget): {targetId: $gatewayTargetId}
        }
      }
    }
  } |
  .targets[$target].resources.stackName = $stackName |
  del(.targets[$target].resources.deployHash)
'
if [[ -f "$state_file" ]]; then
  jq "${jq_args[@]}" "$jq_filter" "$state_file" >"$work_dir/state.json"
else
  mkdir -p "$(dirname "$state_file")"
  jq -n "${jq_args[@]}" "$jq_filter" >"$work_dir/state.json"
fi
mv "$work_dir/state.json" "$state_file"

get_bearer_token() {
  if [[ -n "${AGENTCORE_BEARER_TOKEN:-}" ]]; then
    printf '%s' "$AGENTCORE_BEARER_TOKEN"
    return
  fi

  local pool_id client_id client_secret token_url
  pool_id=$(aws ssm get-parameter --name /app/customersupport/agentcore/pool_id --query Parameter.Value --output text)
  client_id=$(aws ssm get-parameter --name /app/customersupport/agentcore/client_id --query Parameter.Value --output text)
  token_url=$(aws ssm get-parameter --name /app/customersupport/agentcore/cognito_token_url --query Parameter.Value --output text)
  client_secret=$(aws cognito-idp describe-user-pool-client \
    --user-pool-id "$pool_id" --client-id "$client_id" --query UserPoolClient.ClientSecret --output text)

  CLIENT_ID="$client_id" CLIENT_SECRET="$client_secret" TOKEN_URL="$token_url" python3 - <<'PY'
import base64
import json
import os
import urllib.parse
import urllib.request

credentials = base64.b64encode(f"{os.environ['CLIENT_ID']}:{os.environ['CLIENT_SECRET']}".encode()).decode()
request = urllib.request.Request(
    os.environ["TOKEN_URL"],
    data=urllib.parse.urlencode({"grant_type": "client_credentials"}).encode(),
    headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/x-www-form-urlencoded"},
)
with urllib.request.urlopen(request, timeout=30) as response:
    print(json.load(response)["access_token"])
PY
}

bearer_token=$(get_bearer_token)

# Both public entry points must reject unauthenticated requests.
if agentcore invoke --runtime "$runtime_name" --json "authentication check" \
  >"$work_dir/unauthenticated-runtime.json" 2>"$work_dir/unauthenticated-runtime.err"; then
  printf 'Runtime accepted an unauthenticated invocation\n' >&2
  exit 1
fi
gateway_status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --request POST --header 'Content-Type: application/json' --header 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "${gateway_url%/}/mcp")
[[ "$gateway_status" == 401 || "$gateway_status" == 403 ]] || {
  printf 'Gateway unauthenticated request returned HTTP %s\n' "$gateway_status" >&2
  exit 1
}

marker="E2E-$(date -u +%Y%m%dT%H%M%SZ)-$$"
agentcore invoke --runtime "$runtime_name" \
  --bearer-token "$bearer_token" --json \
  "Hello. Include this exact validation marker in your reply: $marker" >"$work_dir/invoke.json"
jq -e --arg marker "$marker" '.success == true and (.response | contains($marker))' \
  "$work_dir/invoke.json" >/dev/null
session_id=$(jq -r '.sessionId' "$work_dir/invoke.json")

agentcore invoke --runtime "$runtime_name" --bearer-token "$bearer_token" --json \
  "Use the warranty tool to check PROD-001. Include its exact expiry date in YYYY-MM-DD format." \
  >"$work_dir/warranty.json"
jq -e '.success == true and (.response | contains("PROD-001") and contains("2027-03-01"))' \
  "$work_dir/warranty.json" >/dev/null

agentcore status --runtime "$runtime_name" --json >"$work_dir/status.json"
jq -e --arg runtime "$runtime_name" \
  'any(.resources[]; .name == $runtime and .detail == "READY")' "$work_dir/status.json" >/dev/null
jq -e --arg memory "$memory_name" \
  'any(.resources[]; .resourceType == "memory" and .name == $memory and .deploymentState == "deployed")' \
  "$work_dir/status.json" >/dev/null
jq -e --arg gateway "$gateway_name" \
  'any(.resources[]; .resourceType == "gateway" and .name == $gateway and .deploymentState == "deployed")' \
  "$work_dir/status.json" >/dev/null

# CloudWatch ingestion is asynchronous. Correlate by session ID rather than
# requiring prompt content to be captured in logs or traces.
trace_id=''
logs_found=false
for _ in {1..12}; do
  agentcore traces list --runtime "$runtime_name" --since 15m --limit 20 --json >"$work_dir/traces.json"
  trace_id=$(jq -r --arg session "$session_id" '[.traces[]? | select(.sessionId == $session)][0].traceId // empty' \
    "$work_dir/traces.json")

  agentcore logs --runtime "$runtime_name" --since 5m --limit 2000 --json \
    >"$work_dir/logs.jsonl"
  if jq -se --arg session "$session_id" 'any(.[]; tostring | contains($session))' \
    "$work_dir/logs.jsonl" >/dev/null; then
    logs_found=true
  fi

  [[ -n "$trace_id" && "$logs_found" == true ]] && break
  sleep 10
done

[[ -n "$trace_id" ]] || { printf 'No matching trace found for session %s\n' "$session_id" >&2; exit 1; }
[[ "$logs_found" == true ]] || { printf 'No matching log found for session %s\n' "$session_id" >&2; exit 1; }

printf 'PASS marker=%s session=%s trace=%s runtime=%s\n' "$marker" "$session_id" "$trace_id" "$runtime_id"
