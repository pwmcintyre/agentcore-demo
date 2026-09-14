# AgentCore CLI custom CDK boundary

Research date: 2026-09-14. Repository baseline: `@aws/agentcore` 0.28.1. Current global CLI and latest stable checked:
0.29.0. Upstream `main` checked at `1d94c5d`.

## Verdict

AgentCore CLI 0.28.1 can deploy a customer-modified or customer-authored CDK app located at `agentcore/cdk`, but only
when that app preserves the CLI-generated deployment contract. The CLI builds and synthesizes the directory rather than
regenerating its source, so extra constructs and grants are technically viable. This is implementation behavior, not a
documented public extension interface.

Arbitrary enterprise CDK conventions are not supported while preserving `agentcore deploy`. In particular, 0.28.1
selects exactly `AgentCore-<project>-<target>` from the synthesized assembly and then reconstructs local state from
L3-shaped CloudFormation output logical IDs. There is no flag or schema field for a custom stack name, CDK context,
custom app path, output mapping, or external deployment provider.

Therefore:

- **Current repository:** keep custom CDK as deployment owner and keep the deployed-state bridge. This is the lowest-risk
  path for the existing `customer-support-agent` stack, runtime, and memory.
- **Greenfield repository/environment:** custom resources can coexist with `agentcore deploy` if the CDK app deliberately
  retains all inferred conventions below.
