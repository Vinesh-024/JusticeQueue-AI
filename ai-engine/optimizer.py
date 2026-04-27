"""
optimizer.py — OR-Tools CP-SAT global re-optimization for case scheduling

Strategy:
  - Each case occupies exactly 1 slot (30 minutes)
  - Working hours: Mon–Fri, 9:00–17:00
  - 16 slots per day (8 hours × 2 slots/hour)
  - Objective: maximize weighted urgency/complexity for earlier slots
  - No two cases overlap (enforced by CP-SAT non-overlap constraint)
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta
from typing import Any

log = logging.getLogger("optimizer")

SLOTS_PER_DAY = 16      # 9:00–17:00 in 30-min increments
WORK_DAYS = 5           # Mon–Fri
TOTAL_SLOTS = SLOTS_PER_DAY * WORK_DAYS  # 80 slots


def _get_next_monday() -> datetime:
    now = datetime.now()
    days_ahead = (7 - now.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    next_monday = now + timedelta(days=days_ahead)
    return next_monday.replace(hour=9, minute=0, second=0, microsecond=0)


def _slot_to_datetime(slot_index: int, start: datetime) -> str:
    """Convert slot index (0-based) to ISO datetime string."""
    day = slot_index // SLOTS_PER_DAY
    slot_in_day = slot_index % SLOTS_PER_DAY

    # Advance by business days
    current = start
    days_added = 0
    while days_added < day:
        current += timedelta(days=1)
        if current.weekday() < 5:  # Mon–Fri
            days_added += 1

    result = current + timedelta(minutes=slot_in_day * 30)
    return result.isoformat()


class CaseOptimizer:
    """
    Uses Google OR-Tools CP-SAT solver to optimally assign hearing slots to cases.
    The objective maximizes total priority weighted by how early the slot is.
    """

    def optimize(self, cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not cases:
            return []

        n = len(cases)
        log.info(f"Running OR-Tools CP-SAT optimization for {n} cases …")

        try:
            from ortools.sat.python import cp_model
        except ImportError:
            log.warning("OR-Tools not installed — using greedy fallback")
            return self._greedy_fallback(cases)

        model = cp_model.CpModel()
        start_date = _get_next_monday()

        # Scale scores to integers (CP-SAT works with integers)
        def score(case: dict) -> int:
            urgency = case.get("urgency_score", 50)
            complexity = case.get("complexity_score", 50)
            return int(urgency * 70 + complexity * 30)  # × 100 fixed point

        # Decision variables: slot assigned to each case
        slots = [
            model.NewIntVar(0, TOTAL_SLOTS - 1, f"slot_{i}")
            for i in range(n)
        ]

        # Constraint: all slots distinct (no scheduling overlap)
        model.AddAllDifferent(slots)

        # Objective: maximize Σ score(i) × (TOTAL_SLOTS − slot[i])
        # Cases with higher score get earlier (lower-index) slots
        objective_terms = []
        for i, case in enumerate(cases):
            s = score(case)
            # Create auxiliary variable for (TOTAL_SLOTS - slot[i])
            inv_slot = model.NewIntVar(1, TOTAL_SLOTS, f"inv_{i}")
            model.Add(inv_slot == TOTAL_SLOTS - slots[i])
            term = model.NewIntVar(0, s * TOTAL_SLOTS, f"term_{i}")
            model.AddMultiplicationEquality(term, [inv_slot, model.NewConstant(s)])
            objective_terms.append(term)

        # Feature C: Case-Clustering by case_type
        # We penalize the span (max_slot - min_slot) for cases of the same type.
        CLUSTER_WEIGHT = 2000
        from collections import defaultdict
        type_groups = defaultdict(list)
        for i, case in enumerate(cases):
            ctype = case.get("case_type", "Unknown")
            if ctype != "Unknown":
                type_groups[ctype].append(i)

        penalty_terms = []
        for ctype, indices in type_groups.items():
            if len(indices) > 1:
                safe_ctype = "".join(c for c in ctype if c.isalnum())
                max_s = model.NewIntVar(0, TOTAL_SLOTS - 1, f"max_slot_{safe_ctype}")
                min_s = model.NewIntVar(0, TOTAL_SLOTS - 1, f"min_slot_{safe_ctype}")
                model.AddMaxEquality(max_s, [slots[i] for i in indices])
                model.AddMinEquality(min_s, [slots[i] for i in indices])
                
                span = model.NewIntVar(0, TOTAL_SLOTS - 1, f"span_{safe_ctype}")
                model.Add(span == max_s - min_s)
                penalty_terms.append(span * CLUSTER_WEIGHT)

        model.Maximize(sum(objective_terms) - sum(penalty_terms))

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 10.0
        status = solver.Solve(model)

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            log.info(f"OR-Tools found solution (status={status})")
            result = []
            for i, case in enumerate(cases):
                assigned_slot = solver.Value(slots[i])
                result.append({
                    "id": case["id"],
                    "scheduled_slot": _slot_to_datetime(assigned_slot, start_date),
                    "rank": i + 1,  # will be re-ranked after sort
                    "_slot_index": assigned_slot,
                })
            # Sort by slot index to assign ranks
            result.sort(key=lambda x: x["_slot_index"])
            for rank, item in enumerate(result, 1):
                item["rank"] = rank
                del item["_slot_index"]
            return result
        else:
            log.warning("CP-SAT did not find feasible solution — falling back to greedy")
            return self._greedy_fallback(cases)

    def _greedy_fallback(self, cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Sort by weighted score descending and assign consecutive slots."""
        start_date = _get_next_monday()

        def score(c: dict) -> float:
            return c.get("urgency_score", 50) * 0.7 + c.get("complexity_score", 50) * 0.3

        # Cluster by case_type, then prioritize by score descending
        sorted_cases = sorted(cases, key=lambda c: (c.get("case_type", "Unknown"), -score(c)))
        result = []
        for rank, case in enumerate(sorted_cases, 1):
            result.append({
                "id": case["id"],
                "scheduled_slot": _slot_to_datetime(rank - 1, start_date),
                "rank": rank,
            })
        return result
