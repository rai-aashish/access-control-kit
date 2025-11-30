# Access Control Kit

A powerful, type-safe, and **framework-agnostic** access control library. Define your policies once and use them anywhere—Node.js, React, Vue, Svelte, or plain JavaScript.

## Version

Current Version: **0.1.0**

## License

MIT

## Features

- **🔒 Type-Safe**: Automatic type inference for resources and actions based on your configuration.
- **📝 Statement-Based Policy**: Granular control with 'allow' and 'deny' effects, similar to AWS IAM.
- **🎯 Specificity-Based Evaluation**: More specific statements override broader ones, enabling fine-grained control.
- **🚀 Framework Agnostic Core**: Pure JS/TS logic (`access-control-kit`) that can be used in any environment.
- **⚛️ React Bindings**: First-class support for React (`access-control-kit/react`) with Providers, Hooks, and Guards.
- **🌍 Universal**: Share the same policy logic across your entire stack (Backend & Frontend).
- **🎯 Attribute-Based Access Control (ABAC)**: Support for flexible runtime contexts.
- **🃏 Wildcard Support**: Support for `*` actions and resources.
- **🛡️ Secure Defaults**: Default deny policy with explicit allow overrides.

## Installation

```bash
npm install access-control-kit
# or
yarn add access-control-kit
# or
pnpm add access-control-kit
```

## Quick Start

### 1. Define Configuration

```typescript
// access-control-config.ts
// Define your resources and actions
// in structure {
//                RESOURCE1: [ACTION1, ACTION2, ...]
//                RESOURCE2: [ACTION1, ACTION2, ...]
//                ...
//               }
// Use const to ensure type inference
export const config = {
  POST: ['create', 'read', 'update', 'delete'],
  USER: ['read', 'invite', 'delete'],
  SETTINGS: ['view', 'edit'],
} as const;
```

### 2. Define Policy

```typescript
import { TAccessControlPolicy } from 'access-control-kit';

const userPolicy: TAccessControlPolicy<typeof config> = [
  { resource: 'POST', actions: ['read'], effect: 'allow' },
  { resource: 'POST', actions: ['update'], effect: 'allow', contexts: [{ authorId: 'user-123' }] },
  { resource: 'POST', actions: ['delete'], effect: 'deny' },
];
```

### 3. Use in React

```tsx
import { createAccessControl } from 'access-control-kit/react';

const { AccessControlProvider, useAccessControl, AccessControlGuard } = createAccessControl(config);

function App() {
  return (
    <AccessControlProvider accessControlPolicy={userPolicy}>
      <MyComponent />
    </AccessControlProvider>
  );
}

function MyComponent() {
  const { can } = useAccessControl();
  
  return (
    <div>
      {can('POST', 'read') && <button>Read</button>}
      
      <AccessControlGuard resource="SETTINGS" action="edit" fallback={<span>No Access</span>}>
        <button>Edit Settings</button>
      </AccessControlGuard>
    </div>
  );
}
```

### 4. Use in Node.js / API Routes

```typescript
import { getAccessControl } from 'access-control-kit';

export async function POST(req) {
  const policy = await fetchUserPolicy(req.user.id);
  const { can } = getAccessControl(policy);

  if (!can('POST', 'create')) {
    return new Response('Forbidden', { status: 403 });
  }
  
  // Proceed with creation...
}
```

## Core API (`access-control-kit`)

The core module is framework-agnostic and can be used anywhere.

### `getAccessControl(policy)`

Evaluates permissions based on the provided policy.

**Parameters:**
- `policy`: `TAccessControlPolicy<T>` - The access control policy to evaluate.

**Returns:** Object with:
- `policy`: The original policy
- `can(resource, action, context?)`: Check if a single action is allowed
- `canAll(resource, actions, context?)`: Check if ALL actions are allowed
- `canAny(resource, actions, context?)`: Check if ANY action is allowed

**Example:**

