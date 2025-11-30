import { describe, expect, it } from "vitest";

import { getAccessControl } from "./policy";
import type { TAccessControlPolicy } from "./types";

// Setup test configuration
const config = {
	POST: ["create", "read", "update", "delete"],
	USER: ["read", "invite", "delete"],
	SETTINGS: ["view", "edit"],
} as const;

type TStrongAccessControlConfig = typeof config;

describe("Access Control System - Core", () => {
	describe("getAccessControl", () => {
		it("should allow action when matching allow statement exists", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{ resource: "POST", actions: ["read"], effect: "allow" },
			];

			const { can } = getAccessControl(policy);
			expect(can("POST", "read")).toBe(true);
		});

		it("should support conditions", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["update"],
					effect: "allow",
					contexts: [{ authorId: "auth-123" }],
				},
			];

			const { can } = getAccessControl(policy);
			expect(can("POST", "update", { authorId: "auth-123" })).toBe(true);
			expect(can("POST", "update", { authorId: "other-user" })).toBe(false);
		});

		it("should deny if conditions are missing but policy requires them", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["update"],
					effect: "allow",
					contexts: [{ authorId: "auth-123" }],
				},
			];

			const { can } = getAccessControl(policy);
			expect(can("POST", "update")).toBe(false);
		});

		it("should allow if statement has no conditions (applies to all contexts)", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{ resource: "POST", actions: ["read"], effect: "allow" },
			];

			const { can } = getAccessControl(policy);
			expect(can("POST", "read")).toBe(true);
			expect(can("POST", "read", { someContext: "value" })).toBe(true);
		});

		it("should support allow if only one condition key matches", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["update"],
					effect: "allow",
					contexts: [{ status: "published" }],
				},
			];

			const { can } = getAccessControl(policy);
			expect(can("POST", "update", { status: "published" })).toBe(true);
			expect(can("POST", "update", { status: "draft" })).toBe(false);
		});

		it("should support multiple condition keys", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["update"],
					effect: "allow",
					contexts: [{ authorId: "auth-123", status: "draft" }],
				},
				{
					resource: "POST",
					actions: ["update"],
					effect: "deny",
					contexts: [{ authorId: "auth-123", resource: "protected" }],
				},
			];

			const { can } = getAccessControl(policy);
			expect(
				can("POST", "update", { authorId: "auth-123", status: "draft" }),
			).toBe(true);
			expect(
				can("POST", "update", { authorId: "auth-123", status: "published" }),
			).toBe(false);
			expect(
				can("POST", "update", { authorId: "auth-123", resource: "protected" }),
			).toBe(false);
			expect(can("POST", "update", { authorId: "auth-123" })).toBe(false); // Missing key
		});

		it("should support array-based conditions (OR logic)", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["*"],
					effect: "allow",
					contexts: [
						{ status: "published" },
						{ status: "draft", role: "superadmin" },
					],
				},
				{
					resource: "POST",
					actions: ["read"],
					effect: "allow",
					contexts: [
						{ status: "published" },
						{ status: "draft", role: "superadmin" },
					],
				},
			];

			const { can } = getAccessControl(policy);

			// Match first condition
			expect(can("POST", "delete", { status: "published" })).toBe(true);

			// Match second condition
			expect(
				can("POST", "delete", { status: "draft", role: "superadmin" }),
			).toBe(true);
			expect(can("POST", "read", { status: "draft", role: "superadmin" })).toBe(
				true,
			);
			expect(can("POST", "read", { status: "draft", role: "user" })).toBe(
				false,
			);

			// Match neither
			expect(can("POST", "delete", { status: "draft", role: "user" })).toBe(
				false,
			);
			expect(can("POST", "delete", { status: "archived" })).toBe(false);
		});

		it("should support passing an array of conditions (OR logic) in check", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["update"],
					effect: "allow",
					contexts: [{ role: "user" }, { role: "admin", status: "draft" }],
				},
			];

			const { can } = getAccessControl(policy);

			// Should allow if one of the input conditions matches the policy
			// Here we pass multiple potential contexts the user might be in
			expect(can("POST", "update", [{ role: "user" }, { role: "admin" }])).toBe(
				true,
			);
			expect(can("POST", "update", [{ role: "user" }])).toBe(true);
			expect(can("POST", "update", [{ role: "guest" }])).toBe(false);
		});
	});

	describe("Specificity-Based Evaluation", () => {
		it("should allow more specific allow to override broader deny", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["delete"],
					effect: "deny",
					contexts: [{ userId: "bad-user" }],
				},
				{
					resource: "POST",
					actions: ["delete"],
					effect: "allow",
					contexts: [{ userId: "bad-user", postId: "123" }],
				},
			];

			const { can } = getAccessControl(policy);

			// More specific allow (2 keys) should override broader deny (1 key)
			expect(can("POST", "delete", { userId: "bad-user", postId: "123" })).toBe(
				true,
			);

			// Broader context should still be denied
			expect(can("POST", "delete", { userId: "bad-user" })).toBe(false);
		});

		it("should deny when equally specific statements conflict (deny wins)", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["update"],
					effect: "allow",
					contexts: [{ userId: "user-123", postId: "456" }],
				},
				{
					resource: "POST",
					actions: ["update"],
					effect: "deny",
					contexts: [{ userId: "user-123", postId: "456" }],
				},
			];

			const { can } = getAccessControl(policy);

			// When specificity is equal, deny wins
			expect(can("POST", "update", { userId: "user-123", postId: "456" })).toBe(
				false,
			);
		});

		it("should handle multiple specificity levels correctly", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				// Least specific - deny all
				{
					resource: "POST",
					actions: ["read"],
					effect: "deny",
				},
				// Medium specific - allow for specific user
				{
					resource: "POST",
					actions: ["read"],
					effect: "allow",
					contexts: [{ userId: "user-123" }],
				},
				// Most specific - deny for specific user and post
				{
					resource: "POST",
					actions: ["read"],
					effect: "deny",
					contexts: [{ userId: "user-123", postId: "secret" }],
				},
			];

			const { can } = getAccessControl(policy);

			// Most specific deny should win
			expect(
				can("POST", "read", { userId: "user-123", postId: "secret" }),
			).toBe(false);

			// Medium specific allow should win over least specific deny
			expect(
				can("POST", "read", { userId: "user-123", postId: "public" }),
			).toBe(true);

			// Least specific deny should apply when no context
			expect(can("POST", "read")).toBe(false);
		});

		it("should handle no-context statements as least specific", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				// No context - allow all (specificity = 0)
				{
					resource: "POST",
					actions: ["read"],
					effect: "allow",
				},
				// With context - deny specific (specificity = 1)
				{
					resource: "POST",
					actions: ["read"],
					effect: "deny",
					contexts: [{ status: "draft" }],
				},
			];

			const { can } = getAccessControl(policy);

			// More specific deny should override no-context allow
			expect(can("POST", "read", { status: "draft" })).toBe(false);

			// No-context allow should work for other contexts
			expect(can("POST", "read", { status: "published" })).toBe(true);
			expect(can("POST", "read")).toBe(true);
		});
	});
});
