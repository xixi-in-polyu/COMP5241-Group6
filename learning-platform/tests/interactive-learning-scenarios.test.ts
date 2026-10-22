import { describe, expect, it } from "vitest";

import { runEngineeringScenario } from "@/lib/interactive-learning/scenarios";

describe("interactive learning reliability scenarios", () => {
  it("reproduces duplicate payroll entries when an event is retried", () => {
    const result = runEngineeringScenario({
      scenario: "duplicate-payroll",
      amount: 850,
      deliveries: 2,
    });

    expect(result.defect).toBe(true);
    expect(result.observed).toContain("Total credited: $1700.00");
    expect(result.expected).toContain("Total credited: $850.00");
  });

  it("does not report a duplicate for a single delivery", () => {
    const result = runEngineeringScenario({
      scenario: "duplicate-payroll",
      amount: 850,
      deliveries: 1,
    });

    expect(result.defect).toBe(false);
  });

  it("reproduces unauthorized cross-employee payroll access", () => {
    const result = runEngineeringScenario({
      scenario: "cross-employee-access",
      role: "Employee",
      requester: "EMP-104",
      target: "EMP-208",
    });

    expect(result.defect).toBe(true);
    expect(result.observed).toContain("200 OK");
    expect(result.expected).toContain("403 Forbidden");
  });

  it("allows a manager to access records in their assigned team", () => {
    const result = runEngineeringScenario({
      scenario: "cross-employee-access",
      role: "Manager",
      requester: "MGR-1",
      target: "EMP-104",
    });

    expect(result.defect).toBe(false);
  });

  it("reports a deployment as unhealthy when a critical dependency is unavailable", () => {
    const result = runEngineeringScenario({
      scenario: "deployment-readiness",
      databaseAvailable: false,
      migrationCompatible: true,
    });

    expect(result.defect).toBe(true);
    expect(result.observed).toContain("200 READY");
    expect(result.expected).toContain("503 NOT READY");
  });

  it("rejects out-of-range payroll scenario input", () => {
    expect(() =>
      runEngineeringScenario({
        scenario: "duplicate-payroll",
        amount: -1,
        deliveries: 2,
      }),
    ).toThrow("Enter a valid amount");
  });
});
