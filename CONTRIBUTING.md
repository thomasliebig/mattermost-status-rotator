# Contributing to Mattermost Status Rotator

Useful contributions include compatibility reports, improved emoji mappings, accessibility fixes, and small usability improvements.

For bug reports, include:

- Mattermost version and whether it is Cloud or self-hosted
- browser name and version
- the smallest status file that reproduces the problem
- expected and actual behavior
- relevant console errors with tokens, hostnames, and private messages removed

Load `mattermost-status-rotator/` as an unpacked extension and test start, stop, persistence, and status rotation before opening a pull request. Never commit Mattermost tokens, private server URLs, or personal status files.