```typescript
import { getAccessControl } from 'access-control-kit';

const policy = [
  { resource: 'POST', actions: ['read', 'update'], effect: 'allow' }
];

const { can, canAll, canAny } = getAccessControl(policy);

can('POST', 'read'); // true
can('POST', 'delete'); // false

canAll('POST', ['read', 'update']); // true
canAny('POST', ['read', 'delete']); // true
```

### `can(resource, action, context?)`

Check if a specific action on a resource is allowed.

**Parameters:**
- `resource`: Resource key from your config
- `action`: Action name from your config
- `context?`: Optional runtime context object or array of objects

**Returns:** `boolean`

**Examples:**

```typescript
// Simple check
can('POST', 'read'); // true/false

// With single context
can('POST', 'update', { authorId: 'user-123' }); // true if policy allows

// With multiple contexts (OR logic)
can('POST', 'update', [
  { authorId: 'user-123' },
  { role: 'admin' }
]); // true if ANY context matches
```

### `canAll(resource, actions, context?)`

Check if ALL specified actions are allowed.

**Parameters:**
- `resource`: Resource key
- `actions`: Array of action names
- `context?`: Optional context

**Returns:** `boolean`

**Example:**

```typescript
canAll('POST', ['read', 'update']); // true only if BOTH are allowed
```

### `canAny(resource, actions, context?)`

Check if ANY of the specified actions are allowed.

**Parameters:**
- `resource`: Resource key
- `actions`: Array of action names
- `context?`: Optional context

**Returns:** `boolean`

**Example:**

```typescript
canAny('POST', ['read', 'delete']); // true if EITHER is allowed
```

## React API (`access-control-kit/react`)

React-specific bindings with full TypeScript support.

### `createAccessControl(config)`

Factory function to create typed React utilities.

**Parameters:**
- `config`: Your resource/action configuration object

**Returns:** Object with:
- `AccessControlProvider`: Context provider component
- `useAccessControl`: Hook to access permissions
- `AccessControlGuard`: Component guard
- `withAccessControl`: HOC wrapper

**Example:**

```typescript
import { createAccessControl } from 'access-control-kit/react';

const config = {
  POST: ['create', 'read', 'update', 'delete'],
} as const;

export const {
  AccessControlProvider,
  useAccessControl,
  AccessControlGuard,
  withAccessControl,
} = createAccessControl(config);
```

### `<AccessControlProvider>`

Context provider that makes the policy available to child components.

**Props:**
- `accessControlPolicy`: `TAccessControlPolicy<T>` - The policy to enforce
- `isLoading?`: `boolean` - Optional loading state (default: `false`)
- `children`: `React.ReactNode`

**Example:**

```tsx
<AccessControlProvider accessControlPolicy={policy} isLoading={isLoading}>
  <App />
</AccessControlProvider>
```

### `useAccessControl()`

Hook to access the policy context.

**Returns:** Object with:
- `can(resource, action, context?)`: Check permission
- `canAll(resource, actions, context?)`: Check all permissions
- `canAny(resource, actions, context?)`: Check any permission
- `policy`: The current policy
- `isLoading`: Loading state

**Example:**

```tsx
function MyComponent() {
  const { can, isLoading } = useAccessControl();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      {can('POST', 'update', { authorId: currentUser.id }) && (
        <button>Edit Post</button>
      )}
    </div>
  );
}
```

### `<AccessControlGuard>`

Component that conditionally renders children based on permissions.

**Props:**
- `resource`: Resource key
- `action`: Action name
- `context?`: Optional runtime context
- `fallback?`: Content to show if denied (default: `null`)
- `loadingFallback?`: Content to show while loading (default: `null`)
- `passThrough?`: If `true`, enables render props mode
- `children`: Content to show if allowed, or render function if `passThrough`

**Standard Mode:**

```tsx
<AccessControlGuard 
  resource="POST" 
  action="update"
  context={{ authorId: post.authorId }}
  fallback={<span>No Access</span>}
  loadingFallback={<span>Checking...</span>}
>
  <button>Edit Post</button>
</AccessControlGuard>
```

