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

Then:
- create or switch to a new branch using the Linear branch name if available, otherwise use identifier-title
- implement only that ticket
- write or update tests first where practical
- run lint, typecheck and tests
- provide final summary with files changed, commands run, known gaps and PR readiness

Do not start another ticket.
Do not implement stretch goals.