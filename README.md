# 🌍 Babel Feed

A cross-platform mobile application that breaks down language barriers by providing seamless access to global news and video content with integrated, on-device translation.

## 🏗️ Project Architecture

This is an **Nx monorepo** containing:
- **Mobile App**: Tauri-based cross-platform app with Angular 19 frontend
- **Backend API**: ElysiaJS services with shared type definitions
- **Shared Libraries**: Common types and API client libraries

### Tech Stack
- **Framework**: Tauri (Rust + Angular 19)
- **Frontend**: Angular 19 + FrameNG/PrimeNG components
- **Backend**: ElysiaJS + Eden for type-safe API
- **Package Manager**: Bun (not npm)
- **Build System**: Nx with custom optimization scripts

## 🚀 Unified Build System

### Architecture Strategy: ARM64-First (2025)

**Why ARM64-Only Development?**
- **95%+ market share** for ARM64 Android devices (2020+)
- **Google Play requirement**: ARM32 deprecated since 2023
- **20-40% better performance** than ARM32
- **Native performance** on macOS M-series chips
- **GitHub Actions ARM64 runners** now FREE for public repos

### Performance Comparison

| Build Type | Duration | Use Case | Efficiency |
|------------|----------|----------|------------|
| **Full Build (4 archs)** | 4-6 minutes | CI/Production | 25% efficient |
| **ARM64-only Clean** | 60-90 seconds | Development | 75% efficient |
| **Smart Incremental** | 15-30 seconds | Repeated runs | 85% efficient |
| **GitHub ARM64** | 45-75 seconds | Public repos | 80% efficient |

## 🎯 Quick Start

### Prerequisites
```bash
# Install Bun (not npm)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Setup Android environment (for mobile development)
# Follow Tauri Android setup guide
```

### Development Commands

#### **Daily Development (Recommended)**
```bash
# Smart incremental builds - fastest for repeated development
bun run build:mobile              # 15-30 seconds after initial build
bun run test:e2e                  # Fast testing with incremental builds
```

#### **Clean Builds (When Needed)**
```bash
# Clean debug build - when something feels wrong
bun run build:mobile:clean        # 60-90 seconds, ARM64-only

# Clean release build - before commits/testing
bun run build:mobile:release      # Optimized production build

# Force rebuild - when timestamps are confused
bun run build:mobile:force        # Ignores all timestamps, rebuilds everything
```

#### **CI/CD Builds**
```bash
# Full compatibility build (all architectures)
bun run build:mobile:ci           # 4-6 minutes, all Android architectures
```

### Advanced Build Options

The unified build script provides fine-grained control:

```bash
cd apps/babel-mobile

# Show all available options
./scripts/build.sh --help

# Smart incremental build (default)
./scripts/build.sh --smart --debug

# Clean release build for specific architecture
./scripts/build.sh --clean --release --arch aarch64

# Force rebuild with verbose output
./scripts/build.sh --force --verbose

# Full CI-style build
./scripts/build.sh --clean --all-archs --release
```

## 🧠 Smart Build Intelligence

The build system automatically detects what needs rebuilding:

```bash
🔍 Checking timestamps...
📦 Angular src: Changed → Rebuilding
🦀 Rust src: Up-to-date → Skipping  
📱 APK: Missing → Building
```

### Environment Detection
- **`FAST_BUILD=true`**: Enables smart incremental mode
- **`CI=true`**: Switches to clean build with all architectures
- **Local development**: ARM64-only debug builds
- **GitHub Actions**: Optimized ARM64-only release builds

## 📱 Mobile Development

### Supported Platforms
- **Primary**: Android ARM64 (aarch64)
- **Secondary**: Android x86_64 (emulators)
- **Deprecated**: ARM32 (armv7) - skip unless specifically needed

### Testing Strategy
```bash
# Fast development testing
bun run test:e2e                  # Uses smart builds, ~30 seconds

# Full validation testing  
bun run test:e2e:full             # Clean builds, ~2 minutes

# Local CI simulation
bun run test:ci:local             # Full CI setup locally
```

## 🌍 GitHub Actions Optimization

