import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Internal: used by actions to retrieve the current user's ID
export const currentUserId = internalQuery({
  args: {},
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx) => {
    return await getAuthUserId(ctx);
  },
});

export const viewer = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      image: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      phone: v.optional(v.string()),
      phoneVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      profileImageUrl: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    // Resolve profile image URL from storage if present
    let profileImageUrl: string | undefined;
    if (user.profileImageId) {
      const url = await ctx.storage.getUrl(user.profileImageId);
      if (url) profileImageUrl = url;
    }

    return {
      _id: user._id,
      _creationTime: user._creationTime,
      name: user.name,
      email: user.email,
      image: user.image,
      emailVerificationTime: user.emailVerificationTime,
      phone: user.phone,
      phoneVerificationTime: user.phoneVerificationTime,
      isAnonymous: user.isAnonymous,
      profileImageUrl,
    };
  },
});

// Generate an upload URL for file storage (profile photos)
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

// Update the user's profile (name and/or profile image)
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    profileImageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) {
      patch.name = args.name;
    }
    if (args.profileImageId !== undefined) {
      // Delete old profile image if it exists
      const user = await ctx.db.get(userId);
      if (user?.profileImageId) {
        await ctx.storage.delete(user.profileImageId);
      }
      patch.profileImageId = args.profileImageId;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(userId, patch);
    }
    return null;
  },
});

// Delete the user's profile image
export const deleteProfileImage = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    if (user.profileImageId) {
      await ctx.storage.delete(user.profileImageId);
      await ctx.db.patch(userId, { profileImageId: undefined });
    }
    return null;
  },
});
