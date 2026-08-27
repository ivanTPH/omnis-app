#!/usr/bin/env python3
"""
Entrypoint for the weekly scheduled run. Designed to be invoked right after the
existing Oak delta sync (`npm run oak:delta`), so freshly-synced curriculum
content is available to the CURRICULUM_ALIGNMENT judge before anything else runs
that week -- see INTEGRATION.md for exactly where this slots into the cron.

Iterates every (skillId, agentType) pair from signatures.AGENT_SKILL_MAP, not
every skillId alone -- a skill used by several agents (e.g. SEND_DIFFERENTIATION,
used by COACH, QUALITY, PLAN_SYNTHESIS, EVIDENCE, and ENGAGE) is optimized once
per agent, each against only that agent's own AgentAuditEntry rows, and each
producing its own independent AgentSkillVersion. A pair with too little reviewed
data yet is skipped on its own -- one agent's skill usage having enough volume
doesn't borrow another agent's data or unlock its optimization early.

Usage:
    python weekly_run.py [--skills SKILL1,SKILL2] [--agents AGENT1,AGENT2] [--min-examples 40] [--dry-run]
"""
import argparse
import sys
import traceback

import dspy

import data
from optimize import optimize_skill
from metrics import slow_validation_summary
from signatures import AGENT_SKILL_MAP, agent_skill_pairs


def configure_lm():
    # Swap for whichever LM the app already uses in production -- optimizing
    # against a different model than production serves defeats the point.
    lm = dspy.LM("anthropic/claude-sonnet-4-5")
    dspy.settings.configure(lm=lm)


def _pair_key(skill_id: str, agent_type: str) -> str:
    return f"{agent_type}/{skill_id}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skills", type=str, default=None,
                         help="comma-separated AgentSkillId list; default = every skill")
    parser.add_argument("--agents", type=str, default=None,
                         help="comma-separated AgentType list; default = every agent that uses each targeted skill")
    parser.add_argument("--min-examples", type=int, default=40)
    parser.add_argument("--dry-run", action="store_true", help="optimize and score, but never write isActive=true")
    args = parser.parse_args()

    configure_lm()

    all_pairs = agent_skill_pairs()
    skill_filter = set(s.strip() for s in args.skills.split(",")) if args.skills else None
    agent_filter = set(a.strip() for a in args.agents.split(",")) if args.agents else None

    candidate_pairs = [
        (skill_id, agent_type) for skill_id, agent_type in all_pairs
        if (skill_filter is None or skill_id in skill_filter)
        and (agent_filter is None or agent_type in agent_filter)
    ]

    targets = [
        (skill_id, agent_type) for skill_id, agent_type in candidate_pairs
        if data.count_new_reviewed_examples(skill_id, agent_type, since=None) >= args.min_examples
    ]

    if not targets:
        print("No (agentType, skillId) pair has enough new reviewed examples this week. Nothing to do.")
        return 0

    run_id = data.create_optimization_run(
        triggered_by="weekly-oak-cron",
        skills_targeted=[{"skillId": s, "agentType": a} for s, a in targets],
    )
    print(f"AgentOptimizationRun {run_id}: targeting {[_pair_key(s, a) for s, a in targets]}")

    summary = {}
    had_failure = False

    for skill_id, agent_type in targets:
        key = _pair_key(skill_id, agent_type)
        print(f"\n--- {key} ---")
        try:
            result = optimize_skill(skill_id, agent_type, min_examples=args.min_examples)
        except Exception as e:
            had_failure = True
            summary[key] = {"error": str(e)}
            print(f"FAILED: {e}\n{traceback.format_exc()}")
            continue

        if result["skipped"]:
            print(result["reason"])
            summary[key] = {"skipped": True, "reason": result["reason"]}
            continue

        promote = result["promote"] and not args.dry_run
        version_id = data.write_skill_version(
            skill_id=skill_id,
            agent_type=agent_type,
            instructions=result["instructions"],
            demonstrations=result["demonstrations"],
            metric_score=result["metric_score"],
            metric_breakdown=result["metric_breakdown"],
            training_example_count=result["training_example_count"],
            optimizer_run_id=run_id,
            promote=promote,
        )
        print(f"score={result['metric_score']:.3f} "
              f"(baseline={result['metric_breakdown']['baseline_score']:.3f}, "
              f"active={result['metric_breakdown']['active_score']}) "
              f"-> {version_id} {'[PROMOTED]' if promote else '[recorded only]'}")
        summary[key] = {
            "skillId": skill_id,
            "agentType": agent_type,
            "version_id": version_id,
            "metric_score": result["metric_score"],
            "promoted": promote,
        }

    # Slow-metric tripwire: check the effect of whatever was promoted LAST run
    # before this run's promotions take further effect. If it regressed, we still
    # record this run's results but flag it loudly rather than silently compounding.
    _check_last_promotion_regression(summary)

    status = "succeeded" if not had_failure else "partial_failure"
    data.finish_optimization_run(run_id, status=status, summary=summary)
    print(f"\nAgentOptimizationRun {run_id}: {status}")
    return 1 if had_failure else 0


def _check_last_promotion_regression(summary: dict):
    import datetime
    now = datetime.datetime.utcnow()
    two_weeks_ago = now - datetime.timedelta(days=14)
    four_weeks_ago = now - datetime.timedelta(days=28)
    for key, entry in summary.items():
        skill_id = entry.get("skillId")
        agent_type = entry.get("agentType")
        if not skill_id or not agent_type:
            continue
        before = data.completion_and_progress_window(skill_id, agent_type, four_weeks_ago, two_weeks_ago)
        after = data.completion_and_progress_window(skill_id, agent_type, two_weeks_ago, now)
        verdict = slow_validation_summary(before, after)
        if verdict["regressed"]:
            print(f"  !! {key}: slow-metric regression flags {verdict['flags']} "
                  f"-- review before trusting further auto-promotions for this pair.")
            entry["slow_metric_warning"] = verdict


if __name__ == "__main__":
    sys.exit(main())
