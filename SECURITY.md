# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Key Storage & Privacy Architecture

- **Encrypted Local Storage**: API keys saved via the dashboard are encrypted on disk using AES-256-GCM with PBKDF2 key derivation (\secrets.json\ + \.master.key\).
- **Zero Key Exposure**: API keys are always masked as \irst4••••••••last4\ before being sent over API endpoints or rendered in the DOM. Full secrets are never delivered to the client.
- **Git Protection**: Sensitive credential files (\.env\, \secrets.json\, \.master.key\) are ignored by default in \.gitignore\.

## Reporting a Vulnerability

If you discover a security issue or vulnerability in **AI Router**, please do NOT open a public GitHub issue. Instead, please report it privately to the maintainers at:

📧 **security@mapki.com** (or open a GitHub Security Advisory)

We will respond promptly within 48 hours to evaluate and patch the issue.
