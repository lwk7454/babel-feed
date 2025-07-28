# AI Agent Debugging Guide: Long-Running Services

  Overview

  This document outlines a systematic approach for AI agents to debug complex, long-running services like news
  aggregators. The methodology successfully diagnosed the news-aggregator source discovery system in a local
  development environment.

  Core Principles

  1. Never Block on Interactive Processes

  - Problem: Long-running commands and interactive sessions block the agent indefinitely
  - Solution: Use tmux for CLI commands, especially those starting with `nx`
  - Key Learning: Always assume any command might run longer than expected

  2. Systematic Information Gathering

  - Start with codebase structure before diving into specific issues
  - Understand the architecture before testing functionality
  - Read configuration files to understand system dependencies

  3. Incremental Testing Strategy

  - Test simple functionality before complex operations
  - Verify each component works independently
  - Build confidence in working systems before investigating failures


  Key Lessons Learned

  Technical Insights

  1. Use service APIs over direct database access when possible
  2. Background jobs may need manual triggering for immediate testing
  3. Database connection methods vary between test and development environments
  4. CLI tools may have different environment setups than the main service

  Process Insights

  1. Tmux is essential for debugging long-running services
  2. Incremental testing builds confidence and isolates issues
  3. Multiple verification methods provide comprehensive validation
  4. Understanding architecture first saves time in debugging

  Agent Behavior Insights

  1. Don't assume commands will complete quickly
  2. Always capture and analyze output systematically
  3. Use timeouts and interrupts proactively
  4. Document findings progressively using todo tracking

  Template for Future Debugging Sessions

  # 1. Setup
  tmux new-session -d -s debug-server -c /project/path
  tmux new-session -d -s debug-cli -c /project/path

  # 2. Start service
  tmux send-keys -t debug-server "nx run service:dev" Enter
  sleep 10 && tmux capture-pane -t debug-server -p | tail -20

  # 3. Test basic functionality
  tmux send-keys -t debug-cli "nx run service:cli -- status" Enter
  sleep 5 && tmux capture-pane -t debug-cli -p

  # 4. Verify via API
  curl -s http://localhost:PORT/health

  # 5. Test specific feature
  tmux send-keys -t debug-cli "nx run service:cli -- test-feature" Enter
  sleep 5 && tmux capture-pane -t debug-cli -p

  # 6. Cleanup
  tmux kill-session -t debug-server
  tmux kill-session -t debug-cli

  This methodology provides a robust framework for systematically debugging complex services while avoiding common
  pitfalls that can block AI agents.