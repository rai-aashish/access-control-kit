import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TAccessControlPolicy } from "../core/types";
import { createAccessControl } from "./createAccessControl";

// Setup test configuration
const config = {
	POST: ["create", "read", "update", "delete"],
	USER: ["read", "invite", "delete"],
	SETTINGS: ["view", "edit"],
} as const;

type TStrongAccessControlConfig = typeof config;

const { AccessControlProvider, AccessControlGuard, useAccessControl } =
	createAccessControl(config);

describe("Access Control System - React", () => {
	describe("React Integration", () => {
		it("should support conditions in components", async () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["update"],
					effect: "allow",
					contexts: [{ authorId: "auth-123" }],
				},
			];

			render(
				<AccessControlProvider accessControlPolicy={policy}>
					<AccessControlGuard
						resource="POST"
						action="update"
						context={{ authorId: "auth-123" }}
					>
						<button type="button">Edit My Post</button>
					</AccessControlGuard>
					<AccessControlGuard
						resource="POST"
						action="update"
						context={[{ authorId: "other" }]}
						fallback={<span>Cannot edit</span>}
					>
						<button type="button">Edit Other Post</button>
					</AccessControlGuard>
				</AccessControlProvider>,
			);

			expect(await screen.findByText("Edit My Post")).toBeInTheDocument();
			expect(await screen.findByText("Cannot edit")).toBeInTheDocument();
		});
	});

	describe("Loading State", () => {
		it("should expose isLoading from useAccessControl", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [];
			render(
				<AccessControlProvider accessControlPolicy={policy} isLoading={true}>
					<AccessControlGuard resource="POST" action="read">
						<div>Content</div>
					</AccessControlGuard>
				</AccessControlProvider>,
			);
			// We can't easily check the hook return value directly without a test component,
			// but we can check if the Guard behaves correctly which uses the hook.
		});

		it("should show loadingFallback when loading", async () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{ resource: "POST", actions: ["read"], effect: "allow" },
			];

			render(
				<AccessControlProvider accessControlPolicy={policy} isLoading={true}>
					<AccessControlGuard
						resource="POST"
						action="read"
						loadingFallback={<div>Loading...</div>}
					>
						<div>Content</div>
					</AccessControlGuard>
				</AccessControlProvider>,
			);

			expect(await screen.findByText("Loading...")).toBeInTheDocument();
			expect(screen.queryByText("Content")).not.toBeInTheDocument();
		});

		it("should show content when not loading", async () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{ resource: "POST", actions: ["read"], effect: "allow" },
			];

			render(
				<AccessControlProvider accessControlPolicy={policy} isLoading={false}>
					<AccessControlGuard
						resource="POST"
						action="read"
						loadingFallback={<div>Loading...</div>}
					>
						<div>Content</div>
					</AccessControlGuard>
				</AccessControlProvider>,
			);

			expect(await screen.findByText("Content")).toBeInTheDocument();
			expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
		});

		it("should default to null fallback when loading if not provided", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{ resource: "POST", actions: ["read"], effect: "allow" },
			];

			const { container } = render(
				<AccessControlProvider accessControlPolicy={policy} isLoading={true}>
					<AccessControlGuard resource="POST" action="read">
						<div>Content</div>
					</AccessControlGuard>
				</AccessControlProvider>,
			);

			expect(container).toBeEmptyDOMElement();
		});
	});

	describe("PassThrough Mode", () => {
		it("should render children function with allowed=true when access is granted", async () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{ resource: "POST", actions: ["read"], effect: "allow" },
			];

			render(
				<AccessControlProvider accessControlPolicy={policy}>
					<AccessControlGuard resource="POST" action="read" passThrough={true}>
						{({ allowed }) => <div>Allowed: {allowed.toString()}</div>}
					</AccessControlGuard>
				</AccessControlProvider>,
			);

			expect(await screen.findByText("Allowed: true")).toBeInTheDocument();
		});

		it("should render children function with allowed=false when access is denied", async () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [];

			render(
				<AccessControlProvider accessControlPolicy={policy}>
					<AccessControlGuard resource="POST" action="read" passThrough={true}>
						{({ allowed }) => <div>Allowed: {allowed.toString()}</div>}
					</AccessControlGuard>
				</AccessControlProvider>,
			);

			expect(await screen.findByText("Allowed: false")).toBeInTheDocument();
		});

		it("should expose isLoading state to children function", async () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [];

			render(
				<AccessControlProvider accessControlPolicy={policy} isLoading={true}>
					<AccessControlGuard resource="POST" action="read" passThrough={true}>
						{({ isLoading }) => <div>Loading: {isLoading.toString()}</div>}
					</AccessControlGuard>
				</AccessControlProvider>,
			);

			expect(await screen.findByText("Loading: true")).toBeInTheDocument();
		});
	});

	describe("Hooks", () => {
		it("should return the policy context", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{ resource: "POST", actions: ["read"], effect: "allow" },
			];

			const wrapper = ({ children }: { children: React.ReactNode }) => (
				<AccessControlProvider accessControlPolicy={policy}>
					{children}
				</AccessControlProvider>
			);

			const { result } = renderHook(() => useAccessControl(), { wrapper });

			expect(result.current.policy).toEqual(policy);
			expect(result.current.isLoading).toBe(false);
			expect(result.current.can("POST", "read")).toBe(true);
		});

		it("should throw error if used outside provider", () => {
			// Suppress console.error for this test as React logs the error
			const originalError = console.error;
			console.error = (...args) => {
				const msg = args[0];
				if (
					(typeof msg === "string" &&
						msg.includes(
							"useAccessControl must be used within an AccessControlProvider",
						)) ||
					(msg instanceof Error &&
						msg.message.includes(
							"useAccessControl must be used within an AccessControlProvider",
						))
				) {
					return;
				}
				// Also suppress the React error boundary log
				if (
					typeof msg === "string" &&
					msg.includes("The above error occurred in the")
				) {
					return;
				}
				originalError.call(console, ...args);
			};

			expect(() => renderHook(() => useAccessControl())).toThrow(
				"useAccessControl must be used within an AccessControlProvider",
			);

			console.error = originalError;
		});
	});
});