**PassThrough Mode (Render Props):**

```tsx
<AccessControlGuard resource="POST" action="update" passThrough>
  {({ allowed, isLoading }) => (
    <button disabled={!allowed || isLoading}>
      {isLoading ? 'Checking...' : allowed ? 'Edit' : 'Locked'}
    </button>
  )}
</AccessControlGuard>
```

### `withAccessControl(Component, resource, action, context?, FallbackComponent?, LoadingComponent?)`

Higher-Order Component to protect a component with access control.

**Parameters:**
- `Component`: Component to wrap
- `resource`: Resource key
- `action`: Action name
- `context?`: Optional context
- `FallbackComponent?`: Component to show if denied
- `LoadingComponent?`: Component to show while loading

**Example:**

```tsx
const ProtectedSettings = withAccessControl(
  SettingsPage,
  'SETTINGS',
  'edit',
  undefined,
  () => <div>Access Denied</div>,
  () => <div>Loading...</div>
);
```

## Recipes

### Role-Based Access Control (RBAC)

```typescript
import { TAccessControlPolicy } from 'access-control-kit';

type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';

export function getRolePolicy(role: Role): TAccessControlPolicy<typeof config> {
  switch (role) {
    case 'ADMIN':
      return [{ resource: '*', actions: ['*'], effect: 'allow' }];
    
    case 'EDITOR':
      return [
        { resource: 'POST', actions: ['create', 'read', 'update'], effect: 'allow' },
        { resource: 'POST', actions: ['delete'], effect: 'allow', contexts: [{ authorId: 'current-user' }] },
      ];
    
    case 'VIEWER':
      return [{ resource: 'POST', actions: ['read'], effect: 'allow' }];
    
    default:
      return [];
  }
}
```

### Attribute-Based Access Control (ABAC)

```typescript
// Policy with contexts
const policy = [
  {
    resource: 'DOCUMENT',
    actions: ['view'],
    effect: 'allow',
    contexts: [
      { department: 'engineering' },
      { public: true }
    ]
  }
];

// Usage - checks if ANY context matches
can('DOCUMENT', 'view', { department: 'engineering' }); // true
can('DOCUMENT', 'view', { public: true }); // true
can('DOCUMENT', 'view', { department: 'sales' }); // false
```

### Specificity-Based Evaluation

`access-control-kit` uses **specificity-based evaluation** where more specific statements (with more context keys) override broader ones. This enables sophisticated access control patterns.

#### How Specificity Works

1. **Specificity Score**: Number of keys in the context object
   - No context: specificity = 0
   - `{ userId: 'x' }`: specificity = 1
   - `{ userId: 'x', postId: 'y' }`: specificity = 2

2. **Evaluation Rules**:
   - More specific statements take precedence
   - Among equally specific statements, **deny wins**
   - Statements without context are least specific

#### Example: Override Broad Deny with Specific Allow

```typescript
const policy = [
  // Broad deny - specificity = 1
  {
    resource: 'POST',
    actions: ['delete'],
    effect: 'deny',
    contexts: [{ userId: 'restricted-user' }]
  },
  // Specific allow - specificity = 2 (overrides above)
  {
    resource: 'POST',
    actions: ['delete'],
    effect: 'allow',
    contexts: [{ userId: 'restricted-user', postId: 'owned-post' }]
  }
];

// User can delete their own post despite broad deny
can('POST', 'delete', { userId: 'restricted-user', postId: 'owned-post' }); // ✅ true

// But cannot delete other posts
can('POST', 'delete', { userId: 'restricted-user', postId: 'other-post' }); // ❌ false
```

#### Example: Multi-Level Specificity

