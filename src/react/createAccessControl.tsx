import type React from "react";
import { createContext, useContext, useMemo } from "react";

import { getAccessControl } from "../core";
import type {
	AccessControlConfig,
	AccessControlContextType,
	TAccessControlPolicy,
} from "../core/types";

/**
 * Props for the AccessControlProvider component.
 */
export interface AccessControlProviderProps<T extends AccessControlConfig> {
	/** The access control policy to enforce. */
	accessControlPolicy: TAccessControlPolicy<T>;
	/** Optional flag to indicate if the policy is currently loading. Defaults to false. */
	isLoading?: boolean;
	children: React.ReactNode;
}

/**
 * Props for the AccessControlGuard component.
 */
export interface GuardRenderProps {
	allowed: boolean;
	isLoading: boolean;
}

interface AccessControlGuardBaseProps<
	T extends AccessControlConfig,
	R extends keyof T,
> {
	/** The resource to check access for. */
	resource: R;
	/** The action to check access for. */
	action: T[R][number];
	/** Optional context to check against the policy conditions. */
	// biome-ignore lint/suspicious/noExplicitAny: Context can have any value type
	context?: Record<string, any> | Record<string, any>[];
}

interface AccessControlGuardStandardProps<
	T extends AccessControlConfig,
	R extends keyof T,
> extends AccessControlGuardBaseProps<T, R> {
	passThrough?: false;
	/** Content to render if access is denied. Defaults to null. */
	fallback?: React.ReactNode;
	/** Content to render while the policy is loading. Defaults to null. */
	loadingFallback?: React.ReactNode;
	children: React.ReactNode;
}

interface AccessControlGuardPassThroughProps<
	T extends AccessControlConfig,
	R extends keyof T,
> extends AccessControlGuardBaseProps<T, R> {
	passThrough: true;
	fallback?: never;
	loadingFallback?: never;
	children: (props: GuardRenderProps) => React.ReactNode;
}

/**
 * Props for the AccessControlGuard component.
 */
export type AccessControlGuardProps<
	T extends AccessControlConfig,
	R extends keyof T,
> =
	| AccessControlGuardStandardProps<T, R>
	| AccessControlGuardPassThroughProps<T, R>;

/**
 * Factory function to create typed access control utilities based on your configuration.
 *
 * @param config - The configuration object defining resources and actions.
 * @returns An object containing the Provider, hooks, and components typed to your config.
 */
export function createAccessControl<T extends AccessControlConfig>(_config: T) {
	const AccessControlContext = createContext<
		AccessControlContextType<T> | undefined
	>(undefined);

	/**
	 * Context Provider component. Wraps your application or subtree to provide the access policy.
	 */
	const AccessControlProvider: React.FC<AccessControlProviderProps<T>> = ({
		accessControlPolicy,
		isLoading = false,
		children,
	}) => {
		const value = useMemo(
			() => ({
				...getAccessControl(accessControlPolicy),
				isLoading,
			}),
			[accessControlPolicy, isLoading],
		);
		return (
			<AccessControlContext.Provider value={value}>
				{children}
			</AccessControlContext.Provider>
		);
	};

	/**
	 * Hook to access the access control context.
	 *
	 * @returns The access control context containing `can`, `canAll`, `canAny`, `policy`, and `isLoading`.
	 * @throws Error if used outside of AccessControlProvider.
	 */
	const useAccessControl = () => {
		const context = useContext(AccessControlContext);
		if (context === undefined) {
			throw new Error(
				"useAccessControl must be used within an AccessControlProvider",
			);
		}
		return context;
	};

	/**
	 * Component that conditionally renders its children based on access control.
	 */
	const AccessControlGuard = <R extends keyof T>(
		props: AccessControlGuardProps<T, R>,
	) => {
		const { resource, action, context } = props;
		const { can, isLoading } = useAccessControl();
		const isAllowed = can(resource, action, context);

		if (props.passThrough) {
			return <>{props.children({ allowed: isAllowed, isLoading })}</>;
		}

		if (isLoading) {
			return <>{props.loadingFallback}</>;
		}

		if (isAllowed) {
			return <>{props.children}</>;
		}

		return <>{props.fallback}</>;
	};

	/**
	 * Higher-Order Component (HOC) to protect a component with access control.
	 *
	 * @param WrappedComponent - The component to wrap.
	 * @param resource - The resource to check.
	 * @param action - The action to check.
	 * @param conditions - Optional conditions to check.
	 * @param FallbackComponent - Optional component to render if access is denied.
	 * @returns A new component that checks access before rendering the wrapped component.
	 */
	const withAccessControl = <P extends object, R extends keyof T>(
		WrappedComponent: React.ComponentType<P>,
		resource: R,
		action: T[R][number],
		// biome-ignore lint/suspicious/noExplicitAny: Context can have any value type
		context?: Record<string, any> | Record<string, any>[],
		FallbackComponent: React.ComponentType<P> | null = null,
		LoadingComponent: React.ComponentType<P> | null = null,
	) => {
		return (props: P) => {
			const { can, isLoading } = useAccessControl();

			if (isLoading) {
				if (LoadingComponent) {
					return <LoadingComponent {...props} />;
				}
				return null;
			}

			if (can(resource, action, context)) {
				return <WrappedComponent {...props} />;
			}

			if (FallbackComponent) {
				return <FallbackComponent {...props} />;
			}

			return null;
		};
	};

	return {
		AccessControlProvider,
		useAccessControl,
		AccessControlGuard,
		withAccessControl,
		getAccessControl,
	};
}
