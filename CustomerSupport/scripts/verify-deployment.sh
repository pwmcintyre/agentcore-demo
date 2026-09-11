#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_root"

export AWS_PROFILE="${AWS_PROFILE:-sca-pwmcintyre}"
export AWS_REGION="${AWS_REGION:-ap-southeast-2}"

stack_name="customer-support-agent"
target_name="default"
runtime_name="CustomerSupport"
state_file="agentcore/.cli/deployed-state.json"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

for command in aws agentcore jq; do
  command -v "$command" >/dev/null || { printf 'Missing command: %s\n' "$command" >&2; exit 1; }
done

stack_output() {
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue | [0]" \
    --output text
}

runtime_arn=$(stack_output RuntimeArn)
runtime_id=$(stack_output RuntimeId)
role_arn=$(stack_output RuntimeRoleArn)

# Custom CDK owns deployment. Register its outputs in local CLI state so
# AgentCore commands address the same runtime without running agentcore deploy.
jq_args=(
  --arg target "$target_name"
  --arg runtime "$runtime_name"
  --arg runtimeArn "$runtime_arn"
  --arg runtimeId "$runtime_id"
  --arg roleArn "$role_arn"
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

marker="E2E-$(date -u +%Y%m%dT%H%M%SZ)-$$"
agentcore invoke --runtime "$runtime_name" --json \
  "Hello. Include this exact validation marker in your reply: $marker" >"$work_dir/invoke.json"
jq -e --arg marker "$marker" '.success == true and (.response | contains($marker))' \
  "$work_dir/invoke.json" >/dev/null
session_id=$(jq -r '.sessionId' "$work_dir/invoke.json")

agentcore status --runtime "$runtime_name" --json >"$work_dir/status.json"
jq -e --arg runtime "$runtime_name" \
  'any(.resources[]; .name == $runtime and .detail == "READY")' "$work_dir/status.json" >/dev/null

# CloudWatch ingestion is asynchronous. Correlate by session ID rather than
# requiring prompt content to be captured in logs or traces.
trace_id=''
logs_found=false
for _ in {1..6}; do
  agentcore traces list --runtime "$runtime_name" --since 15m --limit 20 --json >"$work_dir/traces.json"
  trace_id=$(jq -r --arg session "$session_id" '[.traces[]? | select(.sessionId == $session)][0].traceId // empty' \
    "$work_dir/traces.json")

  agentcore logs --runtime "$runtime_name" --since 15m --limit 500 --json \
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
