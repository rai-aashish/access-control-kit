import type { AccessControlConfig, TAccessControlPolicy } from "./types";

/**
 * Helper to evaluate the policy against a resource, action, and conditions.
 * Can be used in non-React environments (e.g., Server Components, API routes).
 *
 * @param accessControlPolicy - The policy to evaluate.
 * @returns An object containing `can`, `canAll`, and `canAny` functions.
 */
export const getAccessControl = <T extends AccessControlConfig>(
	accessControlPolicy: TAccessControlPolicy<T>,
) => {
	const can = <R extends keyof T>(
		resource: R,
		action: T[R][number],
		// biome-ignore lint/suspicious/noExplicitAny: Context can have any value type
		context?: Record<string, any> | Record<string, any>[],
	): boolean => {
		// Normalize input context to an array
		const inputContexts = Array.isArray(context)
			? context
			: context
				? [context]
				: [];

		// Filter statements relevant to this resource
		const relevantStatements = accessControlPolicy.filter(
			(stmt) => stmt.resource === resource,
		);

		// Collect all matching statements with their specificity
		type MatchedStatement = {
			effect: "allow" | "deny";
			specificity: number;
		};

		const matchedStatements: MatchedStatement[] = [];

		for (const stmt of relevantStatements) {
			// Check if action matches or is wildcard
			const actionMatches =
				stmt.actions.includes("*") || stmt.actions.includes(action);
			if (!actionMatches) continue;

			// Check conditions
			const policyConditions = stmt.contexts || [];

			// If statement has no conditions, it applies to all contexts (specificity = 0)
			if (policyConditions.length === 0) {
				matchedStatements.push({
					effect: stmt.effect,
					specificity: 0,
				});
				continue;
			}

			// If statement has conditions but no input context provided, it doesn't match
			if (inputContexts.length === 0) {
				continue;
			}

			// Check if ANY policy condition matches ANY input context (OR logic)
			for (const policyCondition of policyConditions) {
				const conditionKeys = Object.keys(policyCondition);
				const specificity = conditionKeys.length;

				for (const inputContext of inputContexts) {
					// Check if ALL keys in the policy condition match the input context values
					const allKeysMatch = conditionKeys.every(
						(key) => inputContext[key] === policyCondition[key],
					);

					if (allKeysMatch) {
						matchedStatements.push({
							effect: stmt.effect,
							specificity,
						});
					}
				}
			}
		}

		// If no statements matched, deny by default
		if (matchedStatements.length === 0) {
			return false;
		}

		// Sort by specificity (descending) - more specific statements take precedence
		matchedStatements.sort((a, b) => b.specificity - a.specificity);

		// Get the most specific level
		const maxSpecificity = matchedStatements[0].specificity;

		// Among the most specific statements, check if any are deny
		const mostSpecificStatements = matchedStatements.filter(
			(s) => s.specificity === maxSpecificity,
		);

		// If any of the most specific statements is deny, deny wins
		const hasDeny = mostSpecificStatements.some((s) => s.effect === "deny");
		if (hasDeny) {
			return false;
		}

		// Otherwise, allow
		return true;
	};

	const canAll = <R extends keyof T>(
		resource: R,
		actions: T[R][number][],
		// biome-ignore lint/suspicious/noExplicitAny: Context can have any value type
		context?: Record<string, any> | Record<string, any>[],
	): boolean => {
		return actions.every((action) => can(resource, action, context));
	};

	const canAny = <R extends keyof T>(
		resource: R,
		actions: T[R][number][],
		// biome-ignore lint/suspicious/noExplicitAny: Context can have any value type
		context?: Record<string, any> | Record<string, any>[],
	): boolean => {
		return actions.some((action) => can(resource, action, context));
	};

	return {
		policy: accessControlPolicy,
		can,
		canAll,
		canAny,
	};
};
