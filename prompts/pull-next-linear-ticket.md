Use Linear MCP.

First inspect all open issues in the EXP team and list their:
- identifier
- title
- state
- priority
- labels

Select exactly one ticket using this order:

1. Any open issue labelled must-fix-before-next-feature.
2. Any open issue labelled copilot-review.
3. Any open issue in a state named Review Findings.
4. If none of the above exist, select the lowest-numbered open assignment ticket by A-number in the title.

Assignment tickets are titled like:
- A5 Implement mock LLM scenarios
- A6 Implement agent runtime loop and guards
- A7 Implement tool executor and retry handling

Do not select A13 before A7-A12 are done.
Do not use Linear priority to reorder normal assignment tickets.
Only use Linear priority to break ties between review-fix tickets.

Before coding, report:
- selected ticket ID and title
- why it was selected
- branch name to use
- scope boundaries

Git and PR requirements:
- create or switch to a new branch using the Linear branch name if available, otherwise use identifier-title
- immediately run `git branch --show-current`
- if the current branch is still `main`, stop and report the branch creation failure
- do not edit files on `main`
- after implementation and verification, commit the changes
- push the branch to origin
- create a GitHub PR using `gh pr create`
- PR title must include the assignment number and Linear issue key, for example: `A8 EXP-13: Add API routes`
- PR body must include a Linear closing keyword: `Closes EXP-XX`
- before reporting PR readiness, confirm the PR URL was created

Then:
- implement only that ticket
- write or update tests first where practical
- run lint, typecheck and tests
- commit the completed work
- push the branch
- create the PR
- provide the concise final summary

Output control:
- do not print full diffs
- do not paste large file contents
- do not include patch output unless a command failed and the patch is needed to explain the failure
- at the end, provide only:
  - selected ticket
  - branch
  - commit hash
  - PR URL
  - files changed
  - commands run
  - test results
  - known gaps

Do not start another ticket.
Do not implement stretch goals.