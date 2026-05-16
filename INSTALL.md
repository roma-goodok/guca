# INSTALL.md — GUCA (Graph Unfolding Cellular Automata — Frontend)

This guide helps you set up a fresh development environment on **macOS** (Intel or Apple Silicon) for the **GUCA** project.

> TL;DR  
> ```bash
> xcode-select --install
> /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
> brew install git
> brew install nvm
> mkdir -p ~/.nvm
> echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
> echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
> echo '[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && . "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"' >> ~/.zshrc
> exec $SHELL
> nvm install --lts
> nvm use --lts
> git clone https://github.com/roma-goodok/guca.git
> cd guca
> npm ci || npm install
> npm run check
> npm run build
> npm run start
> ```
> Then open **http://127.0.0.1:8080** in your browser.

---

## 1) Prerequisites

### 1.1 Xcode Command Line Tools
Install compilers and basic SDK headers:
```bash
xcode-select --install
```

### 1.2 Homebrew
Package manager for macOS:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 1.3 Git
```bash
brew install git
git --version
```

---

## 2) Node.js (via `nvm`)

We recommend the current **LTS** Node.js.

```bash
brew install nvm
mkdir -p ~/.nvm
# Add to your shell rc (zsh is default on macOS)
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
echo '[ -s "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm" ] && . "/opt/homebrew/opt/nvm/etc/bash_completion.d/nvm"' >> ~/.zshrc
exec $SHELL

# Install and select LTS
nvm install --lts
nvm use --lts

# sanity
node -v
npm -v
```

> If you prefer Homebrew’s Node directly: `brew install node@20` (or latest LTS).  
> Then ensure your PATH contains Homebrew’s node binaries:
> ```bash
> echo 'export PATH="/opt/homebrew/opt/node@20/bin:$PATH"' >> ~/.zshrc
> exec $SHELL
> ```

---

## 3) Clone the project

```bash
git clone https://github.com/roma-goodok/guca.git
cd guca
```

If you use SSH:
```bash
git clone git@github.com:roma-goodok/guca.git
cd guca
```

---

## 4) Install dependencies

Prefer reproducible installs:
```bash
npm ci || npm install
```

> This will install dev tools like **webpack**, **jest**, **graphlib**, **d3**, **ts-jest**, etc., as defined in `package.json`.

---

## 5) Build and Test

### 5.1 Run the test suite
```bash
npm test
```

### 5.2 Run type checks
```bash
npm run typecheck
```

### 5.3 Run the standard validation suite
```bash
npm run check
```

### 5.4 Build the bundle
```bash
npm run build
```

The built artifact will be placed in `dist/bundle.js`.

---

## 6) Launch a local static server

For quick local preview (no framework needed):
```bash
npm run start
```
Open **http://127.0.0.1:8080** and you should see the GUCA UI.

> `-c-1` disables caching so edits appear immediately on refresh.

---

## 7) Recommended Editor Setup

- **VS Code** with extensions:
  - “ESLint”
  - “Prettier”
  - “TypeScript TSServer”
- Enable “Format on Save”.

---

## 8) Agent Workflows

Use `AGENTS.md` as the source of truth for AI-agent context, runbook, and commit behavior. Older prompt-bundling helpers have been removed.

---

## 9) Troubleshooting

### 9.1 `sed -i` on macOS (for `deploy.sh`)
macOS `sed` requires a backup suffix:
```bash
# GNU sed style in deploy.sh may fail on macOS. Use:
sed -i '' '/dist\//d' .gitignore
```
Or install GNU sed:
```bash
brew install gnu-sed
gsed -i '/dist\//d' .gitignore
```

### 9.2 Port already in use
`http-server` defaults to `8080`. Choose another:
```bash
npx http-server -p 8081 -c-1
```

### 9.3 Node.js versions
If you switch Node versions, re-run:
```bash
nvm use --lts
npm ci
```

### 9.4 Apple Silicon and native deps
If any native module fails to build, ensure:
```bash
xcode-select --install
brew reinstall python@3.12  # if a package needs python
```

---

## 10) Scripts you can copy‑paste

**Run everything (checks -> build -> serve)**
```bash
npm run check && npm run build && npm run start
```

**Clean install and build**
```bash
rm -rf node_modules package-lock.json
npm install
npx webpack --config webpack.config.js
```

---