### For Public Repositories (FREE ARM64)
```yaml
jobs:
  build-android:
    runs-on: ubuntu-24.04-arm  # FREE ARM64 runners
    steps:
      - name: Build ARM64
        run: cd apps/babel-mobile && ./scripts/build.sh --clean --release --arch aarch64
```

### For Private Repositories
```yaml
# Option 1: Standard runners with full compatibility
jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - name: Build All Architectures  
        run: cd apps/babel-mobile && ./scripts/build.sh --clean --all-archs --release

# Option 2: Self-hosted ARM64 (10x cheaper)
jobs:
  build-android:
    runs-on: runs-on,family=r8g,hdd=50,image=ubuntu24-full-arm64
    steps:
      - name: Native ARM64 Build
        run: cd apps/babel-mobile && ./scripts/build.sh --clean --release --arch aarch64
```

## 🎛️ Development Workflows

### Typical Development Session
```bash
# Initial build (60-90 seconds)
bun run build:mobile

# Make code changes...
# Smart rebuild (15-30 seconds)
bun run build:mobile

# More changes...
# Smart rebuild (15-20 seconds)  
bun run build:mobile

# No changes made...
# Skip build (2-5 seconds)
bun run build:mobile
```

### Before Committing
```bash
# Test release build
bun run build:mobile:release

# Run full test suite
bun run test:e2e:full

# If issues, force clean rebuild with verbose output
cd apps/babel-mobile && ./scripts/build.sh --force --verbose
```

## 🔍 Troubleshooting

### Build Issues
```bash
# Force rebuild with full diagnostics
cd apps/babel-mobile && ./scripts/build.sh --force --verbose

# Clean build with verbose output
cd apps/babel-mobile && ./scripts/build.sh --clean --verbose
```

### Common Problems

#### "APK not found"
```bash
# Usually fixed with force rebuild
bun run build:mobile:force
```

#### "Timestamp issues" 
```bash
# Force rebuild ignores all timestamps
cd apps/babel-mobile && ./scripts/build.sh --force
```

#### "Architecture mismatch"
```bash
# Build for all architectures for debugging
cd apps/babel-mobile && ./scripts/build.sh --all-archs --verbose
```

## 📚 Project Structure

```
tauri-babel-feed/
├── apps/
│   ├── babel-api/          # ElysiaJS backend services
│   └── babel-mobile/       # Tauri mobile app
│       ├── scripts/
│       │   └── build.sh    # Unified build script
│       ├── src/            # Angular app source
│       ├── src-tauri/      # Rust/Tauri source
│       └── wdio.conf.js    # WebDriver test config
├── libs/
│   ├── api-client/         # Shared API client
│   └── shared-types/       # Common TypeScript types
└── package.json            # Root package.json with scripts
```

## 💡 Best Practices

1. **Default to smart builds** - Let the system decide what to rebuild
2. **Use `--force` when confused** - Still faster than full multi-arch builds
3. **Test release builds** before important commits
4. **Monitor build times** - Smart builds should be <30 seconds
5. **Keep APKs around** - Smart mode uses them for timestamp comparison

## 🚦 Environment Variables

- **`FAST_BUILD=true`**: Enable smart incremental builds
- **`CI=true`**: Enable clean builds with all architectures  
- **`API_LEVEL=30`**: Set Android API level (default: 30)
- **`AVD_NAME=Custom_AVD`**: Specify Android Virtual Device name

## 📖 Additional Documentation

- **[Build Optimization Guide](apps/babel-mobile/BUILD_OPTIMIZATION.md)**: Detailed build system documentation
- **[Tauri Android Guide](https://tauri.app/guides/building/android/)**: Official Tauri Android setup
- **[Nx Documentation](https://nx.dev)**: Nx monorepo documentation

## 🤝 Contributing

1. **Use ARM64-focused development** (matches 95% of real devices) 
2. **Test with smart builds** during development
3. **Validate with release builds** before PR submission
4. **Run full test suite** (`bun run test:e2e:full`) for major changes

## 📄 License

[Add your license information here]

---

**Built with ❤️ for global communication and understanding** 