```yaml
---
name: test-driven-development
description: Language-agnostic TDD workflow for any software project—write the test first, see it fail, write the minimal code to pass, then refactor. Ensures behavior is verified before implementation.
---
```

# Test-Driven Development (TDD)

## Core Principle

Write the **test first**, watch it **fail**, write the **minimum code** to make it **pass**, and then **refactor**.
If you didn’t see the test fail first, you can’t trust that it tests the right thing.

---

## When to Use

**Default:** Always — for new features, bug fixes, refactors, and behavior changes.
**Possible exceptions (confirm with your human partner):** disposable prototypes, generated code, or configuration-only changes.

---

## Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

If code exists before a test, delete it and start again from the test.
No “reference implementations,” no “temporary” code — delete means delete.

---

## Red → Green → Refactor (RGR)

1. **RED:** Define the expected behavior as a test.
2. **Verify RED:** Run tests and ensure it fails for the correct reason.
3. **GREEN:** Implement the smallest change needed to make the test pass.
4. **Verify GREEN:** Confirm all tests pass with no warnings or noise.
5. **REFACTOR:** Simplify design while keeping all tests green.
6. **Repeat** for each new behavior.

---

## Minimal, Language-Agnostic Example

### **RED – Define the Expected Behavior**

**Test name:** “Retries the operation up to three times before succeeding.”
**Given:** An operation that fails twice and succeeds on the third attempt.
**When:** The retry mechanism executes that operation.
**Then:**

* The final result is “success.”
* The operation was attempted exactly three times.

**Guidelines:**

* One behavior per test.
* Use clear, descriptive names.
* Express intent, not implementation.
* Avoid “and” in the test name.

---

### **Verify RED – Watch It Fail**

Run the tests.

Confirm:

* The new test fails (not crashes).
* It fails for the *expected reason* — the behavior is missing.
* If the test passes immediately, it’s invalid.
* If it errors, fix the test setup until it fails correctly.

---

### **GREEN – Implement the Minimum Change**

* Add only the smallest amount of logic required for this test to pass.
* No extra features, options, or abstractions.
* Don’t refactor yet — focus on correctness, not elegance.

Goal: one test green.

---

### **Verify GREEN – Confirm Success**

Run the full test suite.

Confirm:

* The new test passes.
* All other tests still pass.
* Output is clean (no warnings or unhandled errors).

If any test fails, fix the code (not the tests) until all pass.

---

### **REFACTOR – Clean While Staying Green**

After all tests are green:

* Remove duplication.
* Improve naming and structure.
* Simplify interfaces and logic.

Keep all tests green at every step.

---

## What Makes a Good Test

| Quality           | Good                           | Bad                                  |
| ----------------- | ------------------------------ | ------------------------------------ |
| **Focus**         | Verifies one specific behavior | Combines multiple unrelated checks   |
| **Clarity**       | Describes what should happen   | Ambiguous or uses internal names     |
| **Behavioral**    | Tests external behavior        | Tests private implementation details |
| **Deterministic** | Always yields the same result  | Depends on randomness or timing      |

---

## Verification Before Marking Work Complete

* [ ] Every new or changed behavior has a test.
* [ ] You saw each test **fail** first.
* [ ] Each failure was for the **expected reason** (not typos).
* [ ] Wrote the **minimal code** to pass.
* [ ] All tests pass with clean output.
* [ ] Refactoring kept all tests green.
* [ ] Tests describe **real behavior**, not mocks (use doubles only when isolating unstable boundaries).

If any box is unchecked, it’s not TDD — start over.

---

## Common Rationalizations → Reality

| Excuse                        | Reality                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| “Too simple to test.”         | Simple code fails too; test takes minutes.                       |
| “I’ll add tests after.”       | If it passes immediately, it never failed — test is meaningless. |
| “Mocking everything is fine.” | Over-coupling smell — redesign for testability.                  |
| “We need to explore first.”   | Exploration is fine — but delete and re-implement with tests.    |
| “TDD slows me down.”          | TDD prevents debugging and regressions — it’s faster overall.    |

---

## When Stuck

| Problem                 | Guidance                                                                      |
| ----------------------- | ----------------------------------------------------------------------------- |
| Don’t know what to test | Describe the desired behavior in plain language. Write that down as the test. |
| Test is too complex     | Design is likely too complex. Simplify interface.                             |
| Need heavy mocking      | Code too coupled. Use dependency injection or clear boundaries.               |
| Setup is large          | Extract helpers or rethink design responsibilities.                           |

---

## Bugfix Protocol

When fixing a bug:

1. Write a test that **reproduces the bug** (RED).
2. Make it pass with the simplest fix (GREEN).
3. Clean up without changing behavior (REFACTOR).

Never fix a bug without a failing test.

---

## Final Rule

```
If production code exists → there’s a test that failed before it passed.
Otherwise → it’s not TDD.
```

---

Would you like me to make this version follow a **markdown style with callout boxes (✅ / ⚠️ / 💡)** for readability — like a skill card or internal team guide format? It can make it easier to use in wikis or engineering handbooks.