```typescript
const policy = [
  // Level 0: Deny all (no context)
  { resource: 'DOCUMENT', actions: ['view'], effect: 'deny' },
  
  // Level 1: Allow for department (1 key)
  { resource: 'DOCUMENT', actions: ['view'], effect: 'allow', contexts: [{ department: 'eng' }] },
  
  // Level 2: Deny for specific doc (2 keys)
  { resource: 'DOCUMENT', actions: ['view'], effect: 'deny', contexts: [{ department: 'eng', docId: 'secret' }] }
];

can('DOCUMENT', 'view'); // ❌ false (level 0 deny)
can('DOCUMENT', 'view', { department: 'eng' }); // ✅ true (level 1 allow)
can('DOCUMENT', 'view', { department: 'eng', docId: 'public' }); // ✅ true (level 1 allow)
can('DOCUMENT', 'view', { department: 'eng', docId: 'secret' }); // ❌ false (level 2 deny)
```

### Multiple Contexts (OR Logic)

```typescript
// Check if user has access via multiple potential contexts
const userContexts = [
  { department: 'engineering', role: 'intern' },
  { department: 'sales', role: 'lead' }
];

can('DOCUMENT', 'view', userContexts); // true if ANY context matches policy
```

### Loading States

```tsx
function App() {
  const [policy, setPolicy] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetchPolicy().then(p => {
      setPolicy(p);
      setIsLoading(false);
    });
  }, []);
  
  return (
    <AccessControlProvider accessControlPolicy={policy} isLoading={isLoading}>
      <MyComponent />
    </AccessControlProvider>
  );
}
```

### Server-Side Validation

```typescript
// API Route (Next.js App Router)
import { getAccessControl } from 'access-control-kit';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const policy = await getUserPolicy(session.userId);
  const post = await getPost(params.id);
  
  const { can } = getAccessControl(policy);
  
  if (!can('POST', 'delete', { authorId: post.authorId })) {
    return new Response('Forbidden', { status: 403 });
  }
  
  await deletePost(params.id);
  return new Response('OK');
}
```

## Building Wrappers for Other Frameworks

Since `access-control-kit` core is framework-agnostic, you can easily build wrappers for Vue, Svelte, Angular, etc.

### Vue Example

```typescript
// useAccessControl.ts
import { getAccessControl } from 'access-control-kit';
import { computed, unref } from 'vue';

export function useAccessControl(policyRef) {
  // Re-create access control object when policy changes
  const accessControl = computed(() => getAccessControl(unref(policyRef)));
  
  return {
    // Delegate to the current access control instance
    can: (resource, action, context) => accessControl.value.can(resource, action, context),
    canAll: (resource, actions, context) => accessControl.value.canAll(resource, actions, context),
    canAny: (resource, actions, context) => accessControl.value.canAny(resource, actions, context),
  };
}
```

### Svelte Example

```typescript
// accessControl.ts
import { getAccessControl } from 'access-control-kit';
import { writable, derived } from 'svelte/store';

export function createAccessControlStore(initialPolicy) {
  const policy = writable(initialPolicy);
  
  // Derived store that updates whenever policy changes
  // Returns { can, canAll, canAny, policy }
  const accessControl = derived(policy, $policy => getAccessControl($policy));
  
  return {
    policy,
    subscribe: accessControl.subscribe, // Make it a store
  };
}

// Usage in component:
// <script>
//   import { createAccessControlStore } from './accessControl';
//   const ac = createAccessControlStore([]);
// </script>
//
// {#if $ac.can('POST', 'read')}...{/if}
```

## TypeScript Support

Full TypeScript support with automatic type inference:

```typescript
const config = {
  POST: ['create', 'read', 'update', 'delete'],
  USER: ['read', 'invite'],
} as const;

const { can } = createAccessControl(config);

// ✅ TypeScript knows these are valid
can('POST', 'read');
can('USER', 'invite');

// ❌ TypeScript errors
can('POST', 'invalid'); // Error: 'invalid' is not a valid action
can('INVALID', 'read'); // Error: 'INVALID' is not a valid resource
```

## License

MIT © Aashish Rai
