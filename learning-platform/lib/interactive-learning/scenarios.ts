export type ScenarioInput =
  | { scenario: "duplicate-payroll"; amount: number; deliveries: number }
  | {
      scenario: "cross-employee-access";
      role: "Employee" | "Manager";
      requester: ScenarioRequester;
      target: "EMP-104" | "EMP-208";
    }
  | {
      scenario: "deployment-readiness";
      databaseAvailable: boolean;
      migrationCompatible: boolean;
    };

export type ScenarioRequester = "EMP-104" | "EMP-208" | "MGR-1" | "MGR-2";

export type ScenarioResult = {
  defect: boolean;
  observed: string;
  expected: string;
  summary: string;
  concepts: string;
};

const employeeRecords = {
  "EMP-104": { name: "Alex Morgan", payrollStatus: "Approved", team: "TEAM-A" },
  "EMP-208": { name: "Jordan Lee", payrollStatus: "Pending", team: "TEAM-B" },
} as const;

export function runEngineeringScenario(input: ScenarioInput): ScenarioResult {
  if (input.scenario === "duplicate-payroll") {
    if (
      !Number.isFinite(input.amount) ||
      input.amount < 0.01 ||
      input.amount > 10_000_000 ||
      !Number.isInteger(input.deliveries) ||
      input.deliveries < 1 ||
      input.deliveries > 10
    ) {
      throw new Error("Enter a valid amount and between 1 and 10 deliveries.");
    }

    const observedTotal = input.amount * input.deliveries;
    const defect = input.deliveries > 1;
    return {
      defect,
      observed: `Ledger entries: ${input.deliveries}\nTotal credited: $${observedTotal.toFixed(2)}`,
      expected: `Ledger entries: 1\nTotal credited: $${input.amount.toFixed(2)}`,
      summary: defect
        ? "A retried payroll event was applied more than once."
        : "No duplicate was reproduced with a single delivery.",
      concepts:
        "At-least-once delivery, idempotency keys, deduplication, transactional outbox/inbox, and exactly-once effect.",
    };
  }

  if (input.scenario === "cross-employee-access") {
    const record = employeeRecords[input.target];
    const permitted =
      (input.role === "Employee" && input.requester === input.target) ||
      (input.role === "Manager" &&
        ((input.requester === "MGR-1" && record.team === "TEAM-A") ||
          (input.requester === "MGR-2" && record.team === "TEAM-B")));
    const visibleRecord = {
      name: record.name,
      payrollStatus: record.payrollStatus,
    };
    const defect = !permitted;
    return {
      defect,
      observed: `200 OK\nReturned record: ${JSON.stringify(visibleRecord)}`,
      expected: permitted
        ? `200 OK\nReturned record: ${JSON.stringify(visibleRecord)}`
        : "403 Forbidden (or a privacy-preserving 404)",
      summary: defect
        ? "A user accessed another employee's payroll record."
        : "No unauthorized record access was reproduced for this test.",
      concepts:
        "Authentication vs. authorization, object-level access control (IDOR/BOLA), least privilege, tenant isolation, and audit logging.",
    };
  }

  const ready =
    input.databaseAvailable && input.migrationCompatible;
  const defect = !ready;
  return {
    defect,
    observed: `Readiness probe: 200 READY\nUser request: ${ready ? "200 OK" : "503 SERVICE UNAVAILABLE"}`,
    expected: `Readiness probe: ${ready ? "200 READY" : "503 NOT READY"}\nUser request: ${ready ? "200 OK" : "503 SERVICE UNAVAILABLE"}`,
    summary: defect
      ? "The readiness probe reports healthy while a critical dependency or schema is unavailable."
      : "No false-ready deployment was reproduced with these dependency settings.",
    concepts:
      "Readiness vs. liveness, dependency health, rolling deployments, schema expand/contract, traffic routing, rollback, and observability.",
  };
}
