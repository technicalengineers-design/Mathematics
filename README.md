# Math-Examples-and-Practice

This project is in work. Let me know if you find an error.

## Automatic GitHub sync

Run the VS Code task `GitHub: Auto-sync changes` from `Terminal: Run Task`, or run `npm run sync:watch` in a terminal, to monitor local changes. After 10 seconds without a new change, the watcher stages, commits, and pushes to the configured `origin` remote. Stop it with `Ctrl+C`.

Git for Windows and Node.js must be installed and available in the VS Code terminal. The repository must also have a configured `origin` remote, Git identity, and GitHub authentication. Verify the setup with `git remote -v`, `git config user.name`, and `git config user.email` before starting the task.
