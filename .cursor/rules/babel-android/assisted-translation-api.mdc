---
description: Backend API contract for assisted translation
globs: 
alwaysApply: false
---

# Assisted Translation API Contract

## Core Architecture

**Streaming Translation API**: Android app communicates with ElysiaJS backend for cloud-assisted translation with real-time progressive results.

## Model Selection Strategy

**Backend selects paid OpenRouter small models based on complexity parameter with example model names:**

- **Simple Content**: Fast compact models (qwen/qwen2.5-vl-3b-instruct) - <500ms
- **Contextual Content**: Balanced multilingual models (mistralai/mistral-small-3.1-24b-instruct) - <2000ms  
- **Creative Content**: Large context models (google/gemini-2.5-pro-exp-03-25) - <5000ms
- **Technical Content**: Advanced reasoning models (meta-llama/llama-4-maverick) - <3000ms

## Quality & Caching

**Quality Assessment**: Model confidence + consistency + cultural appropriateness + technical accuracy

**Caching Strategy**: 
- Cache by content hash + language pair + complexity
- Simple: 1 hour, Complex: 24 hours
- Privacy-compliant (no personal data)

## Error Handling

**Error Codes**:
- `UNSUPPORTED_LANGUAGE` - Language pair not supported
- `CONTENT_TOO_LARGE` - Content exceeds size limits
- `RATE_LIMIT_EXCEEDED` - Request rate exceeded
- `MODEL_UNAVAILABLE` - Selected model unavailable
- `INTERNAL_ERROR` - Backend processing error
