# Babel Feed Design System

This directory contains the shared design system for the Babel Feed application, built on top of PrimeNG's design tokens.

## File Structure

```
src/app/styles/
├── _tokens.scss      # Design tokens (spacing, typography, colors, etc.)
├── _layouts.scss     # Layout utilities (flexbox, grid, positioning)
├── _typography.scss  # Typography utilities (headings, body text, links)
├── _components.scss  # Shared component styles (cards, buttons, states)
└── README.md        # This documentation
```

## Design Tokens (`_tokens.scss`)

### Spacing
Use consistent spacing tokens instead of hardcoded values:
```scss
// ❌ Don't do this
margin: 16px;
padding: 20px;

// ✅ Do this
margin: var(--spacing-lg);
padding: var(--spacing-xl);
```

Available spacing tokens:
- `--spacing-xs` (4px)
- `--spacing-sm` (8px)
- `--spacing-md` (12px)
- `--spacing-lg` (16px)
- `--spacing-xl` (20px)
- `--spacing-2xl` (24px)
- `--spacing-3xl` (32px)
- `--spacing-4xl` (40px)
- `--spacing-5xl` (48px)
- `--spacing-6xl` (64px)

### Typography
```scss
// Font sizes
font-size: var(--font-size-lg);

// Font weights
font-weight: var(--font-weight-semibold);

// Line heights
line-height: var(--line-height-normal);
```

### Border Radius
```scss
border-radius: var(--border-radius-lg);
```

### Shadows
```scss
box-shadow: var(--shadow-md);
```

### Transitions
```scss
transition: var(--transition-normal);
```

## Layout Utilities (`_layouts.scss`)

### Flexbox
```html
<div class="flex flex-col items-center justify-between">
  <!-- content -->
</div>
```

### Spacing Utilities
```html
<!-- Margin -->
<div class="m-lg mt-xl mb-2xl">

<!-- Padding -->
<div class="p-md pt-lg">
```

### Width/Height
```html
<div class="w-full h-screen max-w-lg">
```

## Typography Utilities (`_typography.scss`)

### Headings
```html
<h1 class="heading-1">Main Title</h1>
<h2 class="heading-2">Section Title</h2>
<h3 class="heading-3">Subsection</h3>
```

### Body Text
```html
<p class="body-large">Large body text</p>
<p class="body-normal">Normal body text</p>
<p class="body-small">Small body text</p>
```

### Text Utilities
```html
<span class="text-bold text-primary">Bold primary text</span>
<span class="text-secondary text-truncate">Secondary truncated text</span>
```

## Component Styles (`_components.scss`)

### Containers
```html
<div class="page-container container-centered">
  <div class="container p-xl">
    <!-- content -->
  </div>
</div>
```

### Headers
```html
<div class="header">
  <div class="header-icon">📰</div>
  <h1 class="header-title">App Title</h1>
  <p class="header-subtitle">Subtitle</p>
</div>
```

### Sections
```html
<div class="section">
  <h3 class="section-title">Section Title</h3>
  <!-- content -->
</div>
```

### Cards
```html
<div class="card card-interactive">
  <!-- card content -->
</div>
```

### Grids
```html
<div class="grid grid-2">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

### Buttons
Use PrimeNG buttons with shared style classes:
```html
<p-button styleClass="btn-primary" label="Primary Action">
<p-button styleClass="btn-secondary" icon="pi pi-settings">
```

### States (Loading, Error, Empty)
```html
<div class="loading-state">
  <i class="state-icon pi pi-spinner"></i>
  <h3 class="state-title">Loading...</h3>
  <p class="state-description">Please wait</p>
</div>
```

## Best Practices

### 1. Use Design Tokens
Always prefer design tokens over hardcoded values:
```scss
// ❌ Avoid
.my-component {
  padding: 20px;
  font-size: 18px;
  border-radius: 12px;
}

// ✅ Prefer
.my-component {
  padding: var(--spacing-xl);
  font-size: var(--font-size-lg);
  border-radius: var(--border-radius-lg);
}
```

### 2. Use Utility Classes
Leverage utility classes for common patterns:
```html
<!-- ❌ Avoid custom CSS for simple layouts -->
<div class="custom-flex-container">

<!-- ✅ Use utility classes -->
<div class="flex items-center justify-between p-lg">
```

### 3. Component-Specific Styles Only
Keep component SCSS files minimal, only including styles that are truly unique to that component:
```scss
/* ❌ Don't repeat shared patterns */
.my-component {
  display: flex;
  flex-direction: column;
  padding: 20px;
  background: var(--surface-card);
  border-radius: 12px;
}

/* ✅ Use shared classes and add only unique styles */
.my-component {
  /* Only component-specific styles here */
  .special-element {
    /* unique styling */
  }
}
```

### 4. Responsive Design
Use the provided responsive utilities:
```html
<div class="mobile:flex-col desktop:flex-row">
```

### 5. Dark Theme Support
All design tokens automatically support dark theme. Avoid hardcoded colors:
```scss
// ❌ Hardcoded colors break dark theme
color: #333;

// ✅ Use theme-aware tokens
color: var(--text-color);
```

## Migration Guide

When refactoring existing components:

1. **Replace hardcoded spacing** with design tokens
2. **Use shared component classes** (`.card`, `.header`, `.section`)
3. **Apply utility classes** for layout and typography
4. **Remove redundant styles** that are now handled by shared classes
5. **Keep only component-specific styles** in component SCSS files

## PrimeNG Integration

This design system extends PrimeNG's built-in design tokens. You can still use PrimeNG's utility classes alongside our custom ones:

```html
<!-- PrimeNG utilities -->
<div class="p-3 m-2">

<!-- Our custom utilities -->
<div class="p-lg m-md">

<!-- Combined -->
<div class="p-card p-3 card card-interactive">
``` 