- **Documented support:** wait for an upstream extension contract. Open PR
  [#2249](https://github.com/aws/agentcore-cli/pull/2249) is the clearest planned shape, but it is not released.

AWS documentation only describes `agentcore create` generating `agentcore/cdk` and `agentcore deploy` using CDK under
the hood. It does not describe replacing or extending that CDK app. The CLI configuration reference calls
`.cli/deployed-state.json` auto-managed and says not to edit it.

Sources:

- [AWS AgentCore CLI quickstart: generated project and deploy flow](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/agentcore-get-started-cli.html)
- [0.28.1 command reference: deploy exposes target/confirmation/preview/output flags only](https://github.com/aws/agentcore-cli/blob/v0.28.1/docs/commands.md#deploy)
- [0.28.1 configuration reference: deployed state is auto-managed](https://github.com/aws/agentcore-cli/blob/v0.28.1/docs/configuration.md#files-overview)
- [0.28.1 local CDK project validation and build](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/cdk/local-cdk-project.ts#L30-L75)

## Public and upstream status

| Source | Status on 2026-09-14 | Relevance |
| --- | --- | --- |
| [Issue #672](https://github.com/aws/agentcore-cli/issues/672) | Open, no maintainer response | Requests documentation for adding resources and grants to generated CDK. Its existence confirms the documentation gap, not support. |
| [PR #2249](https://github.com/aws/agentcore-cli/pull/2249) | Draft against `refactor`; not merged | Proposes a thin generated app where `lib/cdk-stack.ts` is the documented customer extension point. It preserves CLI deployment and demonstrates adding DynamoDB plus runtime/harness grants. Its blocked note names `aws/agentcore-l3-cdk-constructs#352`; the repository is not publicly accessible. The other named blocker, publishing `@aws/agentcore-cdk@0.1.0-alpha.53`, was resolved on 2026-09-11, but the PR remains draft. |
| [`@aws/agentcore-cdk`](https://www.npmjs.com/package/@aws/agentcore-cdk) | AWS-controlled npm package; all available versions are alpha | npm lists Amazon maintainers and trusted GitHub Actions publishing, but its declared source repository returns 404 to unauthenticated users. Provenance is stronger than an unknown third-party package; API stability, public auditability, and support remain weak. This project pins `0.1.0-alpha.50`. |
| [Issue #1928](https://github.com/aws/agentcore-cli/issues/1928) | Open | Reports generated-CDK portability and re-scaffolding gaps. No supported `init`/regeneration path exists. |
| [PR #1612](https://github.com/aws/agentcore-cli/pull/1612) | Merged; released before 0.28.1 | Makes deterministic `AgentCore-<project>-<target>` selection authoritative for deploy, diff, status checking, and state persistence. This fixes multi-target selection but hardens the naming dependency. |
| [Issue #2104](https://github.com/aws/agentcore-cli/issues/2104) | Open | Reports that deterministic stack identity can collide when two projects share project and target names. Confirms stack identity is not configurable or uniquely namespaced. |
| [PR #1777](https://github.com/aws/agentcore-cli/pull/1777) | Merged; present in 0.28.1 | CLI synchronizes dependencies in customer `agentcore/cdk/package.json`; customer-added packages remain untouched. Global `disableDependencyManagement` is an escape hatch. |
| [Issue #245](https://github.com/aws/agentcore-cli/issues/245), [PR #763](https://github.com/aws/agentcore-cli/pull/763) | Closed/merged; present in 0.28.1 | `agentcore import runtime` and `import memory` can adopt unmanaged resources through CloudFormation IMPORT. This is resource adoption, not arbitrary stack adoption or external-deploy registration. |
| [0.28.1 release](https://github.com/aws/agentcore-cli/releases/tag/v0.28.1) | Released 2026-08-27 | No custom-CDK support change. |
| [0.29.0 release](https://github.com/aws/agentcore-cli/releases/tag/v0.29.0) | Latest stable, released 2026-09-11 | Adds capacity-provider work only in this area. Diff from 0.28.1 leaves stack selection, discovery, and CDK entrypoint unchanged. |

No matching merged PR, release note, official guide, issue resolution, or discussion was found for bring-your-own CDK,
custom stack naming, external deployment registration, or a pluggable output/state adapter. Search results instead lead
to #672 and the still-open #2249.

## CLI and L3 coupling

There is no direct npm dependency from `@aws/agentcore` to `@aws/agentcore-cdk`: neither CLI 0.28.1 nor 0.29.0 lists
the L3 package in its own dependencies. Instead, the CLI ships a CDK project template whose `package.json` gives the
generated project a direct, exact-pinned dependency on the L3 package. The L3 README also documents standalone use
without the CLI. This makes the relationship scaffolded and deployment-time, not package-loading or service-runtime
coupling.

| Boundary      | Coupling and status                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm graph     | `@aws/agentcore` and `@aws/agentcore-cdk` are separate packages. A generated `agentcore/cdk` app directly depends on the L3; the CLI does not. Both declare compatible CDK peers, but with different floors: CLI `aws-cdk-lib ^2.258.0`; L3 `^2.257.0`; both use `constructs ^10.0.0`. These are public package contracts.                                                                                                          |
| Compile/synth | Customer CDK source imports L3 exports such as `AgentCoreApplication`, `AgentCoreMcp`, schemas, and `ConfigIO`. CLI invokes the app's build/synth flow. Type/API/schema incompatibility therefore fails compilation or synthesis before deployment. Public L3 exports and peer ranges are package contracts; compatibility with a particular CLI is not documented as one.                                                          |
| Deploy/state  | L3-generated templates emit resource outputs. CLI then selects the expected stack and parses L3-shaped output logical IDs into deployed state. The installed alpha.50 code explicitly emits runtime `RuntimeId`, `RuntimeArn`, `RoleArn` and memory `Memory<Name>Id/Arn` outputs; CLI 0.28.1 parses their construct-scoped logical IDs. This output agreement is observed implementation, not a versioned public manifest contract. |
| AWS runtime   | After synthesis/deployment, there is no live npm dependency or call path between CLI and L3. CloudFormation resources continue without either local package. L3 code can synthesize deployable helper assets such as custom-resource/build Lambdas, but those artifacts do not call the CLI package.                                                                                                                                |

Exact observed pairings are:

| CLI                                          | Vended L3 pin    | Repository state                           | npm publication evidence                                   |
| -------------------------------------------- | ---------------- | ------------------------------------------ | ---------------------------------------------------------- |
| 0.28.1                                       | `0.1.0-alpha.50` | Project manifest and lockfile pin alpha.50 | L3 published 2026-08-27 19:24 UTC; CLI published 19:48 UTC |
| 0.29.0 (current stable and currently global) | `0.1.0-alpha.53` | Not yet adopted by project                 | L3 published 2026-09-11 20:18 UTC; CLI published 21:11 UTC |

This is an observed tested pairing, not a documented compatibility matrix. No stable L3 version exists in the npm
version list on the research date; its `latest` tag is `0.1.0-alpha.53`. CLI release tooling can repin its vended
template to an explicit version or the L3 `latest` tag, but customer deploys do **not** query that tag. They use the
template embedded in the installed CLI.

Since 0.28.1, normal `agentcore deploy` synchronizes every dependency named in that embedded template. For the exact L3
pin, the first deploy after upgrading CLI 0.28.1 to 0.29.0 rewrites project alpha.50 to alpha.53 and runs `npm install`,
updating the lockfile incrementally. An older L3 pin is upgraded; a newer exact prerelease causes normal
deploy to fail with `CliVersionTooOldError` instead of being downgraded. `--dry-run`/`--diff` only report changes,
teardown converts skew or sync failure to warnings, non-semver overrides are skipped with a warning, and global
`disableDependencyManagement` opts out. User-added dependencies remain untouched.

Version drift can therefore fail in four places:

- **Dependency preflight:** newer L3 with older managed CLI blocks normal deploy; registry/install/write failure blocks
  normal deploy and restores the prior manifest.
- **Compile/synth:** changed L3 exports, schema, CDK peer requirements, or generated-app assumptions can break TypeScript,
  bundling, synthesis, or cloud-assembly reading. CLI issue fix #1465 is a concrete cloud-assembly schema precedent.
- **Deploy/state reconstruction:** a mismatched L3 may synthesize successfully but emit logical IDs an older/newer CLI
  parser does not recognize, causing resources to be omitted from local deployed state as described below.
- **Opted-out/manual operation:** bypassing managed versions removes the preflight guard, not the inferred stack/output
  contract. Compatibility becomes the project owner's responsibility.

Sources:

- [CLI 0.28.1 package manifest: no L3 dependency and CDK peers](https://github.com/aws/agentcore-cli/blob/v0.28.1/package.json)
- [CLI 0.28.1 vended CDK manifest: exact alpha.50 pin](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/assets/cdk/package.json)
- [CLI 0.29.0 vended CDK manifest: exact alpha.53 pin](https://github.com/aws/agentcore-cli/blob/v0.29.0/src/assets/cdk/package.json)
- [Managed dependency policy and skew detection](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/lib/dependency-management/plan.ts),
  [rewrite/install behavior](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/lib/dependency-management/sync.ts), and
  [deploy adapter/opt-out](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/operations/deploy/dependency-sync.ts)
- [CLI release helper resolves the L3 `latest` tag when no version is supplied](https://github.com/aws/agentcore-cli/blob/v0.29.0/scripts/sync-vended-cdk.ts)
- [PR #1777: rationale and tests for tested-version pinning](https://github.com/aws/agentcore-cli/pull/1777)
- [L3 npm metadata and README: package dependencies, peers, exports, and standalone use](https://www.npmjs.com/package/@aws/agentcore-cdk)
- Local installed L3 evidence: `CustomerSupport/agentcore/cdk/node_modules/@aws/agentcore-cdk/package.json`,
  `dist/cdk/constructs/l3/AgentEnvironment.js:121-145`, and
  `dist/cdk/constructs/l3/AgentCoreApplication.js:399-432`
- Local pins: `CustomerSupport/agentcore/cdk/package.json:22-25` and
  `CustomerSupport/agentcore/cdk/package-lock.json:393-413`

## Inferred 0.28.1 contract

These requirements are source-derived and may change without compatibility guarantees.

### CDK location and lifecycle

- Project must contain `agentcore/cdk/package.json`; deploy runs `npm run build` there.
- Deploy synchronizes CLI-managed dependencies before build. Preview modes only report prospective changes.
- CDK app must synthesize a stack for the selected target. Extra synthesized stacks are not deployed.
- The CLI itself handles imperative credential setup, bootstrap checks, CDK deployment, state persistence, and
  post-deploy work. Custom CDK does not replace those phases.

Sources:

- [Preflight constructs `LocalCdkProject`](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/operations/deploy/preflight.ts#L75-L88)
- [Managed dependency synchronization](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/operations/deploy/dependency-sync.ts#L81-L107)
- [Deploy build and synth sequence](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/commands/deploy/actions.ts#L292-L337)

### Stack identity

- Expected name is `AgentCore-${projectName}-${targetName}`, replacing underscores with hyphens.
- 0.28.1 rejects a synthesis that omits that exact name.
- Deploy and diff select only that stack.
- Generated CDK synthesizes one stack per entry in `aws-targets.json` and tags each stack with
  `agentcore:project-name=<project>` and `agentcore:target-name=<target>`.
- Tags support discovery for status/output lookup and teardown, but deploy stack selection still uses deterministic name.

Sources:

- [Exact stack selection and rejection](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/commands/deploy/actions.ts#L115-L142)
- [Generated naming, target loop, and tags](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/assets/cdk/bin/cdk.ts#L15-L20),
  [target construction](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/assets/cdk/bin/cdk.ts#L116-L207)
- [Tag-based stack discovery](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/cloudformation/stack-discovery.ts#L39-L105)

### Outputs and deployed state

- Runtime outputs must have logical IDs beginning
  `ApplicationAgent<PascalName>(RuntimeId|RuntimeArn|RoleArn|...)Output`.
- Memory outputs must begin `ApplicationMemory<PascalName>(Id|Arn)Output`.
- Equivalent private prefixes exist for gateways, evaluators, online evaluations, policies, endpoints, datasets,
  config bundles, knowledge bases, payments, and harnesses.
- Missing complete runtime triples are silently omitted. Missing memories and knowledge bases produce warnings. A
  successful deploy then replaces that target's resource snapshot and records a best-effort deploy hash.
- Extra custom outputs are ignored.

Sources:

- [Runtime output parser](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/cloudformation/outputs.ts#L149-L246)
- [Memory output parser](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/cloudformation/outputs.ts#L248-L276)
- [Deployment output parsing and state write](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/commands/deploy/actions.ts#L632-L830)
- [State reconstruction semantics](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/cloudformation/outputs.ts#L722-L886)

This repository already uses `AgentCoreApplication(this, 'Application', ...)`, and its synthesized custom template
contains the required runtime and memory prefixes. The custom `RuntimeArn`, `RuntimeId`, and `RuntimeRoleArn` outputs are
only for `scripts/verify-deployment.sh`; CLI persistence ignores them.

Local evidence:

- `CustomerSupport/agentcore/cdk/lib/customerSupport.ts:39-47`
- `CustomerSupport/agentcore/cdk/cdk.out/CustomerSupportAgent.template.json`
- `CustomerSupport/scripts/verify-deployment.sh:36-79`

## Exact local changes for CLI deployment

The minimum source changes that make synthesis pass `agentcore deploy --target default --dry-run` are:

1. Change the application stack's physical name from `customer-support-agent` to
   `AgentCore-CustomerSupport-default`.
2. Add stack tags `agentcore:project-name=CustomerSupport` and `agentcore:target-name=default`. Existing `project` and
   `stage` tags may remain.
3. Keep construct ID `Application` for `AgentCoreApplication`. This preserves output logical ID prefixes that 0.28.1
   parses.
4. Keep the runtime and memory names unchanged. Their generated outputs already match the parser.
5. Keep `platform` as a separately deployed prerequisite. `Fn::ImportValue` use is compatible as long as
   `PlatformNetwork` is deployed first and its exports remain available.
6. Replace implicit `stage ?? dev` selection with target-driven synthesis before adding another target. For current
   single target, defaulting to `dev` happens to work because the CLI passes no `-c stage=...`. Robust code should read
   all `aws-targets.json` targets, map target names to deployment overlays, and synthesize one correctly named/tagged
   stack per target, matching the generated entrypoint.
7. Keep `package.json` compatible with CLI dependency management. Current pins match 0.28.1's known-good set. If the
   enterprise build owns versions, explicitly enable the documented-by-PR global opt-out rather than relying on
   non-semver specifiers being skipped.
8. Remove the deployed-state bridge only after a real CLI deploy/import has persisted complete runtime and memory state.

Changing only these files would be sufficient for a **new environment**:

- `CustomerSupport/agentcore/cdk/bin/cdk.ts`: target-derived stack construction and required tags.
- `CustomerSupport/agentcore/cdk/config/dev.ts`: remove or replace custom `stackName` with target identity.
- `CustomerSupport/agentcore/cdk/config/types.ts`: remove `stackName` if no longer used.
- Tests and documentation that assert custom deployment ownership.

No change is needed in `customerSupport.ts` for basic CLI output parsing. Stable custom outputs can remain; they are
harmless.

These changes are **not sufficient for the already deployed environment**. A normal CDK deploy to a new stack does not
adopt resources owned by `customer-support-agent`; it attempts to create the same named runtime and memory under a new
stack. Migration must happen first.

## Existing-resource migration risk

### Runtime

- Recreating it changes runtime ID/ARN and interrupts active sessions and callers using the old ARN.
- Importing preserves physical runtime identity, but desired template properties must accurately describe live state.
- Current custom VPC overlay and security group must remain represented. CLI import can import the runtime, but not this
  repository's custom security group as an AgentCore resource.

### Memory

- Recreating it loses continuity with existing memory ID and stored events/records.
- Importing is preferable because CLI 0.28.1 has a native memory CloudFormation IMPORT path and sets retained policies
  during import.
- Strategy names, namespaces, roles, encryption, expiry, and tags must be checked for drift before the first normal
  deploy. Import translation intentionally filters service-internal namespaces.

### CloudFormation ownership

- A resource cannot be imported while another stack owns it. CLI reports that it must first be removed from the old
  stack.
- Safe handoff requires applying `DeletionPolicy: Retain` and `UpdateReplacePolicy: Retain`, removing resources from the
  old stack without deleting them, then importing them into `AgentCore-CustomerSupport-default`.
- Runtime, memory, IAM roles/policies, and `RuntimeSecurityGroup` form a dependency graph. Moving only runtime and memory
  can leave roles/security group in the old stack and make later old-stack deletion unsafe.
- CloudFormation stack refactoring may move eligible resources while preserving data, but eligibility is limited to
  `FULLY_MUTABLE` resource types and must be validated for every resource. No AgentCore CLI flow wraps stack refactoring.
- Import change sets cannot create unrelated resources, update existing resources, or modify outputs in the import
  phase. CLI works around this with companion-resource and import phases, then expects a later normal deploy.

Sources:

- [CLI import orchestrator](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/commands/import/resource-import.ts#L141-L209)
- [CLI import phases and state update](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/commands/import/import-pipeline.ts#L37-L144)
- [CLI import restrictions and ownership error](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/commands/import/phase2-import.ts#L36-L46),
  [ownership handling](https://github.com/aws/agentcore-cli/blob/v0.28.1/src/cli/commands/import/phase2-import.ts#L120-L134)
- [CloudFormation import prerequisites and restrictions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resource-import-existing-stack.html)
- [CloudFormation stack refactoring capabilities and limits](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stack-refactoring.html)

Do not test this migration first in the existing environment. Rehearse from copied configuration in an isolated account
or target, inspect import/refactor previews, run drift detection, and verify resource IDs before allowing a normal deploy.

## Capabilities gained and lost

| Move to conforming `agentcore deploy` | Effect |
| --- | --- |
| Gain | Native `deploy`, `--dry-run`, and `--diff`; automatic bootstrap checks; deployability checks; complete output-to-state refresh; deploy hash/change detection; CLI teardown; imperative credential/payment setup; post-deploy online-eval, dataset, knowledge-base ingestion, and authorization handling. |
| Keep | `agentcore add`, `remove`, `validate`, `dev`, `invoke`, `status`, `logs`, and `traces`; custom resources in the selected application stack; separate platform prerequisite; VPC imports. |
| Lose/constrain | Custom application stack name; custom `-c stage=...` interface; unrestricted dependency ownership unless opted out; ability to deploy a different stack topology without tracking CLI internals. |
| New risk | CLI upgrades can change private naming/output/dependency contracts. A malformed custom app may deploy successfully but persist incomplete state because several parsers omit unmatched outputs rather than fail deployment. CLI teardown now owns the selected application stack and all custom resources inside it. |

The current external-CDK workflow loses native deployment/diff/hash/post-deploy/teardown orchestration, but retains
enterprise stack identity and lifecycle control. `agentcore dev` remains independent. The state bridge restores the
remote operational commands required by this project.

## Ranked alternatives

1. **Keep custom CDK plus `verify-deployment.sh` registration. Recommended now.** No ownership migration, preserves
   runtime and memory IDs, and already provides `agentcore dev`, `invoke`, `status`, `logs`, and `traces`. Treat the
   deployed-state file as a version-pinned adapter and re-test it on CLI upgrades.
2. **Use a conforming custom CDK app for new targets only.** Preserve custom constructs and platform imports, but accept
   fixed stack identity/tags/outputs. This proves coexistence without risking current resources.
3. **Wait for #2249 and its L3 dependency, then migrate.** Best likely long-term route. It deliberately creates a small,
   stable customer extension file while moving config transformation and target conventions into the library. Still
   verify whether released version supports existing-stack migration and desired enterprise naming.
4. **Migrate current resources to the deterministic CLI stack now.** Technically possible through retain/import or
   CloudFormation stack refactoring, but highest operational risk. Use only if native `agentcore deploy` has enough value
   to justify rehearsed runtime, memory, IAM, and security-group ownership transfer.
5. **Fork or patch CLI for custom stack identity/output adapters.** Avoid. It creates a permanent upgrade and security
   maintenance burden while upstream design is actively changing.

## Upstream feature request shape

PR #2249 should be completed as the minimum official extension feature:

- Publish `readAgentCoreProject`, `resolveTargetStacks`, and `transformAgentCoreJson` in a stable
  `@aws/agentcore-cdk` release.
- Generate a thin, documented `lib/cdk-stack.ts` extension point that owns customer resources and grants.
- Keep AgentCore resource transformation, output emission, target naming/tags, and credentials in library-owned code.
- Guarantee that `agentcore deploy` does not overwrite customer extension source and that dependency sync preserves
  customer-added dependencies.
- Add a synthesis compatibility test or manifest version so CLI fails before deployment when extension output contract
  is incompatible.

For arbitrary enterprise CDK, a second feature is required:

- Add per-target deployment metadata with explicit synthesized stack/artifact name, rather than deriving it solely from
  project and target names.
- Emit a versioned deployment-state manifest from the CDK library instead of parsing private CloudFormation logical ID
  prefixes.
- Let CLI discover/register an externally deployed stack by ARN plus target, validate tags/manifest, and refresh state
  without assuming deploy or teardown ownership.
- Separate operations clearly: `deploy` for CLI-owned stacks; `register`/`refresh-state` for external stacks; explicit
  `adopt` using CloudFormation import/refactoring for ownership transfer.
- Document which post-deploy hooks can run against externally owned stacks and make teardown opt-in.

This supports both useful cases without pretending they are the same: customer extensions inside a CLI-owned stack, and
enterprise stacks owned by another pipeline.

## Unresolved questions

- AWS publishes no CLI-to-L3 compatibility matrix or support window. It is unknown whether every vended pair is tested
  end-to-end or what compatibility, if any, is promised outside that exact pair.
- The L3 source repository remains inaccessible without authentication. Alpha.50 installed code was inspectable, but
  alpha.53 internals could not be independently compared beyond npm metadata, its published README, and CLI references.
- Will #2249 merge into the released CLI line, and what compatibility/versioning promise will its extension point carry?
- Does the eventual extension API permit multiple application stacks or only extra resources in one deterministic stack?
- Which current runtime, memory, IAM, policy, and security-group resource types are eligible for CloudFormation stack
  refactoring in `ap-southeast-2`? This requires live `describe-type`/refactor validation and was intentionally not run.
- Does importing the current memory preserve every strategy property and namespace exactly? Compare live API detail with
  synthesized import template before execution.
- Should enterprise conventions permit CLI ownership of the application stack while retaining separate platform stack,
  or require all remote deployment to remain pipeline-owned?

## Checks performed

- Confirmed current global executable and package at
  `/Users/peter/.nvm/versions/node/v22.23.2/lib/node_modules/@aws/agentcore`: `agentcore --version` => `0.29.0`.
- Confirmed repository baseline from its pinned L3 manifest/lockfile and CLI 0.28.1 vended template: both use
  `@aws/agentcore-cdk` 0.1.0-alpha.50. The repository does not directly pin the CLI npm package.
- Queried npm package manifests, version lists, dist-tags, peer/dependency graphs, and publication timestamps for CLI
  0.28.1/0.29.0 and L3 alpha.50/alpha.53.
- Read local custom CDK, target config, synthesized templates, and deployed-state registration script.
- Inspected tagged 0.28.1 deploy, CDK asset, output parser, stack discovery, dependency sync, release pin helper, and import
  source; inspected installed alpha.50 package metadata, public typings, and output-emission code.
- Compared 0.28.1 with stable 0.29.0 and upstream `main`; no custom-CDK boundary change found.
- Searched official repository issues, discussions/search results, pull requests, and releases for custom/BYO/generated
  CDK, stack naming, deployed state, external deployment, import/adoption, and output parsing.
- Read official AgentCore CLI and CloudFormation import/refactoring documentation.
- No AWS deployment, resource mutation, package installation/upgrade, credential output, commit, or source-code change was
  performed.
