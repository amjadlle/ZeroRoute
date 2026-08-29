# Contributing to ZeroRoute

Thank you for your interest in contributing to **ZeroRoute**! We welcome contributions from developers, solo founders, and open-source enthusiasts.

## How to Contribute

1. **Fork the repository** on GitHub: [github.com/amjadlle/ZeroRoute](https://github.com/amjadlle/ZeroRoute)
2. **Clone your fork**:
   \\\ash
   git clone https://github.com/your-username/ZeroRoute.git
   cd ZeroRoute
   \\\
3. **Install dependencies**:
   \\\ash
   npm install
   \\\
4. **Copy the environment configuration**:
   \\\ash
   cp .env.example .env
   \\\
5. **Start the development server**:
   \\\ash
   npm run dev
   \\\
6. **Create a feature branch**:
   \\\ash
   git checkout -b feature/my-cool-feature
   \\\
7. **Commit your changes**:
   \\\ash
   git commit -m 'feat: add support for new provider X'
   \\\
8. **Push to your branch**:
   \\\ash
   git push origin feature/my-cool-feature
   \\\
9. **Open a Pull Request** against the \main\ branch.

## Adding a New Provider

To add a new AI provider:
1. Open \src/providers.ts\ and implement the provider configuration with \generate\ and \generateStream\ handlers.
2. Add the provider's API key mapping in \src/secrets.ts\.
3. Add recommended models in \src/dashboard.ts\ under \PROVIDER_MODELS\.
4. Run \
pm run build\ and test with \
pm test\ or \
pm run dev\.

## Code Guidelines
- TypeScript strict mode enabled (\	sconfig.json\).
- Maintain zero external runtime dependencies.
- Ensure all API keys and credentials remain masked and encrypted.
