# Ralph Loop Guide

Complete guide to using Ralph Loop for AI-assisted development with this template.

## What is Ralph Loop?

Ralph Loop is a Claude Code plugin that enables **autonomous, iterative development sessions**. Named after Ralph Wiggum (the lovable character from The Simpsons), Ralph Loop allows Claude to work continuously on your codebase, implementing features, fixing bugs, and refining code based on real feedback from builds and tests.

## How Ralph Loop Works

```
┌─────────────────────────────────────────────────────────────┐
│                      RALPH LOOP CYCLE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   1. You describe a task                                    │
│              │                                              │
│              ▼                                              │
│   2. Ralph plans the approach                               │
│              │                                              │
│              ▼                                              │
│   3. Ralph implements changes ◄──────────┐                  │
│              │                           │                  │
│              ▼                           │                  │
│   4. Ralph runs build/tests              │                  │
│              │                           │                  │
│              ▼                           │                  │
│   5. Errors? ─── Yes ────────────────────┘                  │
│         │                                                   │
│         No                                                  │
│         │                                                   │
│         ▼                                                   │
│   6. Task complete or next step                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Installation

Make sure you have Claude Code installed, then:

```bash
# In Claude Code
/plugin install ralph-loop@claude-plugins-official
```

Restart Claude Code after installation.

## Commands

| Command | Description |
|---------|-------------|
| `/ralph-loop` | Start a new Ralph Loop session |
| `/cancel-ralph` | Cancel the active Ralph Loop |
| `/help` | Get help on Ralph Loop commands |

## Starting a Session

1. Open Claude Code in your project:
   ```bash
   cd my-project
   claude
   ```

2. Start Ralph Loop:
   ```
   /ralph-loop
   ```

3. Describe your task when prompted.

## Example Sessions

### Adding a New Feature

```
You: /ralph-loop

Ralph: Ralph Loop started! What would you like me to work on?

You: Create a user profile page at /profile that shows the user's
     name, email, and avatar. Include edit functionality with form
     validation. Use shadcn-vue components.

Ralph: I'll create a user profile page with edit functionality. Here's my plan:

1. Create the profile page at pages/profile.vue
2. Create a user store with Pinia for state management
3. Add form components using shadcn-vue (Input, Button, Avatar)
4. Implement form validation
5. Add i18n translations for the page

Starting with step 1...

[Ralph implements the feature, running builds after each step]
```

### Fixing a Bug

```
You: /ralph-loop

Ralph: Ralph Loop started! What would you like me to work on?

You: The navigation menu doesn't highlight the active page correctly.
     It should highlight based on the current route.

Ralph: I'll investigate and fix the navigation highlighting issue.

Looking at the navigation component...
Found the issue - the active class comparison isn't using the full path.

Implementing fix...
Running build to verify...
Build successful!

The navigation now correctly highlights the active page.
```

### Refactoring Code

```
You: /ralph-loop

Ralph: Ralph Loop started! What would you like me to work on?

You: Refactor the API calls to use a centralized composable with
     error handling and loading states.

Ralph: I'll create a centralized API composable. Plan:

1. Create useApi composable with fetch wrapper
2. Add loading and error state management
3. Migrate existing API calls to use the new composable
4. Add TypeScript types for responses

Starting implementation...
```

## Best Practices

### Be Specific

Good:
> "Add a dark mode toggle to the header that persists the preference in localStorage and applies Tailwind's dark mode classes"

Not as good:
> "Add dark mode"

### Provide Context

Good:
> "Add form validation to the contact form. Use vee-validate with zod schema. Show inline errors below each field."

### Let Ralph Iterate

Ralph learns from build errors and test failures. Don't interrupt immediately if something fails - Ralph will often fix it in the next iteration.

### Set Boundaries

> "Add the settings page. Only modify files in apps/web/pages/ and apps/web/stores/. Don't change any existing components."

### Break Down Large Tasks

Instead of:
> "Build a complete e-commerce checkout flow"

Try:
> "Add the shopping cart page with item list and quantity controls"

Then after that's done:
> "Add the checkout form with shipping address fields"

## When to Use Ralph Loop

**Great for:**
- Multi-file feature implementation
- Bug investigation and fixing
- Refactoring with verification
- Adding new pages/routes
- Component creation with styling

**Not ideal for:**
- Quick one-line fixes (just ask Claude directly)
- Pure research/exploration
- Highly creative/design work

## Monitoring Progress

During a Ralph Loop session:

1. **Watch the output** - Ralph shows what it's doing
2. **Review file changes** - Use git diff to see modifications
3. **Provide feedback** - Correct course if needed
4. **Let it complete** - Ralph will tell you when done

## Canceling a Session

If you need to stop Ralph:

```
/cancel-ralph
```

Ralph will stop after completing the current step. Your changes are preserved - you can review and keep or revert them.

## Tips for This Template

### Working with Turborepo

Ralph understands the monorepo structure. You can say:
> "Add a shared utility package in packages/utils and use it in apps/web"

### Using shadcn-vue

Ralph knows how to add components:
> "Add a modal dialog using shadcn-vue for confirming user deletion"

### Pinia Stores

> "Create a notifications store with Pinia that persists to localStorage"

### i18n

> "Add French translations for all text on the dashboard page"

## Troubleshooting

### Ralph seems stuck

Cancel and restart with more specific instructions:
```
/cancel-ralph
/ralph-loop
```

### Build keeps failing

Provide more context about the error or constraints:
> "The build is failing because X. Try Y approach instead."

### Changes aren't what you wanted

Cancel, revert changes with git, and try again with clearer instructions:
```bash
git checkout .
```

Then restart with better prompts.